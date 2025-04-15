import { useState, useEffect } from "react";
import { BettingPrediction } from "@/lib/prediction-service";

/**
 * Custom hook for fetching tennis/table-tennis match data by date
 * from a sports API and managing local data caching
 */

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

// Define type for cached data
interface CachedApiData {
    data: ApiResponse[];
    timestamp: number;
    formattedDate: string;
    sportType: string;
}

// Cache settings
const CACHE_EXPIRATION_TIME = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
const CACHE_KEY_PREFIX = "matches_"; // Generic prefix for all matches
const OLD_TENNIS_KEY_PREFIX = "tennis_matches_"; // Old prefix for backward compatibility

// Function to migrate old cache format to new format (one-time migration)
const migrateOldCache = (): void => {
    try {
        // Check if migration has already been done
        if (localStorage.getItem("cache_migration_done") === "true") {
            return;
        }

        console.log("Starting cache migration from old format to new format...");
        // Get all keys
        const keysToMigrate = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(OLD_TENNIS_KEY_PREFIX)) {
                keysToMigrate.push(key);
            }
        }

        if (keysToMigrate.length === 0) {
            console.log("No old cache entries to migrate");
            localStorage.setItem("cache_migration_done", "true");
            return;
        }

        // Migrate each old key
        keysToMigrate.forEach(oldKey => {
            try {
                const cachedDataString = localStorage.getItem(oldKey);
                if (cachedDataString) {
                    const cachedData = JSON.parse(cachedDataString);

                    // Add sport type to the cached data
                    cachedData.sportType = "tennis";

                    // Extract date from old key
                    const dateStr = oldKey.replace(OLD_TENNIS_KEY_PREFIX, "");

                    // Save to new format
                    const newKey = getCacheKey("tennis", dateStr);
                    localStorage.setItem(newKey, JSON.stringify(cachedData));

                    // Remove old entry
                    localStorage.removeItem(oldKey);
                    console.log(`Migrated cache: ${oldKey} -> ${newKey}`);
                }
            } catch (error) {
                console.error(`Error migrating cache entry ${oldKey}:`, error);
            }
        });

        localStorage.setItem("cache_migration_done", "true");
        console.log("Cache migration completed");
    } catch (error) {
        console.error("Error during cache migration:", error);
    }
};

// Function to get cache key for a specific date and sport type
const getCacheKey = (sportType: string, formattedDate: string): string => {
    return `${CACHE_KEY_PREFIX}${sportType}_${formattedDate}`;
};

// Function to save data to cache
const saveToCache = (sportType: string, formattedDate: string, data: ApiResponse[]): void => {
    try {
        const cacheData: CachedApiData = {
            data,
            timestamp: Date.now(),
            formattedDate,
            sportType
        };
        localStorage.setItem(getCacheKey(sportType, formattedDate), JSON.stringify(cacheData));
        console.log(`Saved ${sportType} match data to cache for date: ${formattedDate}`);
    } catch (error) {
        console.error("Error saving to cache:", error);
        // If there's an error (e.g., localStorage is full), try to clear old caches
        clearOldCaches();
    }
};

// Function to get data from cache
const getFromCache = (sportType: string, formattedDate: string): ApiResponse[] | null => {
    try {
        const cachedDataString = localStorage.getItem(getCacheKey(sportType, formattedDate));
        if (!cachedDataString) return null;

        const cachedData: CachedApiData = JSON.parse(cachedDataString);

        // Check if cache is expired
        if (Date.now() - cachedData.timestamp > CACHE_EXPIRATION_TIME) {
            console.log(`Cache for ${formattedDate} (${sportType}) is expired, removing...`);
            localStorage.removeItem(getCacheKey(sportType, formattedDate));
            return null;
        }

        console.log(`Using cached ${sportType} match data for date: ${formattedDate}`);
        return cachedData.data;
    } catch (error) {
        console.error("Error reading from cache:", error);
        return null;
    }
};

// Function to clear old caches to free up space
const clearOldCaches = (): void => {
    try {
        // Get all keys
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if ((key && key.startsWith(CACHE_KEY_PREFIX)) ||
                (key && key.startsWith(OLD_TENNIS_KEY_PREFIX))) {
                try {
                    const cachedDataString = localStorage.getItem(key);
                    if (cachedDataString) {
                        const cachedData: CachedApiData = JSON.parse(cachedDataString);
                        // Remove if older than cache expiration time
                        if (Date.now() - cachedData.timestamp > CACHE_EXPIRATION_TIME) {
                            localStorage.removeItem(key);
                            console.log(`Removed expired cache: ${key}`);
                        }
                    }
                } catch {
                    // If item can't be parsed, just remove it
                    localStorage.removeItem(key);
                }
            }
        }
    } catch (error) {
        console.error("Error clearing old caches:", error);
    }
};

