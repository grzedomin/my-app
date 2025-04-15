import { useQuery } from "@tanstack/react-query";
import Fuse from "fuse.js";

// Define a type for the API match data
interface ApiMatch {
    home_team_name: string;
    away_team_name: string;
    name?: string;
    status?: string;
    start_time?: string;
    league_name?: string;
    season_name?: string;
    id?: string | number;
    tournament_id?: string | number;
    league_id?: string | number;
    home_team_score?: number;
    away_team_score?: number;
    home_team_period_1_score?: number;
    home_team_period_2_score?: number;
    away_team_period_1_score?: number;
    away_team_period_2_score?: number;
    home_team_id?: string | number;
    away_team_id?: string | number;
    home_team_hash_image?: string;
    away_team_hash_image?: string;
}

// Define a type for the API response
interface ApiResponse {
    matches: ApiMatch[];
    [key: string]: unknown;
}

// Helper function for extracting name parts (handle abbreviated names)
const extractNameParts = (name: string): { firstName: string; lastName: string; initials: string } => {
    // Remove any extra spaces and split by spaces
    const parts = name.trim().replace(/\s+/g, " ").split(" ");

    // Default values
    let firstName = "";
    let lastName = "";
    let initials = "";

    if (parts.length === 1) {
        // Only one name part (treat as last name)
        lastName = parts[0];
        initials = parts[0].charAt(0).toUpperCase();
    } else if (parts.length === 2) {
        // Standard First Last format
        firstName = parts[0];
        lastName = parts[1];
        initials = firstName.charAt(0).toUpperCase() + lastName.charAt(0).toUpperCase();
    } else if (parts.length > 2) {
        // Assume first name is first part, last name is last part
        firstName = parts.slice(0, parts.length - 1).join(" ");
        lastName = parts[parts.length - 1];
        // Get first letter of first name and first letter of last name
        initials = firstName.charAt(0).toUpperCase() + lastName.charAt(0).toUpperCase();
    }

    return { firstName, lastName, initials };
};

// Convert date format from "10th Apr 2025" to "2025-04-10"
const convertDateFormat = (dateStr: string): string => {
    if (!dateStr) return dateStr;

    // Pattern for dates like "10th Apr 2025"
    const datePattern = /(\d+)(?:st|nd|rd|th)\s+([A-Za-z]+)\s+(\d{4})/;
    const match = dateStr.match(datePattern);

    if (match) {
        const day = match[1].padStart(2, "0"); // Pad single digit days with leading zero
        const monthStr = match[2];
        const year = match[3];

        // Map month names to numbers
        const monthMap: { [key: string]: string } = {
            "Jan": "01", "Feb": "02", "Mar": "03", "Apr": "04", "May": "05", "Jun": "06",
            "Jul": "07", "Aug": "08", "Sep": "09", "Oct": "10", "Nov": "11", "Dec": "12"
        };

        const month = monthMap[monthStr.substring(0, 3)] || "01";

        return `${year}-${month}-${day}`;
    }

    // Check if date is already in proper format or needs conversion
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        return dateStr; // Already in YYYY-MM-DD format
    } else if (/^\d{2}-\d{2}-\d{4}$/.test(dateStr)) {
        // Convert from DD-MM-YYYY to YYYY-MM-DD
        const [day, month, year] = dateStr.split("-");
        return `${year}-${month}-${day}`;
    } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
        // Convert from DD/MM/YYYY to YYYY-MM-DD
        const [day, month, year] = dateStr.split("/");
        return `${year}-${month}-${day}`;
    }

    // For other formats, just return as is
    return dateStr;
};

// Query keys
const matchesKeys = {
    all: ["matches"] as const,
    date: (date: string, sportType: string) =>
        [...matchesKeys.all, date, sportType] as const,
};

