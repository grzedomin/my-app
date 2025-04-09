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

    // Pagination states
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(14);

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
        // Reset to first page whenever the filter changes
        setCurrentPage(1);
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

    // Get current predictions for pagination
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentPredictions = filteredPredictions.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(filteredPredictions.length / itemsPerPage);

    // Change page
    const handlePageChange = (pageNumber: number) => {
        setCurrentPage(pageNumber);
    };

    // Previous page
    const handlePreviousPage = () => {
        if (currentPage > 1) {
            setCurrentPage(currentPage - 1);
        }
    };

    // Next page
    const handleNextPage = () => {
        if (currentPage < totalPages) {
            setCurrentPage(currentPage + 1);
        }
    };

    // Generate page numbers
    const getPageNumbers = () => {
        const pageNumbers = [];
        const maxPageButtonsToShow = 5;

        if (totalPages <= maxPageButtonsToShow) {
            // If we have fewer pages than the max to show, display all pages
            for (let i = 1; i <= totalPages; i++) {
                pageNumbers.push(i);
            }
        } else {
            // More complex logic for many pages
            const halfWay = Math.ceil(maxPageButtonsToShow / 2);

            // If we're in the first halfWay pages
            if (currentPage <= halfWay) {
                for (let i = 1; i <= maxPageButtonsToShow; i++) {
                    pageNumbers.push(i);
                }
            }
            // If we're in the last halfWay pages
            else if (currentPage > totalPages - halfWay) {
                for (let i = totalPages - maxPageButtonsToShow + 1; i <= totalPages; i++) {
                    pageNumbers.push(i);
                }
            }
            // If we're in the middle
            else {
                for (let i = currentPage - Math.floor(maxPageButtonsToShow / 2); i <= currentPage + Math.floor(maxPageButtonsToShow / 2); i++) {
                    pageNumbers.push(i);
                }
            }
        }

        return pageNumbers;
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
                    <label htmlFor="dateFilter" className="block text-sm font-medium text-gray-700 mb-1">
                        Filter by Date
                    </label>
                    <select
                        id="dateFilter"
                        value={selectedDate}
                        onChange={(e) => handleDateChange(e.target.value)}
                        className="block w-full sm:w-auto md:w-64 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        disabled={isLoadingFiles || isUploading}
                    >
                        <option value="">All Dates</option>
                        {availableDates.map((date) => (
                            <option key={date} value={date}>{formatDateDisplay(date)}</option>
                        ))}
                    </select>
                </div>
            )}

            <div className="overflow-x-auto -mx-4 sm:mx-0">
                {filteredPredictions && filteredPredictions.length > 0 ? (
                    <>
                        {/* Desktop Table - Hidden on small screens */}
                        <div className="hidden md:block">
                            <table className="min-w-full bg-white border border-gray-200 shadow-md rounded-lg overflow-hidden">
                                <thead className="bg-gray-100">
                                    <tr>
                                        <th className="py-3 px-4 text-left font-bold text-gray-700">Date</th>
                                        <th className="py-3 px-4 text-left font-bold text-gray-700">Team 1</th>
                                        <th className="py-3 px-4 text-left font-bold text-gray-700">Odd</th>
                                        <th className="py-3 px-4 text-left font-bold text-gray-700">Team 2</th>
                                        <th className="py-3 px-4 text-left font-bold text-gray-700">Odd</th>
                                        <th className="py-3 px-4 text-left font-bold text-gray-700">Score Prediction</th>
                                        <th className="py-3 px-4 text-left font-bold text-gray-700">Confidence</th>
                                        <th className="py-3 px-4 text-left font-bold text-gray-700">Betting Predictions Team 1 Win</th>
                                        <th className="py-3 px-4 text-left font-bold text-gray-700">Betting Predictions Team 2 Win</th>
                                        <th className="py-3 px-4 text-left font-bold text-gray-700">Final Score</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {currentPredictions.map((prediction, index) => (
                                        <tr
                                            key={index}
                                            className={`${index % 2 === 0 ? "bg-gray-50" : "bg-white"} border-t border-gray-200`}
                                        >
                                            <td className="py-3 px-4 text-gray-800">{formatDateDisplay(prediction.date)}</td>
                                            <td className="py-3 px-4 text-gray-800 font-semibold">{prediction.team1}</td>
                                            <td className="py-3 px-4 text-gray-800 font-bold">{prediction.oddTeam1.toFixed(3)}</td>
                                            <td className="py-3 px-4 text-gray-800 font-semibold">{prediction.team2}</td>
                                            <td className="py-3 px-4 text-gray-800 font-bold">{prediction.oddTeam2.toFixed(3)}</td>
                                            <td className="py-3 px-4 text-gray-800 font-medium">{prediction.scorePrediction}</td>
                                            <td className="py-3 px-4">
                                                {prediction.confidence > 0 ? (
                                                    <div className="flex items-center">
                                                        <div className="w-10 h-10 mr-2">
                                                            <PieChart
                                                                data={[
                                                                    { value: prediction.confidence, color: prediction.confidence > 70 ? "#4ade80" : prediction.confidence < 50 ? "#f87171" : "#fdba74" }
                                                                ]}
                                                                totalValue={100}
                                                                lineWidth={20}
                                                                background="#f3f4f6"
                                                                rounded
                                                                animate
                                                            />
                                                        </div>
                                                        <span className={`font-bold ${prediction.confidence > 70 ? "text-green-500" :
                                                            prediction.confidence < 50 ? "text-red-500" :
                                                                "text-amber-500"
                                                            }`}>
                                                            {prediction.confidence.toFixed(2)}%
                                                        </span>
                                                    </div>
                                                ) : "N/A"}
                                            </td>
                                            <td className={`py-3 px-4 text-gray-800 ${prediction.bettingPredictionTeam1Win > prediction.bettingPredictionTeam2Win ? "bg-green-100" : ""
                                                }`}>
                                                {prediction.bettingPredictionTeam1Win > 0 ? `${prediction.bettingPredictionTeam1Win}%` : ""}
                                            </td>
                                            <td className={`py-3 px-4 text-gray-800 ${prediction.bettingPredictionTeam2Win > prediction.bettingPredictionTeam1Win ? "bg-green-100" : ""
                                                }`}>
                                                {prediction.bettingPredictionTeam2Win > 0 ? `${prediction.bettingPredictionTeam2Win}%` : ""}
                                            </td>
                                            <td className={`py-3 px-4 text-gray-800 font-bold ${prediction.finalScore && isBetSuccessful(prediction) ? "bg-green-100" : ""
                                                }`}>
                                                {prediction.finalScore}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile & Tablet Card View - Only visible on small screens */}
                        <div className="md:hidden px-4">
                            {currentPredictions.map((prediction, index) => (
                                <div
                                    key={index}
                                    className={`mb-4 p-4 rounded-lg border ${prediction.finalScore && isBetSuccessful(prediction) ? "border-green-300 bg-green-50" : "border-gray-200 bg-white"}`}
                                >
                                    <div className="mb-3 pb-2 border-b border-gray-200 flex justify-between">
                                        <div className="text-sm text-gray-500">{formatDateDisplay(prediction.date)}</div>
                                        <div className="text-sm font-medium">{prediction.scorePrediction}</div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3 mb-3">
                                        <div>
                                            <div className="text-sm text-gray-500">Team 1</div>
                                            <div className="font-semibold">{prediction.team1}</div>
                                            <div className="font-bold text-gray-700">{prediction.oddTeam1.toFixed(3)}</div>
                                            <div className={`text-sm mt-1 ${prediction.bettingPredictionTeam1Win > prediction.bettingPredictionTeam2Win ? "text-green-600 font-semibold" : "text-gray-600"}`}>
                                                Win: {prediction.bettingPredictionTeam1Win}%
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-sm text-gray-500">Team 2</div>
                                            <div className="font-semibold">{prediction.team2}</div>
                                            <div className="font-bold text-gray-700">{prediction.oddTeam2.toFixed(3)}</div>
                                            <div className={`text-sm mt-1 ${prediction.bettingPredictionTeam2Win > prediction.bettingPredictionTeam1Win ? "text-green-600 font-semibold" : "text-gray-600"}`}>
                                                Win: {prediction.bettingPredictionTeam2Win}%
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex justify-between items-center mt-3 pt-2 border-t border-gray-200">
                                        <div>
                                            <div className="text-sm text-gray-500">Confidence</div>
                                            <div className="flex items-center">
                                                <div className="w-6 h-6 mr-2">
                                                    <PieChart
                                                        data={[
                                                            { value: prediction.confidence, color: prediction.confidence > 70 ? "#4ade80" : prediction.confidence < 50 ? "#f87171" : "#fdba74" }
                                                        ]}
                                                        totalValue={100}
                                                        lineWidth={20}
                                                        background="#f3f4f6"
                                                        rounded
                                                        animate
                                                    />
                                                </div>
                                                <span className={`font-bold text-sm ${prediction.confidence > 70 ? "text-green-500" :
                                                    prediction.confidence < 50 ? "text-red-500" :
                                                        "text-amber-500"
                                                    }`}>
                                                    {prediction.confidence.toFixed(2)}%
                                                </span>
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-sm text-gray-500">Final Score</div>
                                            <div className="font-bold">{prediction.finalScore || "Pending"}</div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Pagination Controls */}
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mt-6 px-4 py-3 bg-white border border-gray-200 rounded-lg">
                            <div className="flex items-center mb-3 sm:mb-0">
                                <p className="text-sm text-gray-700">
                                    Showing <span className="font-medium">{indexOfFirstItem + 1}</span> to{" "}
                                    <span className="font-medium">{Math.min(indexOfLastItem, filteredPredictions.length)}</span> of{" "}
                                    <span className="font-medium">{filteredPredictions.length}</span> results
                                </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <button
                                    onClick={handlePreviousPage}
                                    disabled={currentPage === 1}
                                    className={`px-3 py-1 rounded-md ${currentPage === 1
                                        ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                                        : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                                        }`}
                                >
                                    Previous
                                </button>

                                {getPageNumbers().map(number => (
                                    <button
                                        key={number}
                                        onClick={() => handlePageChange(number)}
                                        className={`px-3 py-1 rounded-md ${currentPage === number
                                            ? "bg-blue-600 text-white"
                                            : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                                            }`}
                                    >
                                        {number}
                                    </button>
                                ))}

                                <button
                                    onClick={handleNextPage}
                                    disabled={currentPage === totalPages}
                                    className={`px-3 py-1 rounded-md ${currentPage === totalPages
                                        ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                                        : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                                        }`}
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="bg-white p-6 text-center rounded-lg shadow-md">
                        <h3 className="text-lg font-semibold text-gray-700 mb-2">No Predictions Available</h3>
                        <p className="text-gray-500">
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