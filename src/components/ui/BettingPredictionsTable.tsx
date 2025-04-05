import React, { useState, useEffect } from "react";
import { PieChart } from "react-minimal-pie-chart";
import * as XLSX from "xlsx";
import { useAuth } from "@/context/AuthContext";
import { useNotification } from "@/context/NotificationContext";
import { uploadFile, getUserFiles, FileData, cleanupOrphanedFiles, fetchExcelFile } from "@/lib/storage";
import { FirebaseError } from "firebase/app";

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

const BettingPredictionsTable: React.FC = () => {

    const { user } = useAuth();
    const { showNotification } = useNotification();
    const [predictions, setPredictions] = useState<BettingPrediction[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadError, setUploadError] = useState("");
    const [isLoadingFiles, setIsLoadingFiles] = useState(false);

    // Pagination states
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(14);

    // Fetch saved files when component mounts
    useEffect(() => {
        if (user) {
            fetchSavedFiles();
        }
    }, [user]);

    // Function to fetch saved files from database
    const fetchSavedFiles = async () => {
        if (!user) return;

        try {
            setIsLoadingFiles(true);

            // First, clean up any orphaned file records
            await cleanupOrphanedFiles(user.uid);

            // Then get the updated list of files
            const files = await getUserFiles(user.uid);

            // Automatically load the most recent file (if any exist)
            if (files.length > 0) {
                // Sort files by uploadDate (descending order - newest first)
                const sortedFiles = [...files].sort((a, b) => b.uploadDate - a.uploadDate);
                const mostRecentFile = sortedFiles[0];

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

    // Function to handle file upload
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !user) {
            if (!user) {
                showNotification("You must be logged in to upload files", "error");
            }
            return;
        }

        // Check if file is an Excel file
        const fileExt = file.name.split(".").pop()?.toLowerCase();
        if (fileExt !== "xlsx" && fileExt !== "xls") {
            setUploadError("Please upload a valid Excel file (.xlsx or .xls)");
            showNotification("Please upload a valid Excel file (.xlsx or .xls)", "error");
            return;
        }

        setIsUploading(true);
        setUploadError("");

        try {
            // Process file data first - if it's not valid, don't upload
            const isValidExcel = await processExcelFile(file);

            if (!isValidExcel) {
                throw new Error("Invalid Excel file format");
            }

            // Upload file to Firebase if Excel content is valid
            await uploadFile(file, user.uid);
            showNotification(`File "${file.name}" uploaded successfully`, "success");

            // Refresh file list and automatically select the newly uploaded file
            await fetchSavedFiles();

            // Note: We don't need to manually call handleLoadFile here as fetchSavedFiles
            // will automatically load the most recent file (which will be this one)
        } catch (error: unknown) {
            console.error("Error uploading file:", error);

            // More specific error message based on error code
            if (error instanceof FirebaseError) {
                if (error.code === "storage/unauthorized") {
                    setUploadError("You don't have permission to upload files. Please check your authentication status.");
                    showNotification("Permission denied. Please login again.", "error");
                } else if (error.code === "storage/quota-exceeded") {
                    setUploadError("Storage quota exceeded. Please contact support.");
                    showNotification("Storage quota exceeded", "error");
                } else if (error.code === "storage/invalid-format") {
                    setUploadError("Invalid file format");
                    showNotification("Invalid file format", "error");
                } else {
                    setUploadError(`Failed to upload file: ${error.message || "Unknown error"}`);
                    showNotification("Failed to upload file to storage", "error");
                }
            } else {
                setUploadError(`Failed to upload file: ${error instanceof Error ? error.message : "Unknown error"}`);
                showNotification("Failed to upload file to storage", "error");
            }
        } finally {
            setIsUploading(false);
        }
    };

    // Function to process Excel file - returns true if successful, false otherwise
    const processExcelFile = async (file: File): Promise<boolean> => {
        return new Promise((resolve) => {
            const reader = new FileReader();

            reader.onload = (evt) => {
                try {
                    const binaryStr = evt.target?.result;
                    const workbook = XLSX.read(binaryStr, { type: "binary" });
                    const sheetName = workbook.SheetNames[0];

                    if (!sheetName) {
                        setUploadError("Excel file doesn't contain any sheets");
                        showNotification("Invalid Excel file format", "error");
                        resolve(false);
                        return;
                    }

                    const worksheet = workbook.Sheets[sheetName];

                    // Convert the Excel data to JSON
                    const jsonData = XLSX.utils.sheet_to_json<ExcelRowData>(worksheet);

                    if (jsonData.length === 0) {
                        setUploadError("Excel file doesn't contain any data");
                        showNotification("Excel file is empty", "error");
                        resolve(false);
                        return;
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
                    resolve(true);
                } catch (error) {
                    console.error("Error parsing Excel file:", error);
                    setUploadError("Failed to parse the Excel file. Please check the format.");
                    showNotification("Failed to parse Excel file", "error");
                    resolve(false);
                }
            };

            reader.onerror = () => {
                setUploadError("Error reading the file");
                showNotification("Error reading the file", "error");
                resolve(false);
            };

            reader.readAsBinaryString(file);
        });
    };

    // Function to load file data from storage
    const handleLoadFile = async (fileData: FileData) => {
        if (isUploading) return;
        setIsUploading(true);
        setUploadError("");

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
                setUploadError(`Failed to parse Excel file: ${errorMessage}`);
                showNotification("Failed to parse Excel file", "error");
                setIsUploading(false);
            }
        } catch (error: unknown) {
            console.error("Error loading file:", error);
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            setUploadError(`Failed to load file: ${errorMessage}`);
            showNotification("Failed to load file from storage", "error");
            setIsUploading(false);
        }
    };

    // // Function to delete file
    // const handleDeleteFile = async (fileData: FileData, e: React.MouseEvent) => {
    //     e.stopPropagation(); // Prevent triggering the parent click handler

    //     if (!user) return;

    //     try {
    //         await deleteFile(fileData.id);
    //         showNotification(`File "${fileData.fileName}" deleted successfully`, "success");

    //         // Refresh file list - this will automatically load the most recent file
    //         await fetchSavedFiles();

    //     } catch (error: unknown) {
    //         console.error("Error deleting file:", error);
    //         const errorMessage = error instanceof Error ? error.message : "Unknown error";
    //         showNotification(`Failed to delete file: ${errorMessage}`, "error");
    //     }
    // };

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
    const currentPredictions = predictions.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(predictions.length / itemsPerPage);

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
            <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
                <div className="flex flex-col md:flex-row items-start md:items-center mt-4 md:mt-0">
                    <div className="relative mr-4">
                        <input
                            type="file"
                            id="fileUpload"
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            accept=".xlsx,.xls"
                            onChange={handleFileUpload}
                            disabled={isUploading || !user}
                        />
                        <button
                            className={`px-4 py-2 rounded-md font-medium flex items-center ${isUploading ? "bg-blue-300" : user ? "bg-blue-600 hover:bg-blue-700" : "bg-gray-400"
                                } text-white`}
                            disabled={isUploading || !user}
                        >
                            {isUploading ? (
                                <>
                                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Processing...
                                </>
                            ) : (
                                <>
                                    <svg className="w-4 h-4 mr-2" fill="currentColor" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 101.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                                    </svg>
                                    Upload Excel File
                                </>
                            )}
                        </button>
                    </div>

                    <button
                        onClick={() => fetchSavedFiles()}
                        className={`px-4 py-2 rounded-md font-medium flex items-center ${isLoadingFiles ? "bg-blue-300" : "bg-blue-600 hover:bg-blue-700"} text-white`}
                        disabled={isLoadingFiles || !user}
                    >
                        {isLoadingFiles ? (
                            <>
                                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Refreshing...
                            </>
                        ) : (
                            <>
                                <svg className="w-4 h-4 mr-2" fill="currentColor" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                                </svg>
                                Refresh Files
                            </>
                        )}
                    </button>

                    <button
                        onClick={async () => {
                            if (!user) return;
                            try {
                                setIsLoadingFiles(true);
                                showNotification("Cleaning up orphaned files...", "info");
                                await cleanupOrphanedFiles(user.uid);
                                await fetchSavedFiles();
                                showNotification("Cleanup completed successfully", "success");
                            } catch (error) {
                                console.error("Error during cleanup:", error);
                                showNotification("Error during cleanup", "error");
                            } finally {
                                setIsLoadingFiles(false);
                            }
                        }}
                        className="ml-2 px-4 py-2 rounded-md font-medium flex items-center bg-amber-600 hover:bg-amber-700 text-white"
                        disabled={isLoadingFiles || !user}
                    >
                        <svg className="w-4 h-4 mr-2" fill="currentColor" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        Clean Up
                    </button>

                </div>
            </div>

            {uploadError && (
                <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4">
                    <div className="flex">
                        <div className="flex-shrink-0">
                            <svg className="h-5 w-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                            </svg>
                        </div>
                        <div className="ml-3">
                            <p className="text-sm text-red-700">{uploadError}</p>
                        </div>
                    </div>
                </div>
            )}

            <div className="overflow-x-auto">
                {predictions && predictions.length > 0 ? (
                    <>
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
                                        <td className="py-3 px-4 text-gray-800">{prediction.date}</td>
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

                        {/* Pagination Controls */}
                        <div className="flex items-center justify-between mt-6 px-4 py-3 bg-white border border-gray-200 rounded-lg">
                            <div className="flex items-center">
                                <p className="text-sm text-gray-700">
                                    Showing <span className="font-medium">{indexOfFirstItem + 1}</span> to{" "}
                                    <span className="font-medium">{Math.min(indexOfLastItem, predictions.length)}</span> of{" "}
                                    <span className="font-medium">{predictions.length}</span> results
                                </p>
                            </div>
                            <div className="flex items-center space-x-2">
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
                    <div className="bg-white border border-gray-200 shadow-md rounded-lg p-8 text-center">
                        <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <h3 className="text-lg font-semibold text-gray-800 mb-2">No predictions available</h3>
                        <div className="text-gray-600 mb-4">
                            <p className="mb-1"><span className="font-bold text-amber-600">No predictions</span> - Upload an Excel file to view betting predictions</p>
                        </div>

                    </div>
                )}
            </div>
        </div>
    );
};

export default BettingPredictionsTable;