// Fetch data from API
const fetchMatchesByDate = async (formattedDate: string, sportType: string): Promise<ApiResponse[]> => {
    try {
        // Use the sportdevs endpoint with the same authorization token for both tennis and table tennis
        const endpoint = `https://tennis.sportdevs.com/matches-by-date?date=eq.${formattedDate}`;

        console.log(`Fetching ${sportType} data for ${formattedDate} from API...`);

        // Fetch data from API with authorization token
        const response = await fetch(endpoint, {
            headers: {
                "Authorization": "Bearer tCVJTtqriU-z9QO5LpwZlQ"
            }
        });

        if (!response.ok) {
            console.error(`API request failed with status ${response.status}`);
            // Return empty data instead of throwing
            return [{ matches: [] }];
        }

        const apiData = await response.json() as ApiResponse[];
        return apiData;
    } catch (error) {
        console.error("Error fetching data:", error);
        // Return empty data instead of throwing
        return [{ matches: [] }];
    }
};

// Define a type for the findBestPlayerMatch function
type FindBestPlayerMatchFn = (excelName: string) => string;

// Define serializable versions of the data types
interface MatchScores {
    [key: string]: string;
}

interface MatchSetScores {
    [key: string]: {
        homeTeam: { set1: number; set2: number; };
        awayTeam: { set1: number; set2: number; };
    };
}

