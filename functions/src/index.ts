/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

// import {onRequest} from "firebase-functions/v2/https";
// import * as logger from "firebase-functions/logger";

// Start writing functions
// https://firebase.google.com/docs/functions/typescript

// export const helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import cors from "cors";
import * as XLSX from "xlsx";
import * as os from "os";
import * as path from "path";
import * as fs from "fs";

// Change to import v1 function
import * as functionsV1 from "firebase-functions/v1";

admin.initializeApp();

const corsHandler = cors({
    origin: true,
});

export const getFile = functions.https.onRequest((request, response) => {
    return corsHandler(request, response, async () => {
        try {
            // Get authorization header
            const authHeader = request.headers.authorization;
            let isAuthenticated = false;
            let userId = "";

            // Verify Firebase ID token if present
            if (authHeader && authHeader.startsWith('Bearer ')) {
                const idToken = authHeader.split('Bearer ')[1];

                try {
                    const decodedToken = await admin.auth().verifyIdToken(idToken);
                    userId = decodedToken.uid;
                    isAuthenticated = true;
                    console.log(`Authenticated request from user: ${userId}`);
                } catch (error) {
                    console.warn("Invalid token:", error);
                    // Continue with unauthenticated access (for public files)
                }
            } else {
                console.log("No auth token provided, proceeding with limited access");
            }

            // Get file path from query params
            const filePath = request.query.path as string;

            if (!filePath) {
                response.status(400).send("File path is required");
                return;
            }

            // Get file from Firebase Storage
            const bucket = admin.storage().bucket();
            const file = bucket.file(filePath);

            // Check if file exists
            const [exists] = await file.exists();
            if (!exists) {
                response.status(404).send("File not found");
                return;
            }

            // Get file metadata to check permissions
            const [metadata] = await file.getMetadata();

            // Check if user has permission to access this file
            // For now, we allow access to all files, but you can implement more complex permission logic
            // Public files can be accessed by anyone, private files only by authenticated users
            const isPublicFile = metadata.metadata?.accessLevel === "public";

            if (!isPublicFile && !isAuthenticated) {
                response.status(403).send("Access denied");
                return;
            }

            // Set appropriate headers
            response.set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
            response.set("Content-Disposition", `inline; filename="${filePath.split("/").pop()}"`);

            // Stream the file to the response
            const readStream = file.createReadStream();
            readStream.pipe(response);
        } catch (error) {
            console.error("Error fetching file:", error);
            response.status(500).send("Internal Server Error");
        }
    });
});

/**
 * Get file metadata from Firebase Storage
 */
export const getFileMetadata = functions.https.onRequest((request, response) => {
    return corsHandler(request, response, async () => {
        try {
            // Get file path from query params
            const filePath = request.query.path as string;

            if (!filePath) {
                response.status(400).send("File path is required");
                return;
            }

            // Get file from Firebase Storage
            const bucket = admin.storage().bucket();
            const file = bucket.file(filePath);

            // Check if file exists
            const [exists] = await file.exists();
            if (!exists) {
                response.status(404).send({ error: "File not found" });
                return;
            }

            // Get file metadata
            const [metadata] = await file.getMetadata();

            // Extract relevant metadata
            const fileMetadata = {
                name: metadata.name,
                contentType: metadata.contentType,
                size: metadata.size,
                updated: metadata.updated,
                timeCreated: metadata.timeCreated,
                customMetadata: metadata.metadata || {}
            };

            // Return metadata as JSON
            response.status(200).json(fileMetadata);
        } catch (error) {
            console.error("Error fetching file metadata:", error);
            response.status(500).json({ error: "Internal Server Error" });
        }
    });
});

/**
 * List files by date from Firebase Storage
 */
