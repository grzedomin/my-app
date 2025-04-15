import React, { useState, useEffect, useRef, useCallback } from "react";
import { PieChart } from "react-minimal-pie-chart";
import { useNotification } from "@/context/NotificationContext";
import { useSearchParams } from "next/navigation";
import { useMatchesByDate } from "@/hooks/query";
import { BettingPrediction, getPredictionsBySportType, getPredictionsByDate, getPredictionDates } from "@/lib/prediction-service";

// Spinner components for loading states
const TableSpinner = () => (
    <div className="flex justify-center items-center py-2">
        <div className="animate-spin h-5 w-5 border-2 border-green-300 rounded-full border-t-transparent"></div>
    </div>
);

const CardSpinner = () => (
    <div className="flex justify-center items-center py-1">
        <div className="animate-spin h-6 w-6 border-2 border-green-300 rounded-full border-t-transparent"></div>
    </div>
);

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

// Helper function to clean score prediction by removing set details
const cleanScorePrediction = (scorePrediction: string): string => {
    return scorePrediction.replace(/\s*\([^)]+\)/, "").trim();
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

// Cache for predictions by sport type to prevent redundant Firestore queries
const predictionsCache: { [key: string]: { timestamp: number; data: BettingPrediction[] } } = {};
const datesCache: { [sportType: string]: { timestamp: number; dates: string[] } } = {};
const CACHE_EXPIRY_MS = 60 * 1000; // Cache expires after 1 minute

// Helper function to check if string is a valid date format
const isValidDateFormat = (dateStr: string): boolean => {
    // Only show items that match the "10th Apr 2025" pattern
    return /^\d+(?:st|nd|rd|th)\s+[A-Za-z]+\s+\d{4}$/.test(dateStr.trim());
};

const BettingPredictionsTable: React.FC = () => {
    const { showNotification } = useNotification();
    const searchParams = useSearchParams();
    const loaderRef = useRef<HTMLDivElement>(null);

    const [predictions, setPredictions] = useState<BettingPrediction[]>([]);
    const [filteredPredictions, setFilteredPredictions] = useState<BettingPrediction[]>([]);
    const [displayedPredictions, setDisplayedPredictions] = useState<BettingPrediction[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedDate, setSelectedDate] = useState<string>("");
    const [availableDates, setAvailableDates] = useState<string[]>([]);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [pageNumber, setPageNumber] = useState(1);
    const [isTableLoading, setIsTableLoading] = useState(false);
    const [loadingStatus, setLoadingStatus] = useState<string>("");
    const activeSportTypeChangeRef = useRef<string | null>(null);

    // Get initial sport type from URL parameters or default to tennis
    const [selectedSportType, setSelectedSportType] = useState<string>(() => {
        const sportParam = searchParams.get("sport");
        return sportParam || "tennis";
    });

    // Use our custom hook to fetch matches by date
    const {
        error: matchesError,
        apiMatchScores,
        apiMatchSetScores,
        findBestPlayerMatch
    } = useMatchesByDate(selectedDate, selectedSportType, filteredPredictions);

    // Show error message when fetching matches fails
    useEffect(() => {
        if (matchesError) {
            showNotification(matchesError, "error");
        }
    }, [matchesError, showNotification]);

    // Effect to filter predictions by date
    useEffect(() => {
        if (!selectedDate) {
            // If no date selected, show all predictions
            setFilteredPredictions(predictions);
        } else {
            // Filter predictions by selected date 
            const filtered = predictions.filter(pred => {
                if (!pred.date) return false;

                // Extract the date part like "10th Apr 2025" from the string
                const dateMatch = pred.date.match(/(\d+(?:st|nd|rd|th)\s+[A-Za-z]+\s+\d{4})/);
                const extractedDate = dateMatch && dateMatch[1] ? dateMatch[1].trim() : "";

                // Also check standardDate if it exists
                const matchesStandardDate = pred.standardDate === selectedDate;

                // For tournament names, we use startsWith/includes logic
                const tournamentMatch = dateMatch ?
                    false : // If it has a date pattern, don't use this logic
                    (pred.date.toLowerCase().includes(selectedDate.toLowerCase())
                        || selectedDate.toLowerCase().includes(pred.date.toLowerCase()));

                // Compare with selected date - either the extracted date matches or it's a tournament name match
                return extractedDate === selectedDate ||
                    matchesStandardDate ||
                    pred.date.includes(selectedDate) ||
                    tournamentMatch;
            });
            setFilteredPredictions(filtered);
        }

        // Reset pagination when filters change
        setPageNumber(1);
        setHasMore(true);
    }, [selectedDate, predictions]);

    // Effect to load initial page of data when filteredPredictions changes
    useEffect(() => {
        if (filteredPredictions.length > 0) {
            // Only show first page initially
            setDisplayedPredictions(filteredPredictions.slice(0, ITEMS_PER_PAGE));
            setHasMore(filteredPredictions.length > ITEMS_PER_PAGE);
        } else {
            setDisplayedPredictions([]);
            setHasMore(false);
        }
    }, [filteredPredictions]);

    // Intersection observer for infinite loading
    const observer = useRef<IntersectionObserver | null>(null);

    const lastElementRef = useCallback((node: HTMLDivElement | null) => {
        if (isLoadingMore) return;

        if (observer.current) observer.current.disconnect();

        observer.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && hasMore) {
                loadMoreData();
            }
        }, { threshold: 0.5 });

        if (node) observer.current.observe(node);
    }, [isLoadingMore, hasMore]);

    // Function to load more data as user scrolls
    const loadMoreData = useCallback(() => {
        if (!hasMore || isLoadingMore) return;

        setIsLoadingMore(true);

        // Simulate loading delay for better UX
        setTimeout(() => {
            const nextPage = pageNumber + 1;
            const startIndex = (nextPage - 1) * ITEMS_PER_PAGE;
            const endIndex = nextPage * ITEMS_PER_PAGE;

            const newItems = filteredPredictions.slice(startIndex, endIndex);

            if (newItems.length > 0) {
                setDisplayedPredictions(prev => [...prev, ...newItems]);
                setPageNumber(nextPage);
                setHasMore(endIndex < filteredPredictions.length);
            } else {
                setHasMore(false);
            }

            setIsLoadingMore(false);
        }, 800);
    }, [pageNumber, filteredPredictions, hasMore, isLoadingMore]);

    // Fetch predictions when component mounts or sport type changes
    useEffect(() => {
        fetchPredictions();
    }, [selectedSportType]);

    // Function to fetch prediction data from Firestore
    const fetchPredictions = async () => {
        try {
            setIsLoading(true);
            setIsTableLoading(true);
            // Clear current predictions immediately to show loading state
            setDisplayedPredictions([]);

            // Check if we have cached predictions for this sport type
            const currentTime = Date.now();
            const predictionsKey = `sportType_${selectedSportType}`;
            const cachedPredictions = predictionsCache[predictionsKey];

            // Always get fresh dates first to ensure we have the latest
            setLoadingStatus(`Fetching available dates...`);
            const datesData = await getPredictionDates(selectedSportType);

            // Cache the dates
            datesCache[selectedSportType] = {
                timestamp: currentTime,
                dates: datesData
            };

            setAvailableDates(datesData);

            // If we have dates and no date is selected, select the first (most recent) date
            if (datesData.length > 0 && !selectedDate) {
                setSelectedDate(datesData[0]);
            }

            let predictionsData: BettingPrediction[];

            // Only use cached predictions if they exist and aren't expired
            if (cachedPredictions && (currentTime - cachedPredictions.timestamp) < CACHE_EXPIRY_MS) {
                console.log(`Using cached predictions for ${selectedSportType}`);
                setLoadingStatus("Using cached predictions data...");
                predictionsData = cachedPredictions.data;
            } else {
                // Fetch fresh predictions from Firestore
                console.log(`Fetching predictions for ${selectedSportType} from Firestore`);
                setLoadingStatus(`Fetching ${selectedSportType} predictions...`);
                predictionsData = await getPredictionsBySportType(selectedSportType);

                // Cache the result
                predictionsCache[predictionsKey] = {
                    timestamp: currentTime,
                    data: predictionsData
                };
            }

            // Set predictions
            setPredictions(predictionsData);

            setLoadingStatus("");
            setIsTableLoading(false);
        } catch (error) {
            console.error("Error fetching predictions:", error);
            showNotification("Error fetching predictions data", "error");
            setLoadingStatus("");
            setIsTableLoading(false);
        } finally {
            setIsLoading(false);
        }
    };

    // Function to handle date selection
    const handleDateChange = async (date: string) => {
        if (isLoading) return;

        setSelectedDate(date);

        // If "All Dates" option is selected
        if (!date) {
            // Just show all existing predictions
            return;
        }

        setIsLoading(true);
        setIsTableLoading(true);

        try {
            // Check cache for date-specific predictions
            const currentTime = Date.now();
            const cacheKey = `date_${date}_sportType_${selectedSportType}`;
            const cachedDatePredictions = predictionsCache[cacheKey];

            let datePredictions: BettingPrediction[];

            if (cachedDatePredictions && (currentTime - cachedDatePredictions.timestamp) < CACHE_EXPIRY_MS) {
                console.log(`Using cached predictions for date: ${date}`);
                setLoadingStatus("Using cached date data...");
                datePredictions = cachedDatePredictions.data;
            } else {
                // Fetch fresh predictions for this date and sport type
                console.log(`Fetching predictions for date: ${date}`);
                setLoadingStatus(`Fetching data for ${date}...`);
                datePredictions = await getPredictionsByDate(date, selectedSportType);

                // Cache the result
                predictionsCache[cacheKey] = {
                    timestamp: currentTime,
                    data: datePredictions
                };
            }

            if (datePredictions.length > 0) {
                // Update predictions with date-specific data
                setPredictions(datePredictions);
                showNotification(`Loaded data for date: ${formatDateDisplay(date)}`, "success");
            } else {
                // Try filtering existing data if already loaded
                const existingMatches = predictions.filter(pred => {
                    if (!pred.date) return false;
                    // Extract the main date part if it has a time component
                    const dateMatch = pred.date.match(/(\d+[a-z]{2}\s+[A-Za-z]+\s+\d{4})/);
                    const mainDate = dateMatch && dateMatch[1] ? dateMatch[1].trim() : pred.date;
                    return mainDate === date || pred.date.includes(date);
                });

                if (existingMatches.length > 0) {
                    // We already have data for this date in our predictions
                    showNotification(`Found data for date: ${formatDateDisplay(date)}`, "success");
                } else {
                    showNotification(`No predictions found for date: ${formatDateDisplay(date)}`, "warning");
                }
            }
        } catch (error) {
            console.error("Error loading predictions for date:", error);
            showNotification("Error loading predictions for selected date", "error");
        } finally {
            setIsLoading(false);
            setIsTableLoading(false);
        }
    };

    // Debounced sport type change to prevent multiple rapid calls
    const handleSportTypeChange = (sportType: string) => {
        if (isLoading) return;
        if (sportType === selectedSportType) return; // Don't do anything if same type selected

        // Set the active sport type change
        activeSportTypeChangeRef.current = sportType;

        // Show loading state immediately
        setIsTableLoading(true);
        // Clear current data to show loading state immediately - we want to
        // remove old data immediately to avoid confusion
        setDisplayedPredictions([]);
        setPredictions([]);
        setFilteredPredictions([]);

        // Update state
        setSelectedSportType(sportType);

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
        // The useEffect will trigger fetchPredictions
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
            // Parse scores - assuming format like "2:0" or "1:2"
            const [predTeam1Sets, predTeam2Sets] = predictionScore.split(":").map(Number);
            const [actualTeam1Sets, actualTeam2Sets] = actualScore.split(":").map(Number);

            if (isNaN(predTeam1Sets) || isNaN(predTeam2Sets) ||
                isNaN(actualTeam1Sets) || isNaN(actualTeam2Sets)) {
                return false;
            }

            // Prediction is correct if it correctly identified the winner
            const predWinner = predTeam1Sets > predTeam2Sets ? 1 : 2;
            const actualWinner = actualTeam1Sets > actualTeam2Sets ? 1 : 2;

            return predWinner === actualWinner;
        } catch (err) {
            console.error("Error comparing scores:", err);
            return false;
        }
    };

    // Function to get final score from API
    const getFinalScoreFromApi = (prediction: BettingPrediction): string | null => {
        try {
            // Ensure we have valid player names
            if (!prediction.team1 || !prediction.team2) return null;

            // Create direct key using prediction names
            const directKey = `${prediction.team1} vs ${prediction.team2}`;

            // Try direct key first (most reliable match)
            if (apiMatchScores[directKey]) {
                return apiMatchScores[directKey];
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
                if (apiMatchScores[key]) {
                    // For reversed matches, we need to reverse the score
                    if (key.startsWith(prediction.team2) || key.startsWith(matchedTeam2)) {
                        const [score1, score2] = apiMatchScores[key].split('-');
                        return `${score2}-${score1}`;
                    }
                    return apiMatchScores[key];
                }
            }

            return null;
        } catch (error) {
            console.error("Error getting score from API:", error);
            return null;
        }
    };

    // Function to get set scores from API
    const getSetScoresFromApi = (prediction: BettingPrediction): { homeTeam: { set1: number; set2: number; }; awayTeam: { set1: number; set2: number; } } | null => {
        try {
            // Ensure we have valid player names
            if (!prediction.team1 || !prediction.team2) return null;

            // Create direct key using prediction names
            const directKey = `${prediction.team1} vs ${prediction.team2}`;

            // Try direct key first (most reliable match)
            if (apiMatchSetScores[directKey]) {
                return apiMatchSetScores[directKey];
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
                if (apiMatchSetScores[key]) {
                    // For reversed matches, we need to swap home and away
                    if (key.startsWith(prediction.team2) || key.startsWith(matchedTeam2)) {
                        const originalSetScores = apiMatchSetScores[key];
                        return {
                            homeTeam: { ...originalSetScores.awayTeam },
                            awayTeam: { ...originalSetScores.homeTeam }
                        };
                    }
                    return apiMatchSetScores[key];
                }
            }

            return null;
        } catch (error) {
            console.error("Error getting set scores from API:", error);
            return null;
        }
    };

    // Function to format set scores for display: (6:2, 10:3)
    const formatSetScores = (setScores: { homeTeam: { set1: number; set2: number; }; awayTeam: { set1: number; set2: number; } } | null): string => {
        if (!setScores) return "";

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
        // If no API score, use existing logic for prediction's finalScore
        if (!apiScore) {
            return prediction.finalScore && isBetSuccessful(prediction)
                ? "bg-green-700 text-green-100"
                : "bg-green-900 text-green-100";
        }

        // Compare API score with prediction
        const isCorrect = compareTennisScores(prediction.scorePrediction, apiScore);
        return isCorrect ? "bg-green-600 text-green-100" : "bg-green-800 text-green-100";
    };

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
                        disabled={isLoading}
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
            {/* Data summary when we have a lot of data */}
            {filteredPredictions.length > ITEMS_PER_PAGE && (
                <div className="mb-4 p-3 bg-gray-700 rounded-lg text-gray-200 flex justify-between">
                    <span>Showing {displayedPredictions.length} of {filteredPredictions.length} predictions</span>
                    {!hasMore && displayedPredictions.length < filteredPredictions.length && (
                        <button
                            onClick={() => {
                                setDisplayedPredictions(filteredPredictions);
                                setHasMore(false);
                            }}
                            className="text-blue-300 hover:text-blue-400 underline"
                        >
                            Show all
                        </button>
                    )}
                </div>
            )}

            <div className="overflow-x-auto w-full">
                {isTableLoading ? (
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
                                        <th className="py-3 px-4 text-center font-bold text-gray-300">Confidence</th>
                                        <th className="py-3 px-4 text-center font-bold text-gray-300 w-[10%]">Team 1 Win</th>
                                        <th className="py-3 px-4 text-center font-bold text-gray-300 w-[10%]">Team 2 Win</th>
                                        <th className="py-3 px-4 text-center font-bold text-gray-300 w-[15%]">Final Score</th>
                                    </tr>
                                </thead>
                                <tbody>
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
                                        const predictionSetScores = extractSetScores(prediction.scorePrediction);

                                        // Clean the score prediction for display (remove set details)
                                        const cleanedScorePrediction = cleanScorePrediction(prediction.scorePrediction);

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
                                                    <div className="text-blue-300 font-bold">{cleanedScorePrediction}</div>
                                                    {predictionSetScores && (
                                                        <div className="text-xs text-blue-200 mt-1">{predictionSetScores}</div>
                                                    )}
                                                </td>
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
                                                <td className={`py-3 px-4 text-center w-[15%] ${getScoreClass(prediction, apiScore)}`}>
                                                    {!apiScore && !prediction.finalScore ? (
                                                        <TableSpinner />
                                                    ) : (
                                                        <>
                                                            <div className="font-bold">{displayScore}</div>
                                                            {finalSetScores && (
                                                                <div className="text-xs text-green-100 mt-1">{finalSetScores}</div>
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
                                const predictionSetScores = extractSetScores(prediction.scorePrediction);

                                // Clean the score prediction for display (remove set details)
                                const cleanedScorePrediction = cleanScorePrediction(prediction.scorePrediction);

                                // Check if this is the last card for ref attachment
                                const isLastCard = index === displayedPredictions.length - 1 && hasMore;

                                return (
                                    <div
                                        key={index}
                                        className={`mb-4 p-4 rounded-lg border ${apiScore ?
                                            (compareTennisScores(prediction.scorePrediction, apiScore) ?
                                                "border-green-600 bg-green-700" :
                                                "border-green-700 bg-green-800") :
                                            (prediction.finalScore && isBetSuccessful(prediction) ?
                                                "border-green-600 bg-green-700" :
                                                "border-green-700 bg-green-900")
                                            }`}
                                        ref={isLastCard ? lastElementRef : null}
                                    >
                                        <div className="mb-3 pb-2 border-b border-gray-700 flex justify-between">
                                            <div className="text-sm text-gray-400 text-center">
                                                <div>{formatDateDisplay(prediction.date)}</div>
                                                <div className="text-xs text-gray-500 mt-1">{extractTimeFromDate(prediction.date)}</div>
                                            </div>
                                            <div className="text-center">
                                                <div className="text-sm font-medium text-blue-300">{cleanedScorePrediction}</div>
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
                                            </div>
                                            <div className="text-center">
                                                <div className="text-sm text-gray-400">Final Score</div>
                                                {!apiScore && !prediction.finalScore ? (
                                                    <div className="mt-1">
                                                        <CardSpinner />
                                                    </div>
                                                ) : (
                                                    <>
                                                        <div className="font-bold text-green-200">
                                                            {displayScore}
                                                        </div>
                                                        {finalSetScores && (
                                                            <div className="text-xs text-green-100">{finalSetScores}</div>
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

            {/* Load more button (as an alternative to scroll-based loading) */}
            {hasMore && filteredPredictions.length > displayedPredictions.length && !isLoadingMore && (
                <div className="flex justify-center mt-4 mb-4">
                    <button
                        onClick={loadMoreData}
                        className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition-colors"
                        disabled={isLoadingMore}
                    >
                        Load More Predictions
                    </button>
                </div>
            )}

            {/* Invisible reference element for intersection observer */}
            <div ref={loaderRef} className="h-4" />
        </div>
    );
};

export default BettingPredictionsTable;