// Helper function for extracting name parts (handle abbreviated names)
const extractNameParts = (name: string): { firstName: string; lastName: string; initials: string } => {
    // Remove any extra spaces and split by spaces
    const parts = name.trim().replace(/\s+/g, " ").split(" ");

    // Default values
    let firstName = "";
    let lastName = "";
    let initials = "";

    if (parts.length === 1) {
        // Single name (probably last name)
        lastName = parts[0];
        initials = lastName.charAt(0);
    } else if (parts.length >= 2) {
        // Check for initials patterns like "F." or "F"
        const isFirstPartInitial = /^[A-Z]\.?$/.test(parts[0]);
        const isLastPartInitial = /^[A-Z]\.?$/.test(parts[parts.length - 1]);

        if (isFirstPartInitial) {
            // Format: "F. Lastname"
            firstName = parts[0].replace(".", "");
            lastName = parts.slice(1).join(" ");
        } else if (isLastPartInitial) {
            // Format: "Lastname F."
            lastName = parts.slice(0, parts.length - 1).join(" ");
            firstName = parts[parts.length - 1].replace(".", "");
        } else {
            // Format: "Firstname Lastname" or other
            firstName = parts[0];
            lastName = parts.slice(1).join(" ");
        }

        // Get initials from both first and last name
        initials = firstName.charAt(0) + lastName.charAt(0);
    }

    return {
        firstName: firstName.toLowerCase(),
        lastName: lastName.toLowerCase(),
        initials: initials.toLowerCase()
    };
};

interface MatchesByDateResult {
    isLoading: boolean;
    error: string | null;
    apiPlayerNames: string[];
    apiMatchScores: Map<string, string>;
    apiMatchSetScores: Map<string, { homeTeam: { set1: number; set2: number; }; awayTeam: { set1: number; set2: number; }; }>;
    findBestPlayerMatch: (excelName: string) => string;
}

/**
 * Custom hook to fetch and process tennis and table tennis matches by date
 * This is a lightweight version that only loads API data for the needed records
 */