export const listFilesByDate = functions.https.onRequest((request, response) => {
    return corsHandler(request, response, async () => {
        try {
            // Get date from query params
            const date = request.query.date as string;
            const path = request.query.path || "betting-files";

            if (!date) {
                response.status(400).send({ error: "Date parameter is required" });
                return;
            }

            // Get all files from the path
            const bucket = admin.storage().bucket();
            const [files] = await bucket.getFiles({ prefix: path as string });

            // Filter files by date in metadata
            const matchingFiles = [];

            for (const file of files) {
                try {
                    const [metadata] = await file.getMetadata();

                    // Helper function to extract main date part
                    const extractMainDate = (dateStr: string): string | null => {
                        if (!dateStr) return null;
                        const dateMatch = dateStr.match(/(\d+[a-z]{2}\s+[A-Za-z]+\s+\d{4})/);
                        return dateMatch && dateMatch[1] ? dateMatch[1].trim() : dateStr;
                    };

                    // Check if file has date metadata matching the query
                    if (metadata.metadata &&
                        metadata.metadata.fileDate &&
                        typeof metadata.metadata.fileDate === 'string') {

                        const fileDate = metadata.metadata.fileDate;
                        const mainFileDate = extractMainDate(fileDate);
                        const mainQueryDate = extractMainDate(date);

                        // Match if either the exact date matches or the main parts match
                        if (fileDate === date ||
                            (mainFileDate && mainQueryDate && mainFileDate === mainQueryDate) ||
                            fileDate.includes(date)) {

                            matchingFiles.push({
                                name: metadata.name,
                                path: metadata.name,
                                contentType: metadata.contentType,
                                size: metadata.size,
                                updated: metadata.updated,
                                timeCreated: metadata.timeCreated,
                                customMetadata: metadata.metadata || {}
                            });
                        }
                    }
                } catch (metadataError) {
                    console.error("Error getting metadata for file:", file.name, metadataError);
                    // Continue with next file
                }
            }

            // Return matching files as JSON
            response.status(200).json({ files: matchingFiles });
        } catch (error) {
            console.error("Error listing files by date:", error);
            response.status(500).json({ error: "Internal Server Error" });
        }
    });
});

