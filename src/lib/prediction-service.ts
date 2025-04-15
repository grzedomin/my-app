import { db } from "./firebase";
import { collection, query, getDocs, limit, startAfter, orderBy, doc, getDoc, where } from "firebase/firestore";

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
 * Get predictions by sport type with pagination
 */
export const getPredictionsBySportType = async (
    sportType: string,
    pageSize: number = 20,
    lastDocId?: string
): Promise<{ predictions: BettingPrediction[], lastDocId: string | null, hasMore: boolean }> => {
    try {
        const collectionName = getSportCollection(sportType);
        let q;

        // Create a base query with ordering
        if (lastDocId) {
            // Get the last document to use as a starting point
            const lastDocRef = doc(db, collectionName, lastDocId);
            const lastDocSnap = await getDoc(lastDocRef);

            if (lastDocSnap.exists()) {
                // Create query with pagination using startAfter
                q = query(
                    collection(db, collectionName),
                    // First by standardDate for consistent date ordering
                    orderBy("standardDate", "desc"),
                    // Then by date field which may contain time information
                    orderBy("date", "asc"),
                    startAfter(lastDocSnap),
                    limit(pageSize)
                );
            } else {
                // If last document doesn't exist, start from beginning
                q = query(
                    collection(db, collectionName),
                    orderBy("standardDate", "desc"),
                    orderBy("date", "asc"),
                    limit(pageSize)
                );
            }
        } else {
            // First page query
            q = query(
                collection(db, collectionName),
                orderBy("standardDate", "desc"),
                orderBy("date", "asc"),
                limit(pageSize)
            );
        }

        const querySnapshot = await getDocs(q);
        const predictions: BettingPrediction[] = [];
        const teamPairs = new Set<string>(); // Track unique team pairs to avoid duplicates
        let newLastDocId: string | null = null;

        querySnapshot.forEach((doc) => {
            // Store the last document ID for next pagination
            newLastDocId = doc.id;

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

        // Determine if there are more results available
        const hasMore = querySnapshot.size >= pageSize;

        return {
            predictions,
            lastDocId: newLastDocId,
            hasMore
        };
    } catch (error) {
        console.error("Error fetching predictions by sport type:", error);
        throw error;
    }
};

/**
 * Get predictions by date and sport type with pagination
 */
export const getPredictionsByDate = async (
    date: string,
    sportType: string,
    pageSize: number = 20,
    lastDocId?: string
): Promise<{ predictions: BettingPrediction[], lastDocId: string | null, hasMore: boolean }> => {
    try {
        const collectionName = getSportCollection(sportType);
        let q;

        // For date filtering we have two approaches:
        // 1. If using standardDate field which is exact, we can use a where clause
        // 2. For text search in date field, we need to query and filter client-side

        // Try the more efficient approach with standardDate field first
        if (lastDocId) {
            // Get the last document to use as a starting point
            const lastDocRef = doc(db, collectionName, lastDocId);
            const lastDocSnap = await getDoc(lastDocRef);

            if (lastDocSnap.exists()) {
                q = query(
                    collection(db, collectionName),
                    where("standardDate", "==", date),
                    orderBy("date", "asc"), // Order by time (contained in date field)
                    startAfter(lastDocSnap),
                    limit(pageSize)
                );
            } else {
                q = query(
                    collection(db, collectionName),
                    where("standardDate", "==", date),
                    orderBy("date", "asc"),
                    limit(pageSize)
                );
            }
        } else {
            q = query(
                collection(db, collectionName),
                where("standardDate", "==", date),
                orderBy("date", "asc"),
                limit(pageSize)
            );
        }

        let querySnapshot = await getDocs(q);

        // If no results with standardDate, try getting all and filtering manually
        if (querySnapshot.empty) {
            if (lastDocId) {
                const lastDocRef = doc(db, collectionName, lastDocId);
                const lastDocSnap = await getDoc(lastDocRef);

                if (lastDocSnap.exists()) {
                    q = query(
                        collection(db, collectionName),
                        orderBy("date", "asc"),
                        startAfter(lastDocSnap),
                        limit(pageSize * 5) // Get more to account for filtering
                    );
                } else {
                    q = query(
                        collection(db, collectionName),
                        orderBy("date", "asc"),
                        limit(pageSize * 5)
                    );
                }
            } else {
                q = query(
                    collection(db, collectionName),
                    orderBy("date", "asc"),
                    limit(pageSize * 5)
                );
            }

            querySnapshot = await getDocs(q);
        }

        const predictions: BettingPrediction[] = [];
        const teamPairs = new Set<string>(); // Track unique team pairs to avoid duplicates
        let newLastDocId: string | null = null;
        let documentsProcessed = 0;

        // Process until we get pageSize matches or run out of documents
        for (const docSnap of querySnapshot.docs) {
            documentsProcessed++;
            newLastDocId = docSnap.id;

            const prediction = docSnap.data() as BettingPrediction;

            // Skip entries that are just tournament names without team data
            const isTournamentOnly = !prediction.team1 || !prediction.team2 ||
                (prediction.team1.trim() === "" && prediction.team2.trim() === "");
            if (isTournamentOnly) {
                continue;
            }

            // Match by date (only needed for the non-standardDate approach):
            // 1. Check if the prediction's date contains our target date
            // 2. Or check if standardDate matches exactly
            const dateMatches =
                (prediction.standardDate && prediction.standardDate === date) ||
                (prediction.date && prediction.date.includes(date));

            if (dateMatches) {
                // Create a unique key based on both team names to identify duplicates
                const teamKey = `${prediction.team1.toLowerCase()}-${prediction.team2.toLowerCase()}`;

                // Only add if we haven't seen this team pair before
                if (!teamPairs.has(teamKey)) {
                    teamPairs.add(teamKey);
                    predictions.push(prediction);

                    // Stop once we have enough predictions
                    if (predictions.length >= pageSize) {
                        break;
                    }
                }
            }
        }

        // Sort predictions by time before returning
        const sortedPredictions = sortPredictionsByTime(predictions);

        // Determine if there are more results available
        const hasMore = documentsProcessed === querySnapshot.size && querySnapshot.size >= pageSize;

        return {
            predictions: sortedPredictions,
            lastDocId: newLastDocId,
            hasMore
        };
    } catch (error) {
        console.error("Error fetching predictions by date:", error);
        throw error;
    }
};

// Helper function to extract time from a date string
const extractTimeFromDate = (dateStr: string | undefined): string => {
    if (!dateStr) return "";

    // Try to extract time in format HH:MM EDT or similar
    const timeMatch = dateStr.match(/(\d{2}:\d{2}(?:\s*[A-Z]{3,4})?)/);
    if (timeMatch && timeMatch[1]) {
        return timeMatch[1].trim();
    }

    return "";
};

// Helper function to convert time string to minutes for sorting
const timeStringToMinutes = (timeStr: string | undefined): number => {
    if (!timeStr) return Number.MAX_SAFE_INTEGER; // Put items without time at the end

    // Try to extract time in format HH:MM EDT or similar
    const timeMatch = timeStr.match(/(\d{2}):(\d{2})(?:\s*[A-Z]{3,4})?/);
    if (timeMatch && timeMatch[1] && timeMatch[2]) {
        const hours = parseInt(timeMatch[1], 10);
        const minutes = parseInt(timeMatch[2], 10);
        return hours * 60 + minutes;
    }

    return Number.MAX_SAFE_INTEGER;
};

// Helper function to sort predictions by time
const sortPredictionsByTime = (predictions: BettingPrediction[]): BettingPrediction[] => {
    return [...predictions].sort((a, b) => {
        const timeA = extractTimeFromDate(a.date);
        const timeB = extractTimeFromDate(b.date);

        const minutesA = timeStringToMinutes(timeA);
        const minutesB = timeStringToMinutes(timeB);

        return minutesA - minutesB;
    });
}; 