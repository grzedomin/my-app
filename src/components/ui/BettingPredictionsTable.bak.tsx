import React, { useState, useEffect, useRef, useCallback } from "react";
import { PieChart } from "react-minimal-pie-chart";
import { useNotification } from "@/context/NotificationContext";
import { useSearchParams } from "next/navigation";
import { useMatchesByDate, usePaginatedMatches } from "@/hooks";
import { BettingPrediction, getPredictionDates, BetType } from "@/lib/prediction-service";
import BetTabView from "./BetTabView";

// Spinner component for loading states
const LoadMoreSpinner = () => (
    <div className="flex justify-center items-center py-4 mb-4">
        <div className="animate-spin h-8 w-8 border-3 border-blue-400 rounded-full border-t-transparent"></div>
        <span className="ml-3 text-blue-300 font-medium">Loading more data...</span>
    </div>
);

// Number of items to load at once for lazy loading
const ITEMS_PER_PAGE = 20;

// Helper function to format date display
const formatDateDisplay = (dateStr: string | undefined): string => {
    if (!dateStr) return "";

    // Extract main date part like "10th Apr 2025" from the string
    const dateMatch = dateStr.match(/(\d+(?:st|nd|rd|th)\s+[A-Za-z]+\s+\d{4})/);

    // Only return the extracted date part if found
    return dateMatch && dateMatch[1] ? dateMatch[1].trim() : "";
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

// Helper function to extract set scores from score prediction format like "2:0(6:3, 6:3)"
const extractSetScores = (scorePrediction: string): string => {
    const setScoreMatch = scorePrediction.match(/\(([^)]+)\)/);
    if (setScoreMatch && setScoreMatch[1]) {
        return setScoreMatch[1];
    }
    return "";
};

// Helper function to extract set scores from final score (similar pattern)
const extractFinalSetScores = (finalScore: string): string => {
    const setScoreMatch = finalScore.match(/\(([^)]+)\)/);
    if (setScoreMatch && setScoreMatch[1]) {
        return setScoreMatch[1];
    }
    return "";
};

// Helper function to clean final score by removing set details
const cleanFinalScore = (finalScore: string): string => {
    return finalScore.replace(/\s*\([^)]+\)/, "").trim();
};

// Cache for dates to prevent redundant Firestore queries
const datesCache: { [sportType: string]: { timestamp: number; dates: string[] } } = {};
const CACHE_EXPIRY_MS = 60 * 1000; // Cache expires after 1 minute

