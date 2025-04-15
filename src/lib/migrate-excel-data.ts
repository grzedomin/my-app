import { getAllFiles, fetchExcelFile } from "./storage";
import * as XLSX from "xlsx";
import { db, auth } from "./firebase";
import { collection, doc, setDoc, writeBatch, Timestamp } from "firebase/firestore";

// Define a type for errors
interface ErrorWithMessage {
    message: string;
}

// Helper function to ensure error has a message property
function toErrorWithMessage(error: unknown): ErrorWithMessage {
    if (isErrorWithMessage(error)) return error;
    try {
        return new Error(String(error));
    } catch {
        return new Error("Unknown error");
    }
}

// Type guard for ErrorWithMessage
function isErrorWithMessage(error: unknown): error is ErrorWithMessage {
    return (
        typeof error === 'object' &&
        error !== null &&
        'message' in error &&
        typeof (error as Record<string, unknown>).message === 'string'
    );
}

/**
 * Extract date from file name in format tennis-DD-MM-YYYY or table-tennis-DD-MM-YYYY
 * and convert to standardized format like "10th Apr 2025"
 */
function extractDateFromFileName(fileName: string): string | null {
    // Extract date from patterns like "tennis-10-04-2025" or "table-tennis-10-04-2025"
    const datePattern = /(?:tennis|table-tennis)-(\d{1,2})-(\d{1,2})-(\d{4})/i;
    const match = fileName.match(datePattern);

    if (match && match.length === 4) {
        const day = parseInt(match[1], 10);
        const month = parseInt(match[2], 10);
        const year = parseInt(match[3], 10);

        try {
            // Create date object
            const date = new Date(year, month - 1, day); // month is 0-indexed in JS

            if (!isNaN(date.getTime())) {
                // Format the date with ordinal suffix
                const dayNum = date.getDate();
                let suffix = "th";
                if (dayNum % 10 === 1 && dayNum !== 11) suffix = "st";
                else if (dayNum % 10 === 2 && dayNum !== 12) suffix = "nd";
                else if (dayNum % 10 === 3 && dayNum !== 13) suffix = "rd";

                // Get month name (short version like "Apr")
                const monthName = date.toLocaleString('en', { month: 'short' });

                // Final formatted date
                return `${dayNum}${suffix} ${monthName} ${year}`;
            }
        } catch (e) {
            console.error("Error parsing date:", e);
        }
    }

    return null;
}

/**
 * Migrates Excel files to Firestore for faster loading
 * This function processes all existing Excel files and stores their data in Firestore
 */
