import { db } from "./firebase";
import { collection, query, getDocs, writeBatch, doc, Timestamp } from "firebase/firestore";
import { BettingPrediction } from "@/lib/prediction-service";

/**
 * Migrates predictions to Kelly and spread value collections when files with these bet types are detected
 * Only needs to be run once when the new bet types are first introduced
 */
export const migratePredictionsToBetTypeCollections = async (
    progressCallback?: (message: string, percentComplete: number) => void
): Promise<{ success: boolean; message: string }> => {
    try {
        // Get all predictions from the tennis and table-tennis collections
        progressCallback?.("Fetching predictions to check for migration...", 0);

        // Step 1: Check the tennis collection
        const tennisQuery = query(collection(db, "tennis"));
        const tennisSnapshot = await getDocs(tennisQuery);

        // Step 2: Check the table-tennis collection
        const tableTennisQuery = query(collection(db, "table-tennis"));
        const tableTennisSnapshot = await getDocs(tableTennisQuery);

        const totalPredictions = tennisSnapshot.size + tableTennisSnapshot.size;

        if (totalPredictions === 0) {
            return {
                success: true,
                message: "No predictions found to migrate"
            };
        }

        progressCallback?.(`Found ${totalPredictions} total predictions to check`, 10);

        // Group predictions by bet type
        const tennisSpreadPredictions: BettingPrediction[] = [];
        const tennisKellyPredictions: BettingPrediction[] = [];
        const tableKellyPredictions: BettingPrediction[] = [];

        // Process tennis predictions
        tennisSnapshot.forEach((docSnapshot) => {
            const prediction = docSnapshot.data() as BettingPrediction;

            // Check if this is a prediction that should be in the spread collection
            if (prediction.betType === "spread" ||
                (prediction.valuePercent !== undefined && prediction.valuePercent > 0)) {
                tennisSpreadPredictions.push({
                    ...prediction,
                    id: docSnapshot.id
                } as BettingPrediction);
            }
            // Check if this is a prediction that should be in the kelly collection
            else if (prediction.betType === "kelly" ||
                (prediction.optimalStakePart !== undefined && prediction.optimalStakePart > 0)) {
                tennisKellyPredictions.push({
                    ...prediction,
                    id: docSnapshot.id
                } as BettingPrediction);
            }
        });

        // Process table tennis predictions (only kelly, no spread for table tennis)
        tableTennisSnapshot.forEach((docSnapshot) => {
            const prediction = docSnapshot.data() as BettingPrediction;

            if (prediction.betType === "kelly" ||
                (prediction.optimalStakePart !== undefined && prediction.optimalStakePart > 0)) {
                tableKellyPredictions.push({
                    ...prediction,
                    id: docSnapshot.id
                } as BettingPrediction);
            }
        });

        // Report on what we found
        const totalToMigrate = tennisSpreadPredictions.length + tennisKellyPredictions.length + tableKellyPredictions.length;

        progressCallback?.(`Found ${totalToMigrate} predictions to migrate (${tennisSpreadPredictions.length} tennis spread, ${tennisKellyPredictions.length} tennis kelly, ${tableKellyPredictions.length} table-tennis kelly)`, 20);

        if (totalToMigrate === 0) {
            return {
                success: true,
                message: "No predictions with alternative bet types found to migrate"
            };
        }

        // Now move the data to the appropriate collections
        let totalMigrated = 0;

        // Migrate tennis spread predictions
        if (tennisSpreadPredictions.length > 0) {
            progressCallback?.(`Migrating ${tennisSpreadPredictions.length} tennis spread predictions...`, 30);
            await migrateData(tennisSpreadPredictions, "tennis-spread", progressCallback);
            totalMigrated += tennisSpreadPredictions.length;
        }

        // Migrate tennis kelly predictions
        if (tennisKellyPredictions.length > 0) {
            progressCallback?.(`Migrating ${tennisKellyPredictions.length} tennis kelly predictions...`, 50);
            await migrateData(tennisKellyPredictions, "tennis-kelly", progressCallback);
            totalMigrated += tennisKellyPredictions.length;
        }

        // Migrate table tennis kelly predictions
        if (tableKellyPredictions.length > 0) {
            progressCallback?.(`Migrating ${tableKellyPredictions.length} table-tennis kelly predictions...`, 70);
            await migrateData(tableKellyPredictions, "table-tennis-kelly", progressCallback);
            totalMigrated += tableKellyPredictions.length;
        }

        progressCallback?.(`Migration complete: ${totalMigrated} predictions migrated`, 100);

        return {
            success: true,
            message: `Successfully migrated ${totalMigrated} predictions to their respective collections`
        };
    } catch (error) {
        console.error("Error during migration:", error);
        return {
            success: false,
            message: `Migration failed: ${error instanceof Error ? error.message : "Unknown error"}`
        };
    }
};

/**
 * Helper function to migrate a batch of predictions to a target collection
 */
const migrateData = async (
    predictions: BettingPrediction[],
    targetCollection: string,
    progressCallback?: (message: string, percentComplete: number) => void
): Promise<void> => {
    // Use batching to optimize writes
    const BATCH_SIZE = 100;
    let processed = 0;

    // Process in smaller batches
    for (let i = 0; i < predictions.length; i += BATCH_SIZE) {
        const batchChunk = predictions.slice(i, i + BATCH_SIZE);
        const batch = writeBatch(db);

        batchChunk.forEach((prediction) => {
            // Create a new document in the target collection
            const newDocRef = doc(collection(db, targetCollection));

            batch.set(newDocRef, {
                ...prediction,
                migrated: true,
                migratedAt: Timestamp.now()
            });
        });

        await batch.commit();
        processed += batchChunk.length;

        const percentComplete = Math.round((processed / predictions.length) * 100);
        progressCallback?.(`Migrated ${processed} of ${predictions.length} to ${targetCollection}`, percentComplete);
    }
}; 