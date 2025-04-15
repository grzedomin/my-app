import { db } from "./firebase";
import { collection, query, getDocs, writeBatch, doc } from "firebase/firestore";
import { BettingPrediction } from "./prediction-service";

/**
 * Migrates predictions from the old 'predictions' collection to sport-specific collections
 */
export const migratePredictionsToSportCollections = async (
    progressCallback?: (message: string, percentComplete: number) => void
): Promise<{ success: boolean; message: string }> => {
    try {
        // Get all predictions from the old collection
        const q = query(collection(db, "predictions"));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            return {
                success: true,
                message: "No predictions found to migrate"
            };
        }

        // Group predictions by sport type
        const tennisPredictions: BettingPrediction[] = [];
        const tableTennisPredictions: BettingPrediction[] = [];

        querySnapshot.forEach((docSnapshot) => {
            const prediction = docSnapshot.data() as BettingPrediction;
            const sportType = prediction.sportType?.toLowerCase().trim() || "tennis";

            if (sportType === "table-tennis" || sportType === "table tennis") {
                tableTennisPredictions.push({
                    ...prediction,
                    id: docSnapshot.id
                } as BettingPrediction);
            } else {
                tennisPredictions.push({
                    ...prediction,
                    id: docSnapshot.id
                } as BettingPrediction);
            }
        });

        const totalPredictions = tennisPredictions.length + tableTennisPredictions.length;
        progressCallback?.(`Found ${totalPredictions} predictions to migrate`, 10);

        // Migrate tennis predictions
        await migrateCollection(tennisPredictions, "tennis", progressCallback);

        // Migrate table tennis predictions
        await migrateCollection(tableTennisPredictions, "table-tennis", progressCallback);

        return {
            success: true,
            message: `Successfully migrated ${totalPredictions} predictions to sport-specific collections`
        };
    } catch (error) {
        console.error("Error migrating predictions:", error);
        return {
            success: false,
            message: `Error migrating predictions: ${error instanceof Error ? error.message : String(error)}`
        };
    }
};

/**
 * Helper function to migrate a batch of predictions to a specific collection
 */
const migrateCollection = async (
    predictions: BettingPrediction[],
    collectionName: string,
    progressCallback?: (message: string, percentComplete: number) => void
): Promise<void> => {
    const BATCH_SIZE = 250; // Firestore batch limit is 500
    const batches = Math.ceil(predictions.length / BATCH_SIZE);

    for (let i = 0; i < batches; i++) {
        const batch = writeBatch(db);
        const batchPredictions = predictions.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);

        batchPredictions.forEach((prediction) => {
            const predictionRef = doc(collection(db, collectionName));
            const predictionWithId = prediction as BettingPrediction & { id?: string };
            // Destructure and ignore the id since we're creating new documents
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { id, ...predictionData } = predictionWithId;
            batch.set(predictionRef, predictionData);
        });

        await batch.commit();

        const percentComplete = Math.round(((i + 1) / batches) * 90) + 10;
        progressCallback?.(
            `Migrated batch ${i + 1}/${batches} to ${collectionName} collection`,
            percentComplete
        );
    }
}; 