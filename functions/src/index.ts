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

admin.initializeApp();

const corsHandler = cors({
    origin: true,
});

export const getFile = functions.https.onRequest((request, response) => {
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
                response.status(404).send("File not found");
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