export const useMatchesByDate = (
    selectedDate: string,
    sportType: string = "tennis", // Default to tennis if not specified
    predictions: BettingPrediction[] = [] // This will be the currently visible predictions only
): MatchesByDateResult => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [apiPlayerNames, setApiPlayerNames] = useState<string[]>([]);
    const [apiMatchScores, setApiMatchScores] = useState<Map<string, string>>(new Map());
    const [apiMatchSetScores, setApiMatchSetScores] = useState<Map<string, { homeTeam: { set1: number; set2: number; }; awayTeam: { set1: number; set2: number; }; }>>(new Map());
    const [bestMatchFinder, setBestMatchFinder] = useState<(excelName: string) => string>(() => (name: string) => name);

    // Migrate old cache format on first render
    useEffect(() => {
        migrateOldCache();
    }, []);

    // Function to convert date format from "10th Apr 2025" to "2025-04-10"
    const convertDateFormat = (dateStr: string): string => {
        if (!dateStr) return dateStr;

        // Pattern for dates like "10th Apr 2025"
        const datePattern = /(\d+)(?:st|nd|rd|th)\s+([A-Za-z]+)\s+(\d{4})/;
        const match = dateStr.match(datePattern);

        if (!match) return dateStr; // Return original if not matching the expected format

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
    };

    // Effect hook that fetches data when selectedDate or predictions change
    useEffect(() => {
        // Skip fetch if no date or predictions
        if (!selectedDate || predictions.length === 0) {
            return;
        }

        // Local function to process API data
        const processApiData = (matches: ApiMatch[]) => {
            // Process the matches from API
            const matchNames: string[] = [];
            const matchScores: Map<string, string> = new Map();
            const matchSetScores: Map<string, { homeTeam: { set1: number; set2: number; }; awayTeam: { set1: number; set2: number; }; }> = new Map();

            // Function to find the best player match in the API data
            const bestMatchFinder = (excelName: string): string => {
                if (!excelName) return "";

                // Function to normalize names for comparison
                const normalizeName = (name: string): string => {
                    return name.toLowerCase().replace(/[^a-z0-9]/g, "");
                };

                // Special case: if the excel name is already in the list, return it
                const normalizedExcelName = normalizeName(excelName);
                if (matchNames.includes(normalizedExcelName)) {
                    return normalizedExcelName;
                }

                // Extract all parts of player name from Excel
                const excelParts = extractNameParts(excelName);

                let bestMatch = "";
                let bestScore = 0;

                // Check each API player name for matches
                for (const apiName of matchNames) {
                    const apiParts = extractNameParts(apiName);

                    // Calculate match score - higher is better
                    let score = 0;

                    // Full match gives highest score
                    if (normalizeName(apiName) === normalizedExcelName) {
                        score += 100;
                    }

                    // Last name matches
                    if (apiParts.lastName.toLowerCase() === excelParts.lastName.toLowerCase()) {
                        score += 40;
                    } else if (apiParts.lastName.toLowerCase().includes(excelParts.lastName.toLowerCase()) ||
                        excelParts.lastName.toLowerCase().includes(apiParts.lastName.toLowerCase())) {
                        // Partial last name match
                        score += 20;
                    }

                    // First name or initials match
                    if (apiParts.firstName.toLowerCase() === excelParts.firstName.toLowerCase()) {
                        score += 30;
                    } else if (apiParts.firstName.toLowerCase().includes(excelParts.firstName.toLowerCase()) ||
                        excelParts.firstName.toLowerCase().includes(apiParts.firstName.toLowerCase())) {
                        // Partial first name match
                        score += 15;
                    }

                    // Check initials match
                    if (apiParts.initials === excelParts.initials) {
                        score += 20;
                    }

                    // Update best match if we found a better one
                    if (score > bestScore) {
                        bestScore = score;
                        bestMatch = apiName;
                    }
                }

                // Only return a match if the score is above a threshold
                return bestScore >= 20 ? bestMatch : "";
            };

            // Process the matches from the API
            for (const match of matches) {
                if (match.home_team_name && match.away_team_name) {
                    // Add to player name list
                    matchNames.push(match.home_team_name);
                    matchNames.push(match.away_team_name);

                    // Store match score if available
                    if (match.home_team_score !== undefined && match.away_team_score !== undefined) {
                        const scoreKey = `${match.home_team_name} vs ${match.away_team_name}`;
                        const scoreValue = `${match.home_team_score}-${match.away_team_score}`;
                        matchScores.set(scoreKey, scoreValue);
                    }

                    // Store set scores if available
                    if (match.home_team_period_1_score !== undefined && match.home_team_period_2_score !== undefined &&
                        match.away_team_period_1_score !== undefined && match.away_team_period_2_score !== undefined) {
                        const matchKey = `${match.home_team_name} vs ${match.away_team_name}`;
                        matchSetScores.set(matchKey, {
                            homeTeam: {
                                set1: match.home_team_period_1_score,
                                set2: match.home_team_period_2_score
                            },
                            awayTeam: {
                                set1: match.away_team_period_1_score,
                                set2: match.away_team_period_2_score
                            }
                        });
                    }
                }
            }

            // Update state with processed data
            setApiPlayerNames(matchNames);
            setApiMatchScores(matchScores);
            setApiMatchSetScores(matchSetScores);
            setBestMatchFinder(() => bestMatchFinder);
        };

        const fetchData = async () => {
            setIsLoading(true);
            setError(null);

            try {
                // Convert the date format for API call
                const formattedDate = convertDateFormat(selectedDate);

                // Check if we have cached data for this date and sport type
                const cachedData = getFromCache(sportType, formattedDate);

                if (cachedData) {
                    // Use cached data
                    if (cachedData[0] && cachedData[0].matches) {
                        processApiData(cachedData[0].matches);
                    } else {
                        // Handle empty cache case
                        setApiPlayerNames([]);
                        setApiMatchScores(new Map());
                        setApiMatchSetScores(new Map());
                    }
                } else {
                    // No cached data, fetch from API
                    console.log(`Fetching ${sportType} match data from API for date: ${formattedDate}`);

                    // Use the formatted date for the API call
                    const data = await fetch(`https://tennis.sportdevs.com/matches-by-date?date=eq.${formattedDate}`, {
                        headers: {
                            "Authorization": "Bearer tCVJTtqriU-z9QO5LpwZlQ"
                        }
                    });

                    const json = await data.json() as ApiResponse[];

                    // Save to cache for future use
                    saveToCache(sportType, formattedDate, json);

                    // Handle no matches case
                    if (!json[0] || !json[0].matches) {
                        setApiPlayerNames([]);
                        setApiMatchScores(new Map());
                        setApiMatchSetScores(new Map());
                        setIsLoading(false);
                        return;
                    }

                    // Process the fetched data
                    processApiData(json[0].matches);
                }
            } catch (err) {
                console.error(`Error fetching ${sportType} matches:`, err);
                setError(`Failed to fetch ${sportType} matches. Please try again later.`);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [selectedDate, predictions, sportType]);

    return {
        isLoading,
        error,
        apiPlayerNames,
        apiMatchScores,
        apiMatchSetScores,
        findBestPlayerMatch: bestMatchFinder
    };
}; 