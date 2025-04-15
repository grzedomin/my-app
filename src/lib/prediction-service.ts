import { db } from "./firebase";
import { collection, query, where, getDocs } from "firebase/firestore";

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
 * Get unique dates for predictions of a specific sport type
 */
export const getPredictionDates = async (sportType: string): Promise<string[]> => {
    try {
        const q = query(
            collection(db, "predictions"),
            where("sportType", "==", sportType)
        );

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

        // Convert to array and sort (most recent dates first)
        return Array.from(uniqueDates).sort((a, b) => {
            // Parse dates for proper comparison
            const dateA = parseCustomDate(a);
            const dateB = parseCustomDate(b);

            if (dateA && dateB) {
                return dateB.getTime() - dateA.getTime();
            }

            // Fallback to string comparison if parsing fails
            return b.localeCompare(a);
        });
    } catch (error) {
        console.error("Error fetching prediction dates:", error);
        throw error;
    }
};

/**
 * Helper function to parse dates in the format "10th Apr 2025"
 */
const parseCustomDate = (dateStr: string): Date | null => {
    try {
        const match = dateStr.match(/(\d+)(?:st|nd|rd|th)\s+([A-Za-z]+)\s+(\d{4})/);
        if (!match) return null;

        const day = parseInt(match[1], 10);
        const month = getMonthIndex(match[2]);
        const year = parseInt(match[3], 10);

        if (isNaN(day) || month === -1 || isNaN(year)) return null;

        return new Date(year, month, day);
    } catch (e) {
        console.error("Error parsing date:", e);
        return null;
    }
};

/**
 * Helper function to get month index from name
 */
const getMonthIndex = (monthName: string): number => {
    const months = [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun",
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
    ];

    // Look for the month abbreviation in the list
    for (let i = 0; i < months.length; i++) {
        if (monthName.startsWith(months[i])) {
            return i;
        }
    }

    return -1; // Not found
};

/**
 * Get predictions by sport type
 */
export const getPredictionsBySportType = async (sportType: string): Promise<BettingPrediction[]> => {
    try {
        const q = query(
            collection(db, "predictions"),
            where("sportType", "==", sportType)
        );

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
        const q = query(
            collection(db, "predictions"),
            where("sportType", "==", sportType)
        );

        const querySnapshot = await getDocs(q);
        const predictions: BettingPrediction[] = [];
        const teamPairs = new Set<string>(); // Track unique team pairs to avoid duplicates

        // Check if our date is a tournament name
        const isDateFormat = /^\d+(?:st|nd|rd|th)\s+[A-Za-z]+\s+\d{4}$/.test(date);

        // Filter predictions based on the date pattern
        querySnapshot.forEach((doc) => {
            const prediction = doc.data() as BettingPrediction;

            // Skip entries that are just tournament names without team data
            const isTournamentOnly = !prediction.team1 || !prediction.team2 ||
                (prediction.team1.trim() === "" && prediction.team2.trim() === "");
            if (isTournamentOnly) {
                return;
            }

            if (prediction.date) {
                let shouldInclude = false;

                if (isDateFormat) {
                    // If we're filtering by a standard date format
                    // Extract the date pattern like "10th Apr 2025"
                    const dateMatch = prediction.date.match(/(\d+(?:st|nd|rd|th)\s+[A-Za-z]+\s+\d{4})/);
                    const extractedDate = dateMatch && dateMatch[1] ? dateMatch[1].trim() : null;

                    shouldInclude = (
                        (extractedDate && extractedDate === date) ||
                        (prediction.standardDate && prediction.standardDate === date) ||
                        // If date has time component, check if the date part matches
                        (prediction.date.includes(date))
                    );
                } else {
                    // If we're filtering by what might be a tournament name
                    // Case-insensitive includes check in both directions
                    shouldInclude = (
                        prediction.date.toLowerCase().includes(date.toLowerCase()) ||
                        date.toLowerCase().includes(prediction.date.toLowerCase())
                    );
                }

                if (shouldInclude) {
                    // Create a unique key based on both team names to identify duplicates
                    const teamKey = `${prediction.team1.toLowerCase()}-${prediction.team2.toLowerCase()}`;

                    // Only add if we haven't seen this team pair before
                    if (!teamPairs.has(teamKey)) {
                        teamPairs.add(teamKey);
                        predictions.push(prediction);
                    }
                }
            }
        });

        // Sort predictions by team names for consistency
        return predictions.sort((a, b) => a.team1.localeCompare(b.team1));
    } catch (error) {
        console.error("Error fetching predictions by date:", error);
        throw error;
    }
}; 