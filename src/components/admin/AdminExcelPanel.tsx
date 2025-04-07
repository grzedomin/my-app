import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useNotification } from "@/context/NotificationContext";
import { uploadFile, getAllFiles, FileData, cleanupOrphanedFiles, fetchExcelFile, deleteFile } from "@/lib/storage";
import { FirebaseError } from "firebase/app";
import * as XLSX from "xlsx";
import AdminOnly from "@/components/AdminOnly";

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

interface AdminExcelPanelProps {
    onFileProcessed: (data: BettingPrediction[]) => void;
    isUploading: boolean;
    setIsUploading: (value: boolean) => void;
    isLoadingFiles: boolean;
    setIsLoadingFiles: (value: boolean) => void;
}

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

const AdminExcelPanel: React.FC<AdminExcelPanelProps> = ({
    onFileProcessed,
    isUploading,
    setIsUploading,
    isLoadingFiles,
    setIsLoadingFiles
}) => {
    const { user } = useAuth();
    const { showNotification } = useNotification();
    const [uploadError, setUploadError] = useState("");
    const [fileData, setFileData] = useState<FileData | null>(null);

    // Function to fetch saved files from database
    const fetchSavedFiles = async () => {
        try {
            setIsLoadingFiles(true);

            // If user is logged in, clean up their orphaned file records
            if (user) {
                await cleanupOrphanedFiles(user.uid);
            }

            // Get all files regardless of the user
            const files = await getAllFiles();

            // Automatically load the most recent file (if any exist)
            if (files.length > 0) {
                // Sort files by uploadDate (descending order - newest first)
                const sortedFiles = [...files].sort((a, b) => b.uploadDate - a.uploadDate);
                const mostRecentFile = sortedFiles[0];
                setFileData(mostRecentFile);

                // Load the most recent file
                await handleLoadFile(mostRecentFile);
            } else {
                // No files - reset predictions
                onFileProcessed([]);
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

                    // Map the Excel data
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
                        };
                    });

                    onFileProcessed(mappedData);
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
            // Use the fetchExcelFile function to avoid CORS issues
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

                // Map the Excel data
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
                    };
                });

                onFileProcessed(mappedData);
            } catch (error) {
                console.error("Error parsing Excel file:", error);
                const errorMessage = error instanceof Error ? error.message : "Unknown error";
                setUploadError(`Failed to parse Excel file: ${errorMessage}`);
                showNotification("Failed to parse Excel file", "error");
            }
        } catch (error: unknown) {
            console.error("Error loading file:", error);
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            setUploadError(`Failed to load file: ${errorMessage}`);
            showNotification("Failed to load file from storage", "error");
        } finally {
            setIsUploading(false);
        }
    };
    const handleDeleteFile = async (id: string) => {
        if (!user) return;

        try {
            await deleteFile(id);
            showNotification(`File "${id}" deleted successfully`, "success");

            // Refresh file list - this will automatically load the most recent file
            await fetchSavedFiles();

        } catch (error: unknown) {
            console.error("Error deleting file:", error);
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            showNotification(`Failed to delete file: ${errorMessage}`, "error");
        }
    };

    return (
        <AdminOnly>
            <div className="flex flex-col md:flex-row md:items-center mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-800 mb-3 md:mb-0 md:mr-4">Admin Excel Management</h3>

                <div className="flex flex-col md:flex-row items-start md:items-center">
                    <div className="relative mr-4 mb-3 md:mb-0">
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
                                        <path fillRule="evenodd" d="M5.5 13a3.5 3.5 0 01-.369-6.98 4 4 0 117.753-1.977A4.5 4.5 0 1113.5 13H11V9.413l1.293 1.293a1 1 0 001.414-1.414l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13H5.5z" clipRule="evenodd" />
                                        <path d="M9 13h2v5a1 1 0 11-2 0v-5z" />
                                    </svg>
                                    Upload Excel File
                                </>
                            )}
                        </button>
                    </div>

                    <button
                        onClick={() => fetchSavedFiles()}
                        className={`px-4 py-2 rounded-md font-medium flex items-center mr-4 mb-3 md:mb-0 ${isLoadingFiles ? "bg-blue-300" : "bg-blue-600 hover:bg-blue-700"} text-white`}
                        disabled={isLoadingFiles}
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
                                await handleDeleteFile(fileData?.id ?? "");
                                await fetchSavedFiles();
                                showNotification("Cleanup completed successfully", "success");
                            } catch (error) {
                                console.error("Error during cleanup:", error);
                                showNotification("Error during cleanup", "error");
                            } finally {
                                setIsLoadingFiles(false);
                            }
                        }}
                        className="px-4 py-2 rounded-md font-medium flex items-center bg-amber-600 hover:bg-amber-700 text-white"
                        disabled={isLoadingFiles}
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
        </AdminOnly>
    );
};

export default AdminExcelPanel; 