// Revert to v1 syntax
export const processExcelFile = functionsV1.storage.object().onFinalize(async (object) => {
    const filePath = object.name;
    if (!filePath) {
        console.log("No file path in object data");
        return;
    }

    // Check if it's an Excel file
    if (!filePath.endsWith(".xlsx") && !filePath.endsWith(".xls")) {
        console.log("Not an Excel file, skipping processing");
        return;
    }

    console.log(`Starting to process Excel file: ${filePath}`);

    // Get the bucket, fallback to default bucket if needed
    const bucket = object.bucket
        ? admin.storage().bucket(object.bucket)
        : admin.storage().bucket();
    const tempFilePath = path.join(os.tmpdir(), path.basename(filePath));

    try {
        // Download file to temp directory
        await bucket.file(filePath).download({ destination: tempFilePath });
        console.log("Excel file downloaded to", tempFilePath);

        // Read the Excel file
        const workbook = XLSX.readFile(tempFilePath);

        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
            throw new Error("Excel file has no sheets");
        }

        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        if (!worksheet) {
            throw new Error("First worksheet is empty or invalid");
        }

        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        if (!jsonData || jsonData.length === 0) {
            throw new Error("No data found in the Excel file");
        }

        console.log(`Successfully parsed Excel file with ${jsonData.length} rows`);

        // Extract file metadata (similar to your current extractDateFromExcel function)
        let fileDate = "";
        const filenameMatch = path.basename(filePath).match(/(?:tennis|table-tennis)-(\d{2})-(\d{2})-(\d{4})/i);
        if (filenameMatch) {
            const [, day, month, year] = filenameMatch;
            const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            const monthIndex = parseInt(month, 10) - 1;
            const monthName = monthNames[monthIndex];

            let daySuffix = "th";
            if (day.endsWith("1") && day !== "11") daySuffix = "st";
            if (day.endsWith("2") && day !== "12") daySuffix = "nd";
            if (day.endsWith("3") && day !== "13") daySuffix = "rd";

            fileDate = `${parseInt(day, 10)}${daySuffix} ${monthName} ${year}`;
        } else if (jsonData.length > 0 && (jsonData[0] as any).Date) {
            fileDate = (jsonData[0] as any).Date;
        }

        // Get file metadata from the storage object
        const [metadata] = await bucket.file(filePath).getMetadata();
        const sportType = metadata.metadata?.sportType ||
            (filePath.includes("table-tennis") ? "table-tennis" : "tennis");
        const userId = metadata.metadata?.userId || "unknown";

        console.log(`File metadata: sportType=${sportType}, userId=${userId}, fileDate=${fileDate}`);

        // Transform the data to match your BettingPrediction structure
        const predictions = jsonData.map((row: any) => ({
            date: row.Date || fileDate,
            team1: row.Team_1 || "",
            oddTeam1: parseFloat(row.Odd_1) || 0,
            team2: row.Team_2 || "",
            oddTeam2: parseFloat(row.Odd_2) || 0,
            scorePrediction: row.Score_prediction || "",
            confidence: parseFloat(row.Confidence) || 0,
            bettingPredictionTeam1Win: parseFloat(row.Betting_predictions_team_1_win) || 0,
            bettingPredictionTeam2Win: parseFloat(row.Betting_predictions_team_2_win) || 0,
            finalScore: row.Final_Score || "",
            // Extract sport type from file path or metadata
            sportType: sportType,
            // Store reference to original file
            sourceFile: filePath,
            // Add timestamp
            processedAt: admin.firestore.FieldValue.serverTimestamp()
        }));

        try {
            // Create a document ID from the file name for predictability
            const fileId = path.basename(filePath, path.extname(filePath));

            // Store file info in Firestore
            const fileRef = admin.firestore().collection("processed-files").doc(fileId);
            await fileRef.set({
                filePath,
                fileDate,
                sportType,
                userId,
                recordCount: predictions.length,
                processedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            console.log(`Saved file info to Firestore: processed-files/${fileId}`);

            // Determine the appropriate collection based on sport type
            const normalizedSportType = typeof sportType === "string" ? sportType.toLowerCase().trim() : "tennis";
            const collectionName = normalizedSportType === "table-tennis" ? "table-tennis" : "tennis";

            // Use multiple smaller batches to stay within limits
            const BATCH_SIZE = 100; // Smaller batch size to avoid timeouts
            let successCount = 0;

            for (let i = 0; i < predictions.length; i += BATCH_SIZE) {
                try {
                    const batch = admin.firestore().batch();
                    const batchPredictions = predictions.slice(i, i + BATCH_SIZE);

                    batchPredictions.forEach((prediction, index) => {
                        const docRef = admin.firestore().collection(collectionName).doc();
                        batch.set(docRef, {
                            ...prediction,
                            fileId: fileRef.id,
                            rowIndex: i + index
                        });
                    });

                    await batch.commit();
                    successCount += batchPredictions.length;
                    console.log(`Processed batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(predictions.length / BATCH_SIZE)}, rows ${i + 1}-${i + batchPredictions.length}`);
                } catch (batchError) {
                    console.error(`Error processing batch starting at index ${i}:`, batchError);
                    // Continue with next batch
                }
            }

            console.log(`Successfully processed ${successCount}/${predictions.length} predictions from ${filePath}`);

            // Update the file record with success status
            await fileRef.update({
                processedCount: successCount,
                processingComplete: true,
                lastUpdated: admin.firestore.FieldValue.serverTimestamp()
            });

        } catch (firestoreError) {
            console.error("Error writing to Firestore:", firestoreError);
            throw firestoreError;
        }

        // Clean up the temp file
        fs.unlinkSync(tempFilePath);
        console.log(`Cleaned up temporary file: ${tempFilePath}`);

    } catch (error: any) {
        console.error("Error processing Excel file:", error);
        // Try to record the error in Firestore for tracking
        try {
            const fileId = path.basename(filePath, path.extname(filePath));
            const errorRef = admin.firestore().collection("processing-errors").doc(fileId);
            await errorRef.set({
                filePath,
                error: error.toString(),
                timestamp: admin.firestore.FieldValue.serverTimestamp()
            });
        } catch (logError) {
            console.error("Failed to log error to Firestore:", logError);
        }
        throw error;
    }
});
