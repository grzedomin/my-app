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