// Process API data and provide utilities for matching player names
const processMatchData = (matches: ApiMatch[] = []) => {
    // Create array of unique names
    const apiPlayerNames: string[] = [];

    // Use objects instead of Maps for better serializability
    const scoresObj: MatchScores = {};
    const setScoresObj: MatchSetScores = {};

    // Extract player names and scores
    matches.forEach(match => {
        if (match.home_team_name && match.away_team_name) {
            if (!apiPlayerNames.includes(match.home_team_name)) {
                apiPlayerNames.push(match.home_team_name);
            }
            if (!apiPlayerNames.includes(match.away_team_name)) {
                apiPlayerNames.push(match.away_team_name);
            }

            // Store scores
            const matchKey = `${match.home_team_name} vs ${match.away_team_name}`;

            if (match.home_team_score !== undefined && match.away_team_score !== undefined) {
                scoresObj[matchKey] = `${match.home_team_score}-${match.away_team_score}`;
            }

            // Store set scores if available
            if (match.home_team_period_1_score !== undefined &&
                match.home_team_period_2_score !== undefined &&
                match.away_team_period_1_score !== undefined &&
                match.away_team_period_2_score !== undefined) {
                setScoresObj[matchKey] = {
                    homeTeam: {
                        set1: match.home_team_period_1_score,
                        set2: match.home_team_period_2_score
                    },
                    awayTeam: {
                        set1: match.away_team_period_1_score,
                        set2: match.away_team_period_2_score
                    }
                };
            }
        }
    });

    // Create Fuse instance
    const fuseOptions = {
        includeScore: true,
        threshold: 0.4,
        keys: ["name"]
    };

    // Create Fuse instance
    const fuse = new Fuse(apiPlayerNames.map(name => ({ name })), fuseOptions);

    // Function to normalize names for better matching
    const normalizeName = (name: string): string => {
        if (!name) return "";

        // Convert to lowercase and remove punctuation
        let normalized = name.toLowerCase()
            .replace(/\./g, "")
            .replace(/\-/g, " ")
            .replace(/\s+/g, " ")
            .trim();

        // Handle common international character replacements
        normalized = normalized
            .replace(/[áàäâã]/g, "a")
            .replace(/[éèëê]/g, "e")
            .replace(/[íìïî]/g, "i")
            .replace(/[óòöôõ]/g, "o")
            .replace(/[úùüû]/g, "u")
            .replace(/[ç]/g, "c")
            .replace(/[ñ]/g, "n");

        return normalized;
    };

    // Function to find the best match for a player name
    const findBestPlayerMatch = (excelName: string): string => {
        // If empty, return empty
        if (!excelName || excelName.trim() === "") {
            return "";
        }

        // Normalize the name for comparison
        const normalizedExcelName = normalizeName(excelName);

        // If already in the list (exact match), return it
        for (const apiName of apiPlayerNames) {
            if (normalizeName(apiName) === normalizedExcelName) {
                return apiName;
            }
        }

        // Handle abbreviated name formats like "Diallo G." or "G. Diallo"
        const abbreviatedRegex = /^([A-Za-z]+)\s+([A-Z])\.?$|^([A-Z])\.?\s+([A-Za-z]+)$/;
        const abbreviatedMatch = excelName.match(abbreviatedRegex);

        if (abbreviatedMatch) {
            // Extract last name and initial
            const lastName = abbreviatedMatch[1] || abbreviatedMatch[4];
            const initial = (abbreviatedMatch[2] || abbreviatedMatch[3] || "").toUpperCase();

            if (lastName && initial) {
                // Search for API names with matching last name and initial
                for (const apiName of apiPlayerNames) {
                    const apiParts = extractNameParts(apiName);

                    // Check if last name matches and first name starts with the initial
                    if (normalizeName(apiParts.lastName).includes(normalizeName(lastName)) &&
                        apiParts.firstName.charAt(0).toUpperCase() === initial) {
                        console.log(`Matched abbreviated name: ${excelName} to ${apiName}`);
                        return apiName;
                    }

                    // Also try the reverse where initial is for last name and we match first name
                    if (normalizeName(apiParts.firstName).includes(normalizeName(lastName)) &&
                        apiParts.lastName.charAt(0).toUpperCase() === initial) {
                        console.log(`Matched reversed abbreviated name: ${excelName} to ${apiName}`);
                        return apiName;
                    }
                }
            }
        }

        // Try matching just the last name for simple cases
        const excelParts = extractNameParts(excelName);
        if (excelParts.lastName) {
            const normalizedLastName = normalizeName(excelParts.lastName);

            // Find players with matching last names
            const lastNameMatches = apiPlayerNames.filter(apiName => {
                const apiParts = extractNameParts(apiName);
                return normalizeName(apiParts.lastName).includes(normalizedLastName) ||
                    normalizedLastName.includes(normalizeName(apiParts.lastName));
            });

            // If we have exactly one match, use it
            if (lastNameMatches.length === 1) {
                console.log(`Matched by last name: ${excelName} to ${lastNameMatches[0]}`);
                return lastNameMatches[0];
            }

            // If multiple matches with same last name, try to use initials
            if (lastNameMatches.length > 1 && excelParts.firstName) {
                const firstInitial = excelParts.firstName.charAt(0).toUpperCase();

                for (const match of lastNameMatches) {
                    const matchParts = extractNameParts(match);
                    if (matchParts.firstName.charAt(0).toUpperCase() === firstInitial) {
                        console.log(`Matched by last name + first initial: ${excelName} to ${match}`);
                        return match;
                    }
                }
            }
        }

        // Use fuzzy search
        const results = fuse.search(excelName);
        if (results.length > 0 && results[0].score && results[0].score < 0.3) {
            console.log(`Matched using fuzzy search: ${excelName} to ${results[0].item.name}`);
            return results[0].item.name;
        }

        // Check initials match
        for (const apiName of apiPlayerNames) {
            const apiParts = extractNameParts(apiName);

            // Same initials and similar last name
            if (excelParts.initials === apiParts.initials &&
                normalizeName(excelParts.lastName).includes(normalizeName(apiParts.lastName).substring(0, 3))) {
                console.log(`Matched by initials + similar last name: ${excelName} to ${apiName}`);
                return apiName;
            }

            // Last name starts with same 3 letters
            if (excelParts.lastName && apiParts.lastName &&
                normalizeName(excelParts.lastName).substring(0, 3) === normalizeName(apiParts.lastName).substring(0, 3)) {
                console.log(`Matched by first 3 letters of last name: ${excelName} to ${apiName}`);
                return apiName;
            }
        }

        // No good match found
        console.log(`No match found for: ${excelName}`);
        return "";
    };

    return {
        apiPlayerNames,
        apiMatchScores: scoresObj,
        apiMatchSetScores: setScoresObj,
        findBestPlayerMatch
    };
};