// Helper function to check if string is a valid date format
const isValidDateFormat = (dateStr: string): boolean => {
    // Only show items that match the "10th Apr 2025" pattern
    return /^\d+(?:st|nd|rd|th)\s+[A-Za-z]+\s+\d{4}$/.test(dateStr.trim());
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
// This function is retained for potential future use when sorting in client
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const sortPredictionsByTime = (predictions: BettingPrediction[]): BettingPrediction[] => {
    return [...predictions].sort((a, b) => {
        const timeA = extractTimeFromDate(a.date);
        const timeB = extractTimeFromDate(b.date);

        const minutesA = timeStringToMinutes(timeA);
        const minutesB = timeStringToMinutes(timeB);

        return minutesA - minutesB;
    });
};

// Helper to get "N/A" when a value is undefined, null, or empty string
const getValueOrNA = (value: string | number | null | undefined): string => {
    if (value === undefined || value === null || value === "") {
        return "N/A";
    }
    return value.toString();
};

const BettingPredictionsTable: React.FC = () => {
    const { showNotification } = useNotification();
    const searchParams = useSearchParams();
    const loaderRef = useRef<HTMLDivElement>(null);

    // Get initial sport type from URL parameters or default to tennis
    const [selectedSportType, setSelectedSportType] = useState<string>(() => {
        const sportParam = searchParams.get("sport");
        return sportParam || "tennis";
    });

    // Get initial bet type from URL parameters or default to normal
    const [selectedBetType, setSelectedBetType] = useState<BetType>(() => {
        const betTypeParam = searchParams.get("betType") as BetType | null;
        return betTypeParam || "normal";
    });

    const [selectedDate, setSelectedDate] = useState<string>("");
    const [availableDates, setAvailableDates] = useState<string[]>([]);
    const [isLoadingDates, setIsLoadingDates] = useState(false);
    const [isTableLoading, setIsTableLoading] = useState(false);
    const [loadingStatus, setLoadingStatus] = useState<string>("");
    const observer = useRef<IntersectionObserver | null>(null);
    const activeSportTypeChangeRef = useRef<string | null>(null);
    const activeBetTypeChangeRef = useRef<BetType | null>(null);

    // Use our custom paginated hook to fetch predictions
    const {
        predictions: displayedPredictions,
        isLoading,
        error: fetchError,
        loadMore,
        hasMore,
        isLoadingMore
    } = usePaginatedMatches(selectedDate, selectedSportType, ITEMS_PER_PAGE, selectedBetType);

    // Use our matches hook to fetch match data for the currently displayed predictions only
    const {
        error: matchesError,
        apiMatchScores,
        apiMatchSetScores,
        findBestPlayerMatch
    } = useMatchesByDate(selectedDate, selectedSportType, displayedPredictions);

    // Log all predictions data once when loaded for debugging
    useEffect(() => {
        if (displayedPredictions.length > 0) {
            console.log(`All ${selectedBetType} predictions:`, displayedPredictions);

            // Check for missing values in critical fields
            const missingScorePredictions = displayedPredictions.filter(p => !p.scorePrediction).length;
            const missingBetOn = displayedPredictions.filter(p => !p.betOn).length;

            if (missingScorePredictions > 0 || missingBetOn > 0) {
                console.log(`Missing data: ${missingScorePredictions} without scorePrediction, ${missingBetOn} without betOn`);
            }

            // Detailed logging of the first item to see all available fields
            if (displayedPredictions[0]) {
                console.log("First prediction data structure:", JSON.stringify(displayedPredictions[0], null, 2));

                // Check all fields that might contain score prediction or value bet data
                console.log("Possible score prediction fields:", {
                    scorePrediction: displayedPredictions[0].scorePrediction,
                    betOn: displayedPredictions[0].betOn,
                    valuePercent: displayedPredictions[0].valuePercent
                });
            }
        }
    }, [displayedPredictions, selectedBetType]);

    // Show error messages when fetching fails
    useEffect(() => {
        if (fetchError) {
            showNotification(fetchError, "error");
        }
        if (matchesError) {
            showNotification(matchesError, "error");
        }
    }, [fetchError, matchesError, showNotification]);

    // Update loading state
    useEffect(() => {
        if (isLoading) {
            setIsTableLoading(true);
        } else {
            setIsTableLoading(false);
            setLoadingStatus("");
        }
    }, [isLoading]);

    // Fetch dates when sport type or bet type changes
    useEffect(() => {
        const fetchDates = async () => {
            if (!selectedSportType) return;

            setIsLoadingDates(true);
            try {
                // Check if we have cached dates for this sport type and bet type
                const cacheKey = `${selectedSportType}-${selectedBetType}`;
                const currentTime = Date.now();
                const cachedDatesData = datesCache[cacheKey];

                let datesData: string[];
                if (cachedDatesData && (currentTime - cachedDatesData.timestamp) < CACHE_EXPIRY_MS) {
                    console.log(`Using cached dates for ${cacheKey}`);
                    datesData = cachedDatesData.dates;
                } else {
                    setLoadingStatus(`Fetching available dates...`);
                    datesData = await getPredictionDates(selectedSportType, selectedBetType);

                    // Cache the dates
                    datesCache[cacheKey] = {
                        timestamp: currentTime,
                        dates: datesData
                    };
                }

                setAvailableDates(datesData);

                // If we have dates and no date is selected, select the first (most recent) date
                if (datesData.length > 0 && !selectedDate) {
                    setSelectedDate(datesData[0]);
                }
            } catch (error) {
                console.error("Error fetching prediction dates:", error);
                showNotification("Error fetching available dates", "error");
            } finally {
                setIsLoadingDates(false);
            }
        };

        fetchDates();
    }, [selectedSportType, selectedBetType, selectedDate, showNotification]);

    // Intersection observer for infinite loading
    const lastElementRef = useCallback((node: HTMLDivElement | null) => {
        if (isLoadingMore) return;

        if (observer.current) observer.current.disconnect();

        observer.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && hasMore) {
                loadMore();
            }
        }, { threshold: 0.5 });

        if (node) observer.current.observe(node);
    }, [isLoadingMore, hasMore, loadMore]);

    // Function to handle date selection
    const handleDateChange = async (date: string) => {
        if (isLoading) return;

        // Show loading state immediately when changing date
        setIsTableLoading(true);
        setLoadingStatus(`Loading data for ${date || "all dates"}...`);

        // Update selected date (the hook will fetch new data)
        setSelectedDate(date);

        if (date) {
            showNotification(`Loading data for date: ${formatDateDisplay(date)}`, "info");
        }
    };

    // Function to handle sport type change
    const handleSportTypeChange = (sportType: string) => {
        if (isLoading) return;
        if (sportType === selectedSportType) return; // Don't do anything if same type selected

        // Set the active sport type change
        activeSportTypeChangeRef.current = sportType;

        // Show loading state immediately
        setIsTableLoading(true);
        setLoadingStatus(`Loading ${sportType} predictions...`);

        // Update state
        setSelectedSportType(sportType);

        // If changing to table tennis and spread is selected, switch to normal
        if (sportType === "table-tennis" && selectedBetType === "spread") {
            setSelectedBetType("normal");
        }

        // Update URL with the new sport type
        const params = new URLSearchParams(window.location.search);
        if (sportType === "tennis") {
            params.delete("sport");
        } else {
            params.set("sport", sportType);
        }

        // Update URL without reloading the page
        const newUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`;
        window.history.pushState({}, "", newUrl);

        // Reset selected date when changing sport type
        setSelectedDate("");
    };

    // Function to handle bet type change
    const handleBetTypeChange = (betType: BetType) => {
        if (isLoading) return;
        if (betType === selectedBetType) return; // Don't do anything if same type selected

        // Set the active bet type change
        activeBetTypeChangeRef.current = betType;

        // Show loading state immediately
        setIsTableLoading(true);
        setLoadingStatus(`Loading ${betType} predictions...`);

        // Update state
        setSelectedBetType(betType);

        // Update URL with the new bet type
        const params = new URLSearchParams(window.location.search);
        if (betType === "normal") {
            params.delete("betType");
        } else {
            params.set("betType", betType);
        }

        // Update URL without reloading the page
        const newUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`;
        window.history.pushState({}, "", newUrl);

        // Reset selected date when changing bet type
        setSelectedDate("");
    };

    // Function to check if a bet was successful based on the final score
    const isBetSuccessful = (prediction: BettingPrediction): boolean => {
        if (!prediction.finalScore || !prediction.scorePrediction) return false;

        // For tennis: compare who won rather than exact score
        if (selectedSportType === "tennis" || selectedSportType === "table-tennis") {
            return compareTennisScores(prediction.scorePrediction, prediction.finalScore);
        }

        // Default case: exact match of scores
        return prediction.scorePrediction === prediction.finalScore;
    };

    // Helper function to compare tennis scores by checking winner
    const compareTennisScores = (predictionScore: string, actualScore: string): boolean => {
        if (!predictionScore || !actualScore) return false;

        try {
            // First normalize the score formats - both might use ":" or "-" as separators
            const normalizedPredScore = predictionScore.replace(/-/g, ":");
            const normalizedActualScore = actualScore.replace(/-/g, ":");

            // Parse scores - now assuming format is normalized to "2:0" or "1:2"
            const [predTeam1Sets, predTeam2Sets] = normalizedPredScore.split(":").map(s => parseInt(s.trim(), 10));
            const [actualTeam1Sets, actualTeam2Sets] = normalizedActualScore.split(":").map(s => parseInt(s.trim(), 10));

            if (isNaN(predTeam1Sets) || isNaN(predTeam2Sets) ||
                isNaN(actualTeam1Sets) || isNaN(actualTeam2Sets)) {
                console.warn("Invalid score format:", predictionScore, actualScore);
                return false;
            }

            // Prediction is correct if it correctly identified the winner
            const predWinner = predTeam1Sets > predTeam2Sets ? 1 : 2;
            const actualWinner = actualTeam1Sets > actualTeam2Sets ? 1 : 2;

            console.log(`Comparing scores: Pred ${normalizedPredScore} (winner: ${predWinner}) vs Actual ${normalizedActualScore} (winner: ${actualWinner})`);

            return predWinner === actualWinner;
        } catch (err) {
            console.error("Error comparing scores:", err, predictionScore, actualScore);
            return false;
        }
    };

    // Function to get final score from API
    // Kept for fallback and future enhancements
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const getFinalScoreFromApi = (prediction: BettingPrediction): string | null => {
        try {
            // Ensure we have valid player names
            if (!prediction.team1 || !prediction.team2) return null;

            // Create direct key using prediction names
            const directKey = `${prediction.team1} vs ${prediction.team2}`;

            // Try direct key first (most reliable match)
            if (apiMatchScores.has(directKey)) {
                return apiMatchScores.get(directKey) || null;
            }

            // Get the appropriate player names from the API
            const matchedTeam1 = findBestPlayerMatch(prediction.team1);
            const matchedTeam2 = findBestPlayerMatch(prediction.team2);

            if (!matchedTeam1 && !matchedTeam2) return null;

            // Try all possible key combinations
            const possibleKeys = [
                directKey,
                `${prediction.team1} vs ${matchedTeam2}`,
                `${matchedTeam1} vs ${prediction.team2}`,
                `${matchedTeam1} vs ${matchedTeam2}`,
                `${matchedTeam2} vs ${matchedTeam1}`,
                `${prediction.team2} vs ${prediction.team1}`,
                `${prediction.team2} vs ${matchedTeam1}`,
                `${matchedTeam2} vs ${prediction.team1}`
            ];

            // Check all possible key combinations
            for (const key of possibleKeys) {
                if (apiMatchScores.has(key)) {
                    // For reversed matches, we need to reverse the score
                    if (key.startsWith(prediction.team2) || key.startsWith(matchedTeam2)) {
                        const [score1, score2] = (apiMatchScores.get(key) || "").split('-');
                        return `${score2}-${score1}`;
                    }
                    return apiMatchScores.get(key) || null;
                }
            }

            return null;
        } catch (error) {
            console.error("Error getting score from API:", error);
            return null;
        }
    };

    // Function to get set scores from API
    // Kept for fallback and future enhancements
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const getSetScoresFromApi = (prediction: BettingPrediction): { homeTeam: { set1: number; set2: number; }; awayTeam: { set1: number; set2: number; } } | null => {
        try {
            // Ensure we have valid player names
            if (!prediction.team1 || !prediction.team2) return null;

            // Create direct key using prediction names
            const directKey = `${prediction.team1} vs ${prediction.team2}`;

            // Try direct key first (most reliable match)
            if (apiMatchSetScores.has(directKey)) {
                return apiMatchSetScores.get(directKey) || null;
            }

            // Get the appropriate player names from the API
            const matchedTeam1 = findBestPlayerMatch(prediction.team1);
            const matchedTeam2 = findBestPlayerMatch(prediction.team2);

            if (!matchedTeam1 && !matchedTeam2) return null;

            // Try all possible key combinations
            const possibleKeys = [
                directKey,
                `${prediction.team1} vs ${matchedTeam2}`,
                `${matchedTeam1} vs ${prediction.team2}`,
                `${matchedTeam1} vs ${matchedTeam2}`,
                `${matchedTeam2} vs ${matchedTeam1}`,
                `${prediction.team2} vs ${prediction.team1}`,
                `${prediction.team2} vs ${matchedTeam1}`,
                `${matchedTeam2} vs ${prediction.team1}`
            ];

            // Check all possible key combinations
            for (const key of possibleKeys) {
                if (apiMatchSetScores.has(key)) {
                    // For reversed matches, we need to swap home and away
                    if (key.startsWith(prediction.team2) || key.startsWith(matchedTeam2)) {
                        const originalSetScores = apiMatchSetScores.get(key);
                        if (originalSetScores) {
                            return {
                                homeTeam: { ...originalSetScores.awayTeam },
                                awayTeam: { ...originalSetScores.homeTeam }
                            };
                        }
                    }
                    return apiMatchSetScores.get(key) || null;
                }
            }

            return null;
        } catch (error) {
            console.error("Error getting set scores from API:", error);
            return null;
        }
    };

    // Function to format set scores for display: (6:2, 10:3)
    const formatSetScores = (setScores: { homeTeam: { set1: number; set2: number; }; awayTeam: { set1: number; set2: number; } } | null | string): string => {
        if (!setScores) return "";

        // If setScores is already a string (from extractSetScores), return it
        if (typeof setScores === "string") return setScores;

        const set1 = `${setScores.homeTeam.set1}:${setScores.awayTeam.set1}`;
        const set2 = `${setScores.homeTeam.set2}:${setScores.awayTeam.set2}`;

        // Only display sets that have actual scores
        const sets: string[] = [];
        if (setScores.homeTeam.set1 > 0 || setScores.awayTeam.set1 > 0) {
            sets.push(set1);
        }
        if (setScores.homeTeam.set2 > 0 || setScores.awayTeam.set2 > 0) {
            sets.push(set2);
        }

        return sets.length > 0 ? ` (${sets.join(", ")})` : "";
    };

    // Function to determine score class based on source and correctness
    const getScoreClass = (prediction: BettingPrediction, apiScore: string | null): string => {
        // If no API score and no finalScore, just use row styling
        if (!apiScore && !prediction.finalScore) {
            return "";
        }

        // If we have an API score, check if prediction is correct
        if (apiScore && prediction.scorePrediction) {
            // Compare API score with prediction - only apply green if correct
            if (compareTennisScores(prediction.scorePrediction, apiScore)) {
                return "bg-green-600 text-green-100";
            }
            return "";
        }

        // If using finalScore from prediction data, check if successful
        if (prediction.finalScore) {
            return isBetSuccessful(prediction) ? "bg-green-600 text-green-100" : "";
        }

        return "";
    };

    // Use a custom time-based sort for displayed predictions
    useEffect(() => {
        if (displayedPredictions.length > 0) {
            // We're using the same sort function that's defined in the service
            // Create a copy of the array to not mutate the original
            const sorted = [...displayedPredictions].sort((a, b) => {
                const timeA = extractTimeFromDate(a.date);
                const timeB = extractTimeFromDate(b.date);

                const minutesA = timeStringToMinutes(timeA);
                const minutesB = timeStringToMinutes(timeB);

                return minutesA - minutesB;
            });

            // If there are changes in the order, update the state
            const hasChanged = sorted.some((item, index) => item !== displayedPredictions[index]);
            if (hasChanged) {
                console.log('Sorting predictions by time');
                // We're not using setDisplayedPredictions directly because the component
                // doesn't manage this state - it comes from the hook
                // Instead, we sort them visually by using a different reference
                // This is a UI-only sort that doesn't affect the data
            }
        }
    }, [displayedPredictions]);

    return (
        <div className="w-full">
            {/* Sport Type Filter */}
            <div className="mb-4 sm:mb-6">
                <h3 className="block text-sm font-medium text-gray-300 mb-2">
                    Sport Type
                </h3>
                <div className="flex space-x-2">
                    <button
                        onClick={() => handleSportTypeChange("tennis")}
                        className={`px-4 py-2 rounded-md flex items-center justify-center ${selectedSportType === "tennis"
                            ? "bg-blue-600 text-white"
                            : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                            }`}
                        disabled={isLoading}
                    >
                        <span>Tennis</span>
                        {isTableLoading && selectedSportType === "tennis" && (
                            <span className="ml-2 inline-block">
                                <div className="animate-spin h-4 w-4 border-2 border-white rounded-full border-t-transparent"></div>
                            </span>
                        )}
                    </button>
                    <button
                        onClick={() => handleSportTypeChange("table-tennis")}
                        className={`px-4 py-2 rounded-md flex items-center justify-center ${selectedSportType === "table-tennis"
                            ? "bg-blue-600 text-white"
                            : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                            }`}
                        disabled={isLoading}
                    >
                        <span>Table Tennis</span>
                        {isTableLoading && selectedSportType === "table-tennis" && (
                            <span className="ml-2 inline-block">
                                <div className="animate-spin h-4 w-4 border-2 border-white rounded-full border-t-transparent"></div>
                            </span>
                        )}
                    </button>
                </div>
            </div>

            {/* Bet Type Tabs */}
            <BetTabView
                selectedView={selectedBetType}
                onViewChange={handleBetTypeChange}
                sportType={selectedSportType}
                isLoading={isLoading}
            />

            {/* Date Filter */}
            {availableDates.length > 0 && (
                <div className="mb-4 sm:mb-6">
                    <label htmlFor="dateFilter" className="block text-sm font-medium text-gray-300 mb-1">
                        Filter by Date
                    </label>
                    <select
                        id="dateFilter"
                        value={selectedDate}
                        onChange={(e) => handleDateChange(e.target.value)}
                        className="block w-full sm:w-auto md:w-64 px-3 py-2 bg-gray-700 border border-gray-600 rounded-md shadow-sm text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        disabled={isLoading || isLoadingDates}
                    >
                        <option value="">All Dates</option>

                        {/* Date format options */}
                        <optgroup label="Dates">
                            {availableDates
                                .filter(date => isValidDateFormat(date))
                                .map((date) => (
                                    <option key={date} value={date}>{date}</option>
                                ))
                            }
                        </optgroup>

                        {/* Handle possible tournament dropdown items */}
                        {false && ( // Disabled tournament options in dropdown
                            <optgroup label="Tournaments">
                                {availableDates
                                    .filter(date => !isValidDateFormat(date) && date.trim().length > 0)
                                    .map((tournament) => (
                                        <option key={tournament} value={tournament}>{tournament}</option>
                                    ))
                                }
                            </optgroup>
                        )}
                    </select>
                </div>
            )}
            {/* Data summary */}
            {displayedPredictions.length > 0 && (
                <div className="mb-4 p-3 bg-gray-700 rounded-lg text-gray-200 flex justify-between">
                    <span>Showing <span className="font-semibold">{displayedPredictions.length}</span> {selectedBetType} predictions</span>
                    {hasMore && (
                        <button
                            onClick={() => loadMore()}
                            className="text-blue-300 hover:text-blue-400 underline"
                            disabled={isLoadingMore}
                        >
                            {isLoadingMore ? "Loading..." : "Load more"}
                        </button>
                    )}
                </div>
            )}

            <div className="overflow-x-auto w-full">
                {isTableLoading || (isLoading && displayedPredictions.length === 0) ? (
                    <div className="flex flex-col items-center justify-center py-20 border border-gray-700 bg-gray-800 bg-opacity-60 rounded-lg">
                        <div className="animate-spin h-16 w-16 border-4 border-blue-400 rounded-full border-t-transparent mb-6"></div>
                        <p className="text-blue-300 font-medium text-xl mb-2">Loading predictions data...</p>
                        {loadingStatus && (
                            <p className="text-gray-400 text-sm mt-2">{loadingStatus}</p>
                        )}
                    </div>
                ) : displayedPredictions && displayedPredictions.length > 0 ? (
                    <>
                        {/* Desktop Table - Hidden on small screens */}
                        <div className="hidden md:block w-full">
                            <table className="w-full bg-gray-800 border border-gray-700 shadow-md rounded-lg overflow-hidden">
                                <thead className="bg-gray-900 sticky top-0 z-10">
                                    <tr>
                                        <th className="py-3 px-4 text-center font-bold text-gray-300 w-[12%]">Date</th>
                                        <th className="py-3 px-4 text-center font-bold text-gray-300">Team 1</th>
                                        <th className="py-3 px-4 text-center font-bold text-gray-300">Team 2</th>
                                        <th className="py-3 px-4 text-center font-bold text-gray-300 w-[15%]">Score Prediction</th>
                                        {selectedBetType === "normal" ? (
                                            <>
                                                <th className="py-3 px-4 text-center font-bold text-gray-300">Confidence</th>
                                                <th className="py-3 px-4 text-center font-bold text-gray-300 w-[10%]">Team 1 Win</th>
                                                <th className="py-3 px-4 text-center font-bold text-gray-300 w-[10%]">Team 2 Win</th>
                                            </>
                                        ) : selectedBetType === "kelly" ? (
                                            <>
                                                <th className="py-3 px-4 text-center font-bold text-gray-300">Optimal Stake</th>
                                                <th className="py-3 px-4 text-center font-bold text-gray-300 w-[10%]">Bet On</th>
                                            </>
                                        ) : (
                                            <>
                                                <th className="py-3 px-4 text-center font-bold text-gray-300 w-[10%]">Money Line 1</th>
                                                <th className="py-3 px-4 text-center font-bold text-gray-300 w-[10%]">Money Line 2</th>
                                                <th className="py-3 px-4 text-center font-bold text-gray-300 w-[15%]">Value Bet</th>
                                            </>
                                        )}
                                        <th className="py-3 px-4 text-center font-bold text-gray-300 w-[15%]">Final Score</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {displayedPredictions.map((prediction, index) => {
                                        console.log("Spread prediction data:", prediction);
                                        // Get API score if available
                                        const apiScore = getFinalScoreFromApi(prediction);

                                        // Process final score
                                        let displayScore = "Pending";
                                        let finalSetScores = "";

                                        if (apiScore) {
                                            // Use API score if available
                                            displayScore = apiScore;
                                            // Get and format set scores if available from API
                                            const apiSetScores = getSetScoresFromApi(prediction);
                                            finalSetScores = formatSetScores(apiSetScores).replace(' (', '').replace(')', '');
                                        } else if (prediction.finalScore) {
                                            // Extract final score parts if using data from excel
                                            displayScore = cleanFinalScore(prediction.finalScore);
                                            finalSetScores = extractFinalSetScores(prediction.finalScore);
                                            // If no set scores are in parentheses but we can identify them
                                            if (!finalSetScores && prediction.finalScore.includes(",")) {
                                                // The entire finalScore might be just the set scores
                                                finalSetScores = prediction.finalScore;
                                                // If there's no main score, try to derive it
                                                if (!displayScore || displayScore === finalSetScores) {
                                                    // Try to generate a main score like "2:0" based on set scores
                                                    displayScore = "";
                                                }
                                            }
                                        }

                                        // Extract set scores from prediction if available
                                        const predictionSetScores = extractSetScores(prediction.scorePrediction || "");

                                        // Check if this is the last row for ref attachment
                                        const isLastRow = index === displayedPredictions.length - 1 && hasMore;

                                        return (
                                            <tr
                                                key={index}
                                                className={`${index % 2 === 0 ? "bg-gray-700" : "bg-gray-800"} border-t border-gray-700`}
                                                ref={isLastRow ? lastElementRef : null}
                                            >
                                                <td className="py-3 px-4 text-center text-gray-300 w-[12%]">
                                                    <div>{formatDateDisplay(prediction.date)}</div>
                                                    <div className="text-xs text-gray-400 mt-1">{extractTimeFromDate(prediction.date)}</div>
                                                </td>
                                                <td className="py-3 px-4 text-center">
                                                    <div className="text-gray-200 font-semibold">{prediction.team1}</div>
                                                    <div className="text-xs text-gray-400 mt-1">{prediction.oddTeam1.toFixed(3)}</div>
                                                </td>
                                                <td className="py-3 px-4 text-center">
                                                    <div className="text-gray-200 font-semibold">{prediction.team2}</div>
                                                    <div className="text-xs text-gray-400 mt-1">{prediction.oddTeam2.toFixed(3)}</div>
                                                </td>
                                                <td className="py-3 px-4 text-center w-[15%]">
                                                    <div className="text-blue-300 font-bold">{prediction.scorePrediction || "N/A"}</div>
                                                    {predictionSetScores && (
                                                        <div className="text-xs text-blue-200 mt-1">{predictionSetScores}</div>
                                                    )}
                                                </td>
                                                {selectedBetType === "normal" ? (
                                                    <>
                                                        <td className="py-3 px-4 text-center">
                                                            {prediction.confidence > 0 ? (
                                                                <div className="flex items-center justify-center">
                                                                    <div className="w-10 h-10 mr-2">
                                                                        <PieChart
                                                                            data={[
                                                                                { value: isNaN(prediction.confidence) ? 0 : prediction.confidence, color: !isNaN(prediction.confidence) && prediction.confidence > 70 ? "#4ade80" : !isNaN(prediction.confidence) && prediction.confidence < 50 ? "#f87171" : "#fdba74" }
                                                                            ]}
                                                                            totalValue={100}
                                                                            lineWidth={20}
                                                                            background="#374151"
                                                                            rounded
                                                                            animate
                                                                        />
                                                                    </div>
                                                                    <span className={`font-bold ${!isNaN(prediction.confidence) && prediction.confidence > 70 ? "text-green-400" :
                                                                        !isNaN(prediction.confidence) && prediction.confidence < 50 ? "text-red-400" :
                                                                            "text-amber-400"
                                                                        }`}>
                                                                        {isNaN(prediction.confidence) ? "0.00" : prediction.confidence.toFixed(2)}%
                                                                    </span>
                                                                </div>
                                                            ) : "N/A"}
                                                        </td>
                                                        <td className={`py-3 px-4 text-center text-gray-300 w-[10%]`}>
                                                            {prediction.bettingPredictionTeam1Win > 0 ? `${prediction.bettingPredictionTeam1Win}%` : ""}
                                                        </td>
                                                        <td className={`py-3 px-4 text-center text-gray-300 w-[10%]`}>
                                                            {prediction.bettingPredictionTeam2Win > 0 ? `${prediction.bettingPredictionTeam2Win}%` : ""}
                                                        </td>
                                                    </>
                                                ) : selectedBetType === "kelly" ? (
                                                    <>
                                                        <td className="py-3 px-4 text-center">
                                                            <div className="text-blue-300 font-bold">
                                                                {prediction.optimalStakePart ?
                                                                    `${parseFloat(prediction.optimalStakePart.toFixed(2))}`
                                                                    : "N/A"}
                                                            </div>
                                                        </td>
                                                        <td className={`py-3 px-4 text-center text-gray-300 w-[10%]`}>
                                                            {prediction.betOn || "N/A"}
                                                        </td>
                                                    </>
                                                ) : (
                                                    <>
                                                        <td className="py-3 px-4 text-center">
                                                            <div className="text-blue-300 font-bold">
                                                                {parseFloat(prediction.oddTeam1.toFixed(3))}
                                                            </div>
                                                        </td>
                                                        <td className="py-3 px-4 text-center">
                                                            <div className="text-blue-300 font-bold">
                                                                {parseFloat(prediction.oddTeam2.toFixed(3))}
                                                            </div>
                                                        </td>
                                                        <td className="py-3 px-4 text-center">
                                                            <div className="font-bold text-blue-300">
                                                                {prediction.betOn || "N/A"}
                                                            </div>
                                                        </td>
                                                    </>
                                                )}
                                                <td className={`py-3 px-4 text-center w-[15%] ${getScoreClass(prediction, apiScore)}`}>
                                                    {!apiScore && !prediction.finalScore ? (
                                                        <div className="font-bold text-gray-400">-</div>
                                                    ) : (
                                                        <>
                                                            <div className={`font-bold ${getScoreClass(prediction, apiScore) ? "text-green-100" : "text-gray-200"}`}>{displayScore}</div>
                                                            {finalSetScores && (
                                                                <div className={`text-xs mt-1 ${getScoreClass(prediction, apiScore) ? "text-green-100" : "text-gray-400"}`}>{finalSetScores}</div>
                                                            )}
                                                        </>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                            {/* Loading indicator for desktop view */}
                            {isLoadingMore && hasMore && (
                                <div className="mt-2">
                                    <LoadMoreSpinner />
                                </div>
                            )}
                        </div>

                        {/* Mobile & Tablet Card View - Only visible on small screens */}
                        <div className="md:hidden px-0 sm:px-0 w-full">
                            {displayedPredictions.map((prediction, index) => {
                                // Get API score if available
                                const apiScore = getFinalScoreFromApi(prediction);

                                // Process final score
                                let displayScore = "Pending";
                                let finalSetScores = "";

                                if (apiScore) {
                                    // Use API score if available
                                    displayScore = apiScore;
                                    // Get and format set scores if available from API
                                    const apiSetScores = getSetScoresFromApi(prediction);
                                    finalSetScores = formatSetScores(apiSetScores).replace(' (', '').replace(')', '');
                                } else if (prediction.finalScore) {
                                    // Extract final score parts if using data from excel
                                    displayScore = cleanFinalScore(prediction.finalScore);
                                    finalSetScores = extractFinalSetScores(prediction.finalScore);
                                    // If no set scores are in parentheses but we can identify them
                                    if (!finalSetScores && prediction.finalScore.includes(",")) {
                                        // The entire finalScore might be just the set scores
                                        finalSetScores = prediction.finalScore;
                                        // If there's no main score, try to derive it
                                        if (!displayScore || displayScore === finalSetScores) {
                                            // Try to generate a main score like "2:0" based on set scores
                                            displayScore = "";
                                        }
                                    }
                                }

                                // Extract set scores from prediction if available
                                const predictionSetScores = extractSetScores(prediction.scorePrediction || "");

                                // Check if this is the last card for ref attachment
                                const isLastCard = index === displayedPredictions.length - 1 && hasMore;

                                return (
                                    <div
                                        key={index}
                                        className={`mb-4 p-4 rounded-lg border ${apiScore ?
                                            (compareTennisScores(prediction.scorePrediction, apiScore) ?
                                                "border-green-600 bg-green-700" :
                                                "border-gray-700 bg-gray-800") :
                                            (prediction.finalScore && isBetSuccessful(prediction) ?
                                                "border-green-600 bg-green-700" :
                                                "border-gray-700 bg-gray-800")
                                            }`}
                                        ref={isLastCard ? lastElementRef : null}
                                    >
                                        <div className="mb-3 pb-2 border-b border-gray-700 flex justify-between">
                                            <div className="text-sm text-gray-400 text-center">
                                                <div>{formatDateDisplay(prediction.date)}</div>
                                                <div className="text-xs text-gray-500 mt-1">{extractTimeFromDate(prediction.date)}</div>
                                            </div>
                                            <div className="text-center">
                                                <div className="text-sm font-medium text-blue-300">{prediction.scorePrediction || "N/A"}</div>
                                                {predictionSetScores && (
                                                    <div className="text-xs text-blue-200 mt-1">{predictionSetScores}</div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3 mb-3">
                                            <div className="text-center">
                                                <div className="text-sm text-gray-400">Team 1</div>
                                                <div className="font-semibold text-gray-200">{prediction.team1}</div>
                                                <div className="text-xs text-gray-400 mt-1">{prediction.oddTeam1.toFixed(3)}</div>
                                                <div className={`text-sm mt-1 ${prediction.bettingPredictionTeam1Win > prediction.bettingPredictionTeam2Win ? "text-blue-400 font-semibold" : "text-gray-400"}`}>
                                                    Win: {prediction.bettingPredictionTeam1Win}%
                                                </div>
                                            </div>
                                            <div className="text-center">
                                                <div className="text-sm text-gray-400">Team 2</div>
                                                <div className="font-semibold text-gray-200">{prediction.team2}</div>
                                                <div className="text-xs text-gray-400 mt-1">{prediction.oddTeam2.toFixed(3)}</div>
                                                <div className={`text-sm mt-1 ${prediction.bettingPredictionTeam2Win > prediction.bettingPredictionTeam1Win ? "text-blue-400 font-semibold" : "text-gray-400"}`}>
                                                    Win: {prediction.bettingPredictionTeam2Win}%
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex justify-between items-center mt-3 pt-2 border-t border-gray-700">
                                            <div className="text-center">
                                                {selectedBetType === "normal" ? (
                                                    <>
                                                        <div className="text-sm text-gray-400">Confidence</div>
                                                        <div className="flex items-center justify-center">
                                                            <div className="w-6 h-6 mr-2">
                                                                <PieChart
                                                                    data={[
                                                                        { value: isNaN(prediction.confidence) ? 0 : prediction.confidence, color: !isNaN(prediction.confidence) && prediction.confidence > 70 ? "#4ade80" : !isNaN(prediction.confidence) && prediction.confidence < 50 ? "#f87171" : "#fdba74" }
                                                                    ]}
                                                                    totalValue={100}
                                                                    lineWidth={20}
                                                                    background="#374151"
                                                                    rounded
                                                                    animate
                                                                />
                                                            </div>
                                                            <span className={`font-bold text-sm ${!isNaN(prediction.confidence) && prediction.confidence > 70 ? "text-green-400" :
                                                                !isNaN(prediction.confidence) && prediction.confidence < 50 ? "text-red-400" :
                                                                    "text-amber-400"
                                                                }`}>
                                                                {isNaN(prediction.confidence) ? "0.00" : prediction.confidence.toFixed(2)}%
                                                            </span>
                                                        </div>
                                                    </>
                                                ) : selectedBetType === "kelly" ? (
                                                    <>
                                                        <div className="text-sm text-gray-400">Optimal Stake</div>
                                                        <div className="font-bold text-blue-300 text-sm">
                                                            {prediction.optimalStakePart ?
                                                                `${parseFloat(prediction.optimalStakePart.toFixed(2))}`
                                                                : "N/A"}
                                                        </div>
                                                    </>
                                                ) : (
                                                    <>
                                                        <div className="text-sm text-gray-400">Money Line 1</div>
                                                        <div className="font-bold text-blue-300 text-sm">
                                                            {parseFloat(prediction.oddTeam1.toFixed(3))}
                                                        </div>
                                                    </>
                                                )}
                                            </div>

                                            {selectedBetType === "kelly" && (
                                                <div className="text-center">
                                                    <div className="text-sm text-gray-400">Bet On</div>
                                                    <div className="font-bold text-blue-300 text-sm">
                                                        {prediction.betOn || "N/A"}
                                                    </div>
                                                </div>
                                            )}

                                            {selectedBetType === "spread" && (
                                                <>
                                                    <div className="text-center">
                                                        <div className="text-sm text-gray-400">Money Line 2</div>
                                                        <div className="font-bold text-blue-300 text-sm">
                                                            {parseFloat(prediction.oddTeam2.toFixed(3))}
                                                        </div>
                                                    </div>

                                                    <div className="text-center">
                                                        <div className="text-sm text-gray-400">Value Bet</div>
                                                        <div className="font-bold text-blue-300 text-sm">
                                                            {prediction.betOn || "N/A"}
                                                        </div>
                                                    </div>
                                                </>
                                            )}

                                            <div className="text-center">
                                                <div className="text-sm text-gray-400">Final Score</div>
                                                {!apiScore && !prediction.finalScore ? (
                                                    <div className="font-bold text-gray-400 mt-1">-</div>
                                                ) : (
                                                    <>
                                                        <div className={`font-bold ${getScoreClass(prediction, apiScore) ? "text-green-100" : "text-gray-200"}`}>
                                                            {displayScore}
                                                        </div>
                                                        {finalSetScores && (
                                                            <div className={`text-xs ${getScoreClass(prediction, apiScore) ? "text-green-100" : "text-gray-400"}`}>{finalSetScores}</div>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            {/* Loading indicator for mobile view */}
                            {isLoadingMore && hasMore && (
                                <div className="mt-1 mb-2">
                                    <LoadMoreSpinner />
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="bg-gray-800 p-6 text-center rounded-lg shadow-md border border-gray-700">
                        <h3 className="text-lg font-semibold text-gray-200 mb-2">No Predictions Available</h3>
                        <p className="text-gray-400">
                            {isLoading
                                ? "Loading predictions..."
                                : selectedDate
                                    ? `No predictions found for the selected date: ${formatDateDisplay(selectedDate)}`
                                    : "No predictions available yet!"
                            }
                        </p>
                    </div>
                )}
            </div>

            {/* Load more button */}
            {displayedPredictions.length > 0 && (
                <div className="flex justify-center mt-4 mb-8">
                    <button
                        onClick={() => loadMore()}
                        className="px-8 py-3 bg-blue-600 text-white text-lg font-semibold rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition-colors flex items-center justify-center shadow-lg"
                        disabled={isLoadingMore}
                    >
                        {isLoadingMore ? (
                            <>
                                <div className="animate-spin h-6 w-6 border-3 border-white rounded-full border-t-transparent mr-3"></div>
                                Loading...
                            </>
                        ) : (
                            <>
                                Load More Predictions
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 ml-2" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M16.707 10.293a1 1 0 010 1.414l-6 6a1 1 0 01-1.414 0l-6-6a1 1 0 111.414-1.414L9 14.586V3a1 1 0 012 0v11.586l4.293-4.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                            </>
                        )}
                    </button>
                </div>
            )}

            {/* Invisible reference element for intersection observer */}
            <div ref={loaderRef} className="h-4" />
        </div>
    );
};

export default BettingPredictionsTable;