export const migrateExcelFilesToFirestore = async (
    progressCallback?: (message: string, percentage?: number) => void
): Promise<{ success: boolean; message: string; processedCount: number }> => {
    try {
        // Ensure user is authenticated
        const currentUser = auth.currentUser;
        if (!currentUser) {
            return {
                success: false,
                message: "User not authenticated. Please sign in.",
                processedCount: 0
            };
        }

        // Get a fresh ID token for API calls
        try {
            await currentUser.getIdToken(true);
        } catch (tokenError) {
            console.error("Failed to refresh authentication token:", tokenError);
            return {
                success: false,
                message: "Authentication error. Please sign in again.",
                processedCount: 0
            };
        }

        // Get all existing files
        progressCallback?.("Fetching all Excel files...");
        const files = await getAllFiles();

        let processedCount = 0;
        const totalFiles = files.length;

        progressCallback?.(`Found ${totalFiles} files to process`, 0);

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const percentComplete = Math.round((i / totalFiles) * 100);

            progressCallback?.(`Processing file ${i + 1}/${totalFiles}: ${file.fileName}`, percentComplete);

            try {
                // Fetch the Excel file
                const fileBuffer = await fetchExcelFile(file.filePath);

                // Parse Excel data
                const workbook = XLSX.read(fileBuffer, { type: "array" });
                const worksheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonData = XLSX.utils.sheet_to_json(worksheet);

                // Extract standardized date from file name
                const standardDateStr = extractDateFromFileName(file.fileName);

                // Transform to predictions
                const predictions = jsonData.map((row) => {
                    const typedRow = row as Record<string, unknown>;
                    return {
                        date: typedRow.Date || file.fileDate || "",
                        team1: typedRow.Team_1 || "",
                        oddTeam1: parseFloat(String(typedRow.Odd_1)) || 0,
                        team2: typedRow.Team_2 || "",
                        oddTeam2: parseFloat(String(typedRow.Odd_2)) || 0,
                        scorePrediction: typedRow.Score_prediction || "",
                        confidence: parseFloat(String(typedRow.Confidence)) || 0,
                        bettingPredictionTeam1Win: parseFloat(String(typedRow.Betting_predictions_team_1_win)) || 0,
                        bettingPredictionTeam2Win: parseFloat(String(typedRow.Betting_predictions_team_2_win)) || 0,
                        finalScore: typedRow.Final_Score || "",
                        sportType: file.sportType || "tennis",
                        sourceFile: file.filePath,
                        fileId: file.id,
                        processedAt: Timestamp.now(),
                        standardDate: standardDateStr || ""  // Add standardized date from file name
                    };
                });

                // Split processing into smaller batches to prevent timeouts
                try {
                    // Save file record first
                    const fileRef = doc(db, "processed-files", file.id);
                    await setDoc(fileRef, {
                        filePath: file.filePath,
                        fileDate: file.fileDate,
                        sportType: file.sportType,
                        userId: file.userId,
                        recordCount: predictions.length,
                        processedAt: Timestamp.now()
                    });

                    // Determine the appropriate collection based on sport type
                    const sportType = file.sportType?.toLowerCase().trim() || "tennis";
                    const collectionName = sportType === "table-tennis" ? "table-tennis" : "tennis";

                    // Split into multiple smaller batches (Firestore batch limit is 500)
                    const BATCH_SIZE = 100; // Use smaller batches to avoid issues
                    for (let j = 0; j < predictions.length; j += BATCH_SIZE) {
                        const batchChunk = predictions.slice(j, j + BATCH_SIZE);

                        const currentBatch = writeBatch(db);
                        batchChunk.forEach((prediction, index) => {
                            const predictionRef = doc(collection(db, collectionName));
                            currentBatch.set(predictionRef, {
                                ...prediction,
                                rowIndex: j + index
                            });
                        });

                        await currentBatch.commit();
                        progressCallback?.(
                            `Committed batch ${Math.floor(j / BATCH_SIZE) + 1}/${Math.ceil(predictions.length / BATCH_SIZE)} for file ${file.fileName} (${i + 1}/${totalFiles})`,
                            percentComplete
                        );
                    }

                    processedCount++;
                    progressCallback?.(`Successfully processed ${predictions.length} predictions from ${file.fileName}`, percentComplete);
                } catch (firestoreError) {
                    console.error(`Firestore error for file ${file.fileName}:`, firestoreError);
                    progressCallback?.(`Error writing to Firestore for ${file.fileName}: ${toErrorWithMessage(firestoreError).message}`, percentComplete);
                    // Continue with next file
                }
            } catch (error: unknown) {
                const errorWithMessage = toErrorWithMessage(error);
                console.error(`Error processing file ${file.fileName}:`, errorWithMessage);
                progressCallback?.(`Error processing ${file.fileName}: ${errorWithMessage.message}`, percentComplete);
                // Continue with next file even if one fails
            }
        }

        return {
            success: processedCount > 0,
            message: `Successfully processed ${processedCount} out of ${totalFiles} files`,
            processedCount
        };
    } catch (error: unknown) {
        const errorWithMessage = toErrorWithMessage(error);
        console.error("Migration error:", errorWithMessage);
        return {
            success: false,
            message: `Migration failed: ${errorWithMessage.message}`,
            processedCount: 0
        };
    }
}; 