// Main hook
export function useMatchesByDate(
    selectedDate: string,
    sportType: string = "tennis",
    predictions: Array<{ team1: string; team2: string; scorePrediction: string; finalScore?: string }> = []
) {
    // Convert date to the format required by the API
    const formattedDate = convertDateFormat(selectedDate);

    // Use React Query for data fetching with caching
    const { data, isLoading, error } = useQuery({
        queryKey: matchesKeys.date(formattedDate, sportType),
        queryFn: () => fetchMatchesByDate(formattedDate, sportType),
        enabled: !!selectedDate,
        staleTime: 30 * 60 * 1000, // 30 minutes before refetching
        gcTime: 60 * 60 * 1000, // 1 hour cache time
    });

    // Process data if available
    let processedData = {
        apiPlayerNames: [] as string[],
        apiMatchScores: {} as MatchScores,
        apiMatchSetScores: {} as MatchSetScores,
        findBestPlayerMatch: (() => "") as FindBestPlayerMatchFn,
    };

    if (data && data.length > 0 && data[0].matches) {
        processedData = processMatchData(data[0].matches);

        // If we have predictions, update the findBestPlayerMatch function to work with them
        if (predictions && predictions.length > 0) {
            const originalFindBestPlayerMatch = processedData.findBestPlayerMatch;

            // Update the match scores using the predictions and the matches
            predictions.forEach(prediction => {
                if (!prediction.team1 || !prediction.team2) return;

                const matchedTeam1 = originalFindBestPlayerMatch(prediction.team1);
                const matchedTeam2 = originalFindBestPlayerMatch(prediction.team2);

                if (matchedTeam1 && matchedTeam2) {
                    // Create match key - check both player orders
                    const matchKey1 = `${matchedTeam1} vs ${matchedTeam2}`;
                    const matchKey2 = `${matchedTeam2} vs ${matchedTeam1}`;

                    // Create direct keys from original prediction names
                    const directKey1 = `${prediction.team1} vs ${prediction.team2}`;

                    // If we have these matches in the API data and the match is finished,
                    // ensure the scores are filled correctly
                    if (processedData.apiMatchScores[matchKey1]) {
                        // We have a match in the correct order
                        console.log(`Found match data for ${prediction.team1} vs ${prediction.team2}: ${processedData.apiMatchScores[matchKey1]}`);

                        // Add scores for direct key access - this helps the BettingPredictionsTable get scores more reliably
                        processedData.apiMatchScores[directKey1] = processedData.apiMatchScores[matchKey1];

                        // If we have set scores, copy those too
                        if (processedData.apiMatchSetScores[matchKey1]) {
                            processedData.apiMatchSetScores[directKey1] = processedData.apiMatchSetScores[matchKey1];
                        }
                    } else if (processedData.apiMatchScores[matchKey2]) {
                        // We have a match in the reversed order
                        console.log(`Found match data for ${prediction.team2} vs ${prediction.team1}: ${processedData.apiMatchScores[matchKey2]}`);

                        // Add scores for direct key access with flipped order
                        processedData.apiMatchScores[directKey1] = processedData.apiMatchScores[matchKey2].split('-').reverse().join('-'); // Reverse score

                        // If we have set scores, copy those too but flip the home/away values
                        if (processedData.apiMatchSetScores[matchKey2]) {
                            const originalSetScores = processedData.apiMatchSetScores[matchKey2];
                            processedData.apiMatchSetScores[directKey1] = {
                                homeTeam: { ...originalSetScores.awayTeam },
                                awayTeam: { ...originalSetScores.homeTeam }
                            };
                        }
                    }

                    // Also add entries using the matchedTeam names (for BettingPredictionsTable to find)
                    if (processedData.apiMatchScores[directKey1]) {
                        // Add alternative keys to increase chances of finding a match
                        processedData.apiMatchScores[matchKey1] = processedData.apiMatchScores[directKey1];

                        // Add all possible combinations to maximize matching chances
                        processedData.apiMatchScores[`${prediction.team1} vs ${matchedTeam2}`] = processedData.apiMatchScores[directKey1];
                        processedData.apiMatchScores[`${matchedTeam1} vs ${prediction.team2}`] = processedData.apiMatchScores[directKey1];

                        // Do the same for set scores
                        if (processedData.apiMatchSetScores[directKey1]) {
                            processedData.apiMatchSetScores[matchKey1] = processedData.apiMatchSetScores[directKey1];
                            processedData.apiMatchSetScores[`${prediction.team1} vs ${matchedTeam2}`] = processedData.apiMatchSetScores[directKey1];
                            processedData.apiMatchSetScores[`${matchedTeam1} vs ${prediction.team2}`] = processedData.apiMatchSetScores[directKey1];
                        }
                    }
                }
            });
        }
    }

    return {
        isLoading,
        error: error ? (error as Error).message : null,
        ...processedData
    };
} 