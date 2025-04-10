import React, { useState, useEffect } from "react";
import { PieChart } from "react-minimal-pie-chart";
import * as XLSX from "xlsx";
import { useNotification } from "@/context/NotificationContext";
import { getAllFiles, FileData, fetchExcelFile, getFilesByDate } from "@/lib/storage";
import AdminExcelPanel from "@/components/admin/AdminExcelPanel";

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
    Odd?: string | number;
    Team_2?: string;
    Odd2?: string | number;
    Score_prediction?: string;
    Confidence?: string | number;
    Betting_predictions_team_1_Win?: string | number;
    Betting_predictions_team_2_Win?: string | number;
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

const BettingPredictionsTable: React.FC = () => {

    const { showNotification } = useNotification();
    const [predictions, setPredictions] = useState<BettingPrediction[]>([]);
    const [filteredPredictions, setFilteredPredictions] = useState<BettingPrediction[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [isLoadingFiles, setIsLoadingFiles] = useState(false);
    const [selectedDate, setSelectedDate] = useState<string>("");
    const [availableDates, setAvailableDates] = useState<string[]>([]);

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

    // Fetch saved files when component mounts
    useEffect(() => {
        fetchSavedFiles();
    }, []);

    // Function to fetch saved files from database
    const fetchSavedFiles = async () => {
        try {
            setIsLoadingFiles(true);

            // Get all files regardless of the user
            const files = await getAllFiles();

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
            // Get files for the selected date
            const files = await getFilesByDate(date);

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
                        oddTeam1: parseFloat(row.Odd?.toString() ?? "0"),
                        team2: row.Team_2 ?? "",
                        oddTeam2: parseFloat(row.Odd2?.toString() ?? "0"),
                        scorePrediction: row.Score_prediction ?? "",
                        confidence: parseFloat(row.Confidence?.toString() ?? "0"),
                        bettingPredictionTeam1Win: parseFloat(row.Betting_predictions_team_1_win?.toString() ?? "0"),
                        bettingPredictionTeam2Win: parseFloat(row.Betting_predictions_team_2_win?.toString() ?? "0"),
                        finalScore: row.Final_Score ?? ""
                    } as BettingPrediction;
                });
                console.log(mappedData);
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

    // Function to check if the bet was successful
    const isBetSuccessful = (prediction: BettingPrediction): boolean => {
        if (!prediction.finalScore) return false;

        // Get the first number from the score prediction (team1 wins)
        const predictedTeam1Wins = parseInt(prediction.scorePrediction.split(":")[0]);
        // Get the first number from the final score (team1 actual wins)
        const actualTeam1Wins = parseInt(prediction.finalScore.split(":")[0]);

        // If team1 was predicted to win (score starts with 2) and actually won
        // or team2 was predicted to win (score starts with 0 or 1) and actually won
        if (predictedTeam1Wins === 2) {
            return actualTeam1Wins === 2;
        } else {
            return actualTeam1Wins < 2;
        }
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
                                        <th className="py-3 px-4 text-center font-bold text-gray-300 w-[8%]">Odd</th>
                                        <th className="py-3 px-4 text-center font-bold text-gray-300">Team 2</th>
                                        <th className="py-3 px-4 text-center font-bold text-gray-300 w-[8%]">Odd</th>
                                        <th className="py-3 px-4 text-center font-bold text-gray-300 w-[15%]">Score Prediction</th>
                                        <th className="py-3 px-4 text-center font-bold text-gray-300">Confidence</th>
                                        <th className="py-3 px-4 text-center font-bold text-gray-300 w-[10%]">Team 1 Win</th>
                                        <th className="py-3 px-4 text-center font-bold text-gray-300 w-[10%]">Team 2 Win</th>
                                        <th className="py-3 px-4 text-center font-bold text-gray-300 w-[15%]">Final Score</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredPredictions.map((prediction, index) => {
                                        console.log(prediction, 11);
                                        return (
                                            <tr
                                                key={index}
                                                className={`${index % 2 === 0 ? "bg-gray-700" : "bg-gray-800"} border-t border-gray-700`}
                                            >
                                                <td className="py-3 px-4 text-center text-gray-300 w-[12%]">{formatDateDisplay(prediction.date)}</td>
                                                <td className="py-3 px-4 text-center text-gray-200 font-semibold">{prediction.team1}</td>
                                                <td className="py-3 px-4 text-center text-gray-300 w-[8%]">{prediction.oddTeam1.toFixed(3)}</td>
                                                <td className="py-3 px-4 text-center text-gray-200 font-semibold">{prediction.team2}</td>
                                                <td className="py-3 px-4 text-center text-gray-300 w-[8%]">{prediction.oddTeam2.toFixed(3)}</td>
                                                <td className="py-3 px-4 text-center text-blue-300 font-bold w-[15%]">{prediction.scorePrediction}</td>
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
                                                <td className={`py-3 px-4 text-center font-bold w-[15%] ${prediction.finalScore && isBetSuccessful(prediction) ? "bg-green-900 text-green-100" : "text-gray-300"
                                                    }`}>
                                                    {prediction.finalScore}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile & Tablet Card View - Only visible on small screens */}
                        <div className="md:hidden px-0 sm:px-0 w-full">
                            {filteredPredictions.map((prediction, index) => (
                                <div
                                    key={index}
                                    className={`mb-4 p-4 rounded-lg border ${prediction.finalScore && isBetSuccessful(prediction) ? "border-green-700 bg-green-900" : "border-gray-700 bg-gray-800"}`}
                                >
                                    <div className="mb-3 pb-2 border-b border-gray-700 flex justify-between">
                                        <div className="text-sm text-gray-400 text-center">{formatDateDisplay(prediction.date)}</div>
                                        <div className="text-sm font-medium text-blue-300 text-center">{prediction.scorePrediction}</div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3 mb-3">
                                        <div className="text-center">
                                            <div className="text-sm text-gray-400">Team 1</div>
                                            <div className="font-semibold text-gray-200">{prediction.team1}</div>
                                            <div className="font-bold text-gray-300">{prediction.oddTeam1.toFixed(3)}</div>
                                            <div className={`text-sm mt-1 ${prediction.bettingPredictionTeam1Win > prediction.bettingPredictionTeam2Win ? "text-blue-400 font-semibold" : "text-gray-400"}`}>
                                                Win: {prediction.bettingPredictionTeam1Win}%
                                            </div>
                                        </div>
                                        <div className="text-center">
                                            <div className="text-sm text-gray-400">Team 2</div>
                                            <div className="font-semibold text-gray-200">{prediction.team2}</div>
                                            <div className="font-bold text-gray-300">{prediction.oddTeam2.toFixed(3)}</div>
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
                                            <div className="font-bold text-gray-200">{prediction.finalScore || "Pending"}</div>
                                        </div>
                                    </div>
                                </div>
                            ))}
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