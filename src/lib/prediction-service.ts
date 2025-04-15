import { db } from "./firebase";
import { collection, query, getDocs } from "firebase/firestore";

export interface BettingPrediction {
    date: string;
    team1: string;
    oddTeam1: number;
    team2: string;
    oddTeam2: number;
    scorePrediction: string;
    confidence: number;
    bettingPredictionTeam1Win: number;
    bettingPredictionTeam2Win: number;
    finalScore: string;
    sportType: string;
    standardDate?: string;
    fileId?: string;
    sourceFile?: string;
}

/**
 * Get collection name based on sport type
 */
const getSportCollection = (sportType: string): string => {
    // Normalize sport type to ensure consistency
    const normalizedType = sportType.toLowerCase().trim();

    // Map sport type to collection name
    if (normalizedType === "table-tennis" || normalizedType === "table tennis") {
        return "table-tennis";
    }

    // Default to tennis for any other value
    return "tennis";
};

/**
 * Get unique dates for predictions of a specific sport type
 */
export const getPredictionDates = async (sportType: string): Promise<string[]> => {
    try {
        const collectionName = getSportCollection(sportType);
        const q = query(collection(db, collectionName));

        const querySnapshot = await getDocs(q);

        // Extract unique dates, filtering out tournament descriptions
        const uniqueDates = new Set<string>();

        // Strict regex for valid date format: "10th Apr 2025"
        const validDatePattern = /^\d+(?:st|nd|rd|th)\s+[A-Za-z]+\s+\d{4}$/;

        // Process all predictions
        querySnapshot.forEach((doc) => {
            const prediction = doc.data() as BettingPrediction;
            if (prediction.date) {
                // Try to extract standard date format like "10th Apr 2025"
                const dateMatch = prediction.date.match(/(\d+(?:st|nd|rd|th)\s+[A-Za-z]+\s+\d{4})/);

                if (dateMatch && dateMatch[1]) {
                    // Clean and standardize date format to prevent duplicates with different spacing
                    const cleanDate = dateMatch[1].trim().replace(/\s+/g, " ");

                    // Only add if it fully matches our date pattern
                    if (validDatePattern.test(cleanDate)) {
                        uniqueDates.add(cleanDate);
                    }
                } else if (prediction.standardDate && validDatePattern.test(prediction.standardDate.trim())) {
                    // Use standardDate as fallback if it exists and matches pattern
                    uniqueDates.add(prediction.standardDate.trim());
                }

                // Skip anything that doesn't match the pattern
            }
        });

        // Convert set to array and sort dates in descending order (most recent first)
        return Array.from(uniqueDates).sort((a, b) => {
            // Convert date strings to comparable values for sorting
            const dateA = new Date(a.replace(/(\d+)(?:st|nd|rd|th)/, "$1"));
            const dateB = new Date(b.replace(/(\d+)(?:st|nd|rd|th)/, "$1"));
            return dateB.getTime() - dateA.getTime();
        });
    } catch (error) {
        console.error("Error fetching prediction dates:", error);
        throw error;
    }
};

/**
 * Get predictions by sport type
 */
export const getPredictionsBySportType = async (sportType: string): Promise<BettingPrediction[]> => {
    try {
        const collectionName = getSportCollection(sportType);
        const q = query(collection(db, collectionName));

        const querySnapshot = await getDocs(q);
        const predictions: BettingPrediction[] = [];
        const teamPairs = new Set<string>(); // Track unique team pairs to avoid duplicates

        querySnapshot.forEach((doc) => {
            const prediction = doc.data() as BettingPrediction;

            // Skip entries that are just tournament names without team data
            const isTournamentOnly = !prediction.team1 || !prediction.team2 ||
                (prediction.team1.trim() === "" && prediction.team2.trim() === "");
            if (isTournamentOnly) {
                return;
            }

            // Create a unique key based on both team names to identify duplicates
            const teamKey = `${prediction.team1.toLowerCase()}-${prediction.team2.toLowerCase()}`;

            // Only add if we haven't seen this team pair before
            if (!teamPairs.has(teamKey)) {
                teamPairs.add(teamKey);
                predictions.push(prediction);
            }
        });

        return predictions;
    } catch (error) {
        console.error("Error fetching predictions by sport type:", error);
        throw error;
    }
};

/**
 * Get predictions by date and sport type
 */
export const getPredictionsByDate = async (date: string, sportType: string): Promise<BettingPrediction[]> => {
    try {
        // Get all predictions for this sport type
        const collectionName = getSportCollection(sportType);
        const q = query(collection(db, collectionName));

        const querySnapshot = await getDocs(q);
        const predictions: BettingPrediction[] = [];
        const teamPairs = new Set<string>(); // Track unique team pairs to avoid duplicates

        // Filter predictions based on the date pattern
        querySnapshot.forEach((doc) => {
            const prediction = doc.data() as BettingPrediction;

            // Skip entries that are just tournament names without team data
            const isTournamentOnly = !prediction.team1 || !prediction.team2 ||
                (prediction.team1.trim() === "" && prediction.team2.trim() === "");
            if (isTournamentOnly) {
                return;
            }

            // Match by date:
            // 1. Check if the prediction's date contains our target date
            // 2. Or check if standardDate matches exactly
            const dateMatches =
                (prediction.date && prediction.date.includes(date)) ||
                (prediction.standardDate && prediction.standardDate === date);

            if (dateMatches) {
                // Create a unique key based on both team names to identify duplicates
                const teamKey = `${prediction.team1.toLowerCase()}-${prediction.team2.toLowerCase()}`;

                // Only add if we haven't seen this team pair before
                if (!teamPairs.has(teamKey)) {
                    teamPairs.add(teamKey);
                    predictions.push(prediction);
                }
            }
        });

        return predictions;
    } catch (error) {
        console.error("Error fetching predictions by date:", error);
        throw error;
    }
}; 