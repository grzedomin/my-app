import React, { useState, useEffect } from "react";
import { PieChart } from "react-minimal-pie-chart";
import * as XLSX from "xlsx";
import { useNotification } from "@/context/NotificationContext";
import { getAllFiles, FileData, fetchExcelFile, getFilesByDate, getFilesBySportType } from "@/lib/storage";
import AdminExcelPanel from "@/components/admin/AdminExcelPanel";
import { useSearchParams } from "next/navigation";
import { useMatchesByDate } from "@/hooks/useMatchesByDate";

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

interface BettingPrediction {
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
}

// Define a type for the Excel row data
interface ExcelRowData {
    Date?: string;
    Team_1?: string;
    Odd_1?: string | number;
    Team_2?: string;
    Odd_2?: string | number;
    Score_prediction?: string;
    Confidence?: string | number;
    Betting_predictions_team_1_win?: string | number;
    Betting_predictions_team_2_win?: string | number;
    Final_Score?: string;
    [key: string]: string | number | undefined;
}

// Helper function to format date display
const formatDateDisplay = (dateStr: string | undefined): string => {
    if (!dateStr) return "";

    // Extract main date part if it includes time
    const dateMatch = dateStr.match(/(\d+[a-z]{2}\s+[A-Za-z]+\s+\d{4})/);
    return dateMatch && dateMatch[1] ? dateMatch[1].trim() : dateStr;
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

const BettingPredictionsTable: React.FC = () => {
    const { showNotification } = useNotification();
    const searchParams = useSearchParams();

    const [predictions, setPredictions] = useState<BettingPrediction[]>([]);
    const [filteredPredictions, setFilteredPredictions] = useState<BettingPrediction[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [isLoadingFiles, setIsLoadingFiles] = useState(false);
    const [selectedDate, setSelectedDate] = useState<string>("");
    const [availableDates, setAvailableDates] = useState<string[]>([]);

    // Get initial sport type from URL parameters or default to tennis
    const [selectedSportType, setSelectedSportType] = useState<string>(() => {
        const sportParam = searchParams.get("sport");
        return sportParam || "tennis";
    });

    // Use our custom hook to fetch matches by date
    const {
        error: matchesError,
        apiPlayerNames,
        apiMatchScores,
        apiMatchSetScores,
        findBestPlayerMatch
    } = useMatchesByDate(selectedDate, predictions);

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
            // Now using the simplified date format without time component
            const filtered = predictions.filter(pred => {
                if (!pred.date) return false;

                // Extract the main date part if it has a time component
                const dateMatch = pred.date.match(/(\d+[a-z]{2}\s+[A-Za-z]+\s+\d{4})/);
                const mainDate = dateMatch && dateMatch[1] ? dateMatch[1].trim() : pred.date;

                // Compare with selected date
                return mainDate === selectedDate || pred.date.includes(selectedDate);
            });
            setFilteredPredictions(filtered);
        }
    }, [selectedDate, predictions]);

    // Fetch saved files when component mounts or sport type changes
    useEffect(() => {
        fetchSavedFiles();
    }, [selectedSportType]);

    // Function to fetch saved files from database
    const fetchSavedFiles = async () => {
        try {
            setIsLoadingFiles(true);

            // Get all files regardless of the user, filtered by sport type if selected
            let files;
            if (selectedSportType) {
                files = await getFilesBySportType(selectedSportType);
            } else {
                files = await getAllFiles();
            }

            // Extract unique dates from files
            const dates = files
                .map(file => file.fileDate)
                .filter((date): date is string => !!date)
                .filter((date, index, self) => self.indexOf(date) === index)
                .sort();

            setAvailableDates(dates);

            // Automatically load the most recent file (if any exist)
            if (files.length > 0) {
                // Sort files by uploadDate (descending order - newest first)
                const sortedFiles = [...files].sort((a, b) => b.uploadDate - a.uploadDate);
                const mostRecentFile = sortedFiles[0];

                // Set the selected date if available
                if (mostRecentFile.fileDate) {
                    setSelectedDate(mostRecentFile.fileDate);
                }

                // Load the most recent file
                await handleLoadFile(mostRecentFile);
            } else {
                // No files - reset predictions
                setPredictions([]);
            }
        } catch (error) {
            console.error("Error fetching files:", error);
            showNotification("Error fetching saved files", "error");
        } finally {
            setIsLoadingFiles(false);
        }
    };

    // Function to handle date selection
    const handleDateChange = async (date: string) => {
        if (isUploading || isLoadingFiles) return;

        setSelectedDate(date);

        // If "All Dates" option is selected
        if (!date) {
            // Just show all existing predictions
            return;
        }

        setIsLoadingFiles(true);

        try {
            // Get files for the selected date and sport type
            const files = await getFilesByDate(date, selectedSportType);

            if (files.length > 0) {
                // Load the first file with this date
                await handleLoadFile(files[0]);
                // Date filtering will be automatically applied through the useEffect
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
                    showNotification(`No files found for date: ${formatDateDisplay(date)}`, "warning");
                    // Don't clear all predictions, just filter to empty set
                    // The useEffect will take care of this
                }
            }
        } catch (error) {
            console.error("Error loading files for date:", error);
            showNotification("Error loading files for selected date. The Firebase index may still be creating.", "error");
        } finally {
            setIsLoadingFiles(false);
        }
    };

    // Function to handle sport type change
    const handleSportTypeChange = (sportType: string) => {
        if (isUploading || isLoadingFiles) return;

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
        // The useEffect will trigger fetchSavedFiles
    };

    // Function to load file data from storage
    const handleLoadFile = async (fileData: FileData) => {
        if (isUploading) return;
        setIsUploading(true);

        try {
            // Use the new fetchExcelFile function to avoid CORS issues
            const arrayBuffer = await fetchExcelFile(fileData.filePath);

            try {
                // Process the Excel file using the array buffer
                const workbook = XLSX.read(arrayBuffer, { type: "array" });
                const sheetName = workbook.SheetNames[0];

                if (!sheetName) {
                    throw new Error("Excel file doesn't contain any sheets");
                }

                const worksheet = workbook.Sheets[sheetName];

                // Convert the Excel data to JSON
                const jsonData = XLSX.utils.sheet_to_json<ExcelRowData>(worksheet);

                if (jsonData.length === 0) {
                    throw new Error("Excel file doesn't contain any data");
                }
                // Map the Excel data to our BettingPrediction interface
                const mappedData = jsonData.map((row: ExcelRowData) => {
                    return {
                        date: row.Date ?? "",
                        team1: row.Team_1 ?? "",
                        oddTeam1: parseFloat(row.Odd_1?.toString() ?? "0"),
                        team2: row.Team_2 ?? "",
                        oddTeam2: parseFloat(row.Odd_2?.toString() ?? "0"),
                        scorePrediction: row.Score_prediction ?? "",
                        confidence: parseFloat(row.Confidence?.toString() ?? "0"),
                        bettingPredictionTeam1Win: parseFloat(row.Betting_predictions_team_1_win?.toString() ?? "0"),
                        bettingPredictionTeam2Win: parseFloat(row.Betting_predictions_team_2_win?.toString() ?? "0"),
                        finalScore: row.Final_Score ?? ""
                    } as BettingPrediction;
                });
                setPredictions(mappedData);
                setIsUploading(false);
            } catch (error) {
                console.error("Error parsing Excel file:", error);
                const errorMessage = error instanceof Error ? error.message : "Unknown error";
                showNotification(`Failed to parse Excel file: ${errorMessage}`, "error");
                setIsUploading(false);
            }
        } catch (error: unknown) {
            console.error("Error loading file:", error);
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            showNotification(`Failed to load file: ${errorMessage}`, "error");
            setIsUploading(false);
        }
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

    // Function to get the final score from API match data if available
    const getFinalScoreFromApi = (prediction: BettingPrediction): string | null => {
        if (!prediction.team1 || !prediction.team2 || !findBestPlayerMatch) return null;

        // Try to match with fuzzy matching first if we have API player names
        if (apiPlayerNames.length > 0) {
            // Try to match using findBestPlayerMatch from our hook
            const mappedTeam1 = findBestPlayerMatch(prediction.team1);
            const mappedTeam2 = findBestPlayerMatch(prediction.team2);

            // Create lookup key with the matched names
            const key = `${mappedTeam1.toLowerCase().trim()}-${mappedTeam2.toLowerCase().trim()}`;
            if (apiMatchScores.has(key)) {
                return apiMatchScores.get(key) || null;
            }

            // Try reversed order
            const keyReversed = `${mappedTeam2.toLowerCase().trim()}-${mappedTeam1.toLowerCase().trim()}`;
            if (apiMatchScores.has(keyReversed)) {
                // Get the reversed score and swap it back
                const reversedScore = apiMatchScores.get(keyReversed);
                if (reversedScore) {
                    const [score1, score2] = reversedScore.split(":");
                    return `${score2}:${score1}`;
                }
            }
        }

        // Fall back to exact name matching if fuzzy matching didn't work
        const key = `${prediction.team1.toLowerCase().trim().replace(/\s+/g, " ")}-${prediction.team2.toLowerCase().trim().replace(/\s+/g, " ")}`;

        // Check if we have a match in our apiMatchScores map
        if (apiMatchScores.has(key)) {
            return apiMatchScores.get(key) || null;
        }

        // No match found in API data
        return null;
    };

    // Function to get set scores from API match data if available
    const getSetScoresFromApi = (prediction: BettingPrediction): { homeTeam: { set1: number; set2: number; }; awayTeam: { set1: number; set2: number; } } | null => {
        if (!prediction.team1 || !prediction.team2 || !findBestPlayerMatch || !apiMatchSetScores) return null;

        // Try to match with fuzzy matching first
        if (apiPlayerNames.length > 0) {
            // Try to match using findBestPlayerMatch from our hook
            const mappedTeam1 = findBestPlayerMatch(prediction.team1);
            const mappedTeam2 = findBestPlayerMatch(prediction.team2);

            // Create lookup key with the matched names
            const key = `${mappedTeam1.toLowerCase().trim()}-${mappedTeam2.toLowerCase().trim()}`;
            if (apiMatchSetScores.has(key)) {
                return apiMatchSetScores.get(key) || null;
            }

            // Try reversed order
            const keyReversed = `${mappedTeam2.toLowerCase().trim()}-${mappedTeam1.toLowerCase().trim()}`;
            if (apiMatchSetScores.has(keyReversed)) {
                return apiMatchSetScores.get(keyReversed) || null;
            }
        }

        // Fall back to exact name matching
        const key = `${prediction.team1.toLowerCase().trim().replace(/\s+/g, " ")}-${prediction.team2.toLowerCase().trim().replace(/\s+/g, " ")}`;

        // Check if we have a match in our apiMatchSetScores map
        if (apiMatchSetScores.has(key)) {
            return apiMatchSetScores.get(key) || null;
        }

        // No match found in API data
        return null;
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
            {/* Admin Excel Management Panel */}
            <AdminExcelPanel
                onFileProcessed={setPredictions}
                isUploading={isUploading}
                setIsUploading={setIsUploading}
                isLoadingFiles={isLoadingFiles}
                setIsLoadingFiles={setIsLoadingFiles}
                selectedSportType={selectedSportType}
            />

            {/* Sport Type Filter */}
            <div className="mb-4 sm:mb-6">
                <h3 className="block text-sm font-medium text-gray-300 mb-2">
                    Sport Type
                </h3>
                <div className="flex space-x-2">
                    <button
                        onClick={() => handleSportTypeChange("tennis")}
                        className={`px-4 py-2 rounded-md ${selectedSportType === "tennis"
                            ? "bg-blue-600 text-white"
                            : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                            }`}
                        disabled={isLoadingFiles || isUploading}
                    >
                        Tennis
                    </button>
                    <button
                        onClick={() => handleSportTypeChange("table-tennis")}
                        className={`px-4 py-2 rounded-md ${selectedSportType === "table-tennis"
                            ? "bg-blue-600 text-white"
                            : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                            }`}
                        disabled={isLoadingFiles || isUploading}
                    >
                        Table Tennis
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
                        disabled={isLoadingFiles || isUploading}
                    >
                        <option value="">All Dates</option>
                        {availableDates.map((date) => (
                            <option key={date} value={date}>{formatDateDisplay(date)}</option>
                        ))}
                    </select>
                </div>
            )}

            <div className="overflow-x-auto w-full">
                {filteredPredictions && filteredPredictions.length > 0 ? (
                    <>
                        {/* Desktop Table - Hidden on small screens */}
                        <div className="hidden md:block w-full">
                            <table className="w-full bg-gray-800 border border-gray-700 shadow-md rounded-lg overflow-hidden">
                                <thead className="bg-gray-900">
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
                                    {filteredPredictions.map((prediction, index) => {
                                        // Get API score if available
                                        const apiScore = getFinalScoreFromApi(prediction);

                                        // Process final score
                                        let displayScore = "";
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

                                        return (
                                            <tr
                                                key={index}
                                                className={`${index % 2 === 0 ? "bg-gray-700" : "bg-gray-800"} border-t border-gray-700`}
                                            >
                                                <td className="py-3 px-4 text-center text-gray-300 w-[12%]">{formatDateDisplay(prediction.date)}</td>
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
                        </div>

                        {/* Mobile & Tablet Card View - Only visible on small screens */}
                        <div className="md:hidden px-0 sm:px-0 w-full">
                            {filteredPredictions.map((prediction, index) => {
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
                                    >
                                        <div className="mb-3 pb-2 border-b border-gray-700 flex justify-between">
                                            <div className="text-sm text-gray-400 text-center">{formatDateDisplay(prediction.date)}</div>
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
                        </div>
                    </>
                ) : (
                    <div className="bg-gray-800 p-6 text-center rounded-lg shadow-md border border-gray-700">
                        <h3 className="text-lg font-semibold text-gray-200 mb-2">No Predictions Available</h3>
                        <p className="text-gray-400">
                            {isLoadingFiles
                                ? "Loading predictions..."
                                : selectedDate
                                    ? `No predictions found for the selected date: ${formatDateDisplay(selectedDate)}`
                                    : "Please upload an Excel file with betting predictions."
                            }
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default BettingPredictionsTable;