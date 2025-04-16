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
 * Extract date and bet type from file name in format:
 * - tennis-DD-MM-YYYY (normal)
 * - tennis-spread-DD-MM-YYYY (spread)
 * - tennis-kelly-DD-MM-YYYY (kelly)
 * - table-tennis-DD-MM-YYYY (normal)
 * - table-tennis-kelly-DD-MM-YYYY (kelly)
 * 
 * Returns standardized date format like "10th Apr 2025" and bet type
 */
function extractDateAndTypeFromFileName(fileName: string): { date: string | null, betType: string } {
    // Extract bet type first
    let betType = "normal";

    if (fileName.includes("-spread-")) {
        betType = "spread";
    } else if (fileName.includes("-kelly-")) {
        betType = "kelly";
    }

    // Extract date based on different patterns
    let datePattern: RegExp;

    if (betType === "spread") {
        datePattern = /tennis-spread-(\d{1,2})-(\d{1,2})-(\d{4})/i;
    } else if (betType === "kelly") {
        datePattern = /(?:tennis|table-tennis)-kelly-(\d{1,2})-(\d{1,2})-(\d{4})/i;
    } else {
        datePattern = /(?:tennis|table-tennis)-(\d{1,2})-(\d{1,2})-(\d{4})/i;
    }

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
                return {
                    date: `${dayNum}${suffix} ${monthName} ${year}`,
                    betType
                };
            }
        } catch (e) {
            console.error("Error parsing date:", e);
        }
    }

    return { date: null, betType };
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
                const { date: standardDateStr, betType } = extractDateAndTypeFromFileName(file.fileName);

                // Transform to predictions
                const predictions = jsonData.map((row) => {
                    const typedRow = row as Record<string, unknown>;

                    // Log the raw row data for debugging
                    console.log("Raw Excel row data:", JSON.stringify(typedRow));

                    // Get all column names for debugging - convert to lowercase for easier comparison
                    const columnNames = Object.keys(typedRow);
                    console.log("Excel file columns:", columnNames.join(", "));

                    // Direct access to the exact column names from the Excel file
                    const directScorePrediction = typedRow["Score_prediction"];
                    const directValueBet = typedRow["Value_Bet"];

                    console.log("Direct column access results:", {
                        "Score_prediction": directScorePrediction,
                        "Value_Bet": directValueBet
                    });

                    // More robust way to find fields with various naming formats
                    const getFieldValue = (possibleKeys: string[], defaultValue: string = ""): string => {
                        for (const key of possibleKeys) {
                            // Check exact match
                            if (typedRow[key] !== undefined) {
                                console.log(`Found exact match for key "${key}": ${typedRow[key]}`);
                                return String(typedRow[key] || defaultValue);
                            }

                            // Check case-insensitive match
                            const lowerKey = key.toLowerCase();
                            const matchingKey = columnNames.find(col => col.toLowerCase() === lowerKey);
                            if (matchingKey && typedRow[matchingKey] !== undefined) {
                                console.log(`Found case-insensitive match for key "${key}" as "${matchingKey}": ${typedRow[matchingKey]}`);
                                return String(typedRow[matchingKey] || defaultValue);
                            }
                        }
                        return defaultValue;
                    };

                    // Find numeric values
                    const getNumericValue = (possibleKeys: string[], defaultValue: number = 0): number => {
                        const stringValue = getFieldValue(possibleKeys, "");
                        if (!stringValue) return defaultValue;

                        const parsedValue = parseFloat(stringValue);
                        return isNaN(parsedValue) ? defaultValue : parsedValue;
                    };

                    // Find score prediction using various possible column names - EXACT MATCH FIRST
                    const scorePrediction = typedRow["Score_prediction"] !== undefined
                        ? String(typedRow["Score_prediction"])
                        : getFieldValue([
                            "Score_prediction",
                            "Score_Prediction",
                            "Score Prediction",
                            "ScorePrediction"
                        ]);
                    console.log("Found score prediction:", scorePrediction);

                    // Find bet on / value bet using various possible column names - EXACT MATCH FIRST
                    const betOn = typedRow["Value_Bet"] !== undefined
                        ? String(typedRow["Value_Bet"])
                        : getFieldValue([
                            "Value_Bet",
                            "Value Bet",
                            "ValueBet",
                            "Bet_On",
                            "BetOn",
                            "bet_on",
                            "Bet On"
                        ]);
                    console.log("Found bet on value:", betOn);

                    // Basic prediction data
                    const predictionData = {
                        date: getFieldValue(["Date"], file.fileDate || ""),
                        team1: getFieldValue(["Team_1", "Team1"]),
                        oddTeam1: getNumericValue(["Odd_1", "Odd1", "Odd"]),
                        team2: getFieldValue(["Team_2", "Team2"]),
                        oddTeam2: getNumericValue(["Odd_2", "Odd2"]),
                        scorePrediction: scorePrediction,
                        confidence: getNumericValue(["Confidence"]),
                        bettingPredictionTeam1Win: getNumericValue(["Betting_predictions_team_1_win", "Team1Win"]),
                        bettingPredictionTeam2Win: getNumericValue(["Betting_predictions_team_2_win", "Team2Win"]),
                        finalScore: getFieldValue(["Final_Score", "FinalScore"]),
                        sportType: file.sportType || "tennis",
                        sourceFile: file.filePath,
                        fileId: file.id,
                        processedAt: Timestamp.now(),
                        standardDate: standardDateStr || "",
                        betType
                    };

                    // Add bet type specific fields
                    if (betType === "kelly") {
                        return {
                            ...predictionData,
                            optimalStakePart: getNumericValue(["Optimal_Stake_Part", "OptimalStakePart", "Optimal Stake", "Optimal"]),
                            betOn: betOn
                        };
                    } else if (betType === "spread") {
                        return {
                            ...predictionData,
                            valuePercent: getNumericValue(["Value_Percent", "ValuePercent", "Value Percent", "value_percent"]),
                            betOn: betOn
                        };
                    }

                    return predictionData;
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

                    // Determine the appropriate collection based on sport type and bet type
                    const sportType = file.sportType?.toLowerCase().trim() || "tennis";
                    let collectionName: string;

                    if (sportType === "table-tennis") {
                        collectionName = betType === "kelly" ? "table-tennis-kelly" : "table-tennis";
                    } else {
                        // Tennis
                        if (betType === "spread") {
                            collectionName = "tennis-spread";
                        } else if (betType === "kelly") {
                            collectionName = "tennis-kelly";
                        } else {
                            collectionName = "tennis";
                        }
                    }

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