import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useNotification } from "@/context/NotificationContext";
import {
    uploadMultipleFiles,
    getAllFiles,
    FileData,
    cleanupOrphanedFiles,
    fetchExcelFile,
    getFilesByDate,
    getFilesBySportType,
    deleteFile
} from "@/lib/storage";
import { FirebaseError } from "firebase/app";
import * as XLSX from "xlsx";
import AdminOnly from "@/components/AdminOnly";
import { useSearchParams } from "next/navigation";

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
    selectedSportType?: string;
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
    setIsLoadingFiles,
    selectedSportType: propSportType = "tennis"
}) => {
    const { user } = useAuth();
    const { showNotification } = useNotification();
    const searchParams = useSearchParams();

    const [uploadError, setUploadError] = useState("");
    const [availableFiles, setAvailableFiles] = useState<FileData[]>([]);
    const [selectedDate, setSelectedDate] = useState<string>("");
    const [availableDates, setAvailableDates] = useState<string[]>([]);

    // Get sport type from URL params or use the prop value
    const [selectedSportType, setSelectedSportType] = useState<string>(() => {
        const sportParam = searchParams.get("sport");
        return sportParam || propSportType;
    });

    // Handle sport type change
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

        // Reset data when changing sport type
        setSelectedDate("");
        fetchSavedFiles(); // Will fetch files for the new sport type
    };

    // Update when propSportType changes
    useEffect(() => {
        if (propSportType !== selectedSportType) {
            setSelectedSportType(propSportType);
            // Reset data when sport type changes from parent
            setSelectedDate("");
            fetchSavedFiles();
        }
    }, [propSportType]);

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

                    // Filter out rows that are just tournament headers
                    const validRows = jsonData.filter((row: ExcelRowData) => {
                        // Skip rows that don't have both Team_1 and Team_2 (likely tournament headers)
                        return row.Team_1 && row.Team_2;
                    });

                    if (validRows.length === 0) {
                        setUploadError("Excel file doesn't contain any valid match data");
                        showNotification("No valid match data found in the Excel file", "error");
                        resolve(false);
                        return;
                    }

                    // Map the Excel data
                    const mappedData = validRows.map((row: ExcelRowData) => {
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

                // Filter out rows that are just tournament headers
                const validRows = jsonData.filter((row: ExcelRowData) => {
                    // Skip rows that don't have both Team_1 and Team_2 (likely tournament headers)
                    return row.Team_1 && row.Team_2;
                });

                if (validRows.length === 0) {
                    throw new Error("Excel file doesn't contain any valid match data");
                }

                // Map the Excel data
                const mappedData = validRows.map((row: ExcelRowData) => {
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

    // Function to fetch saved files from database
    const fetchSavedFiles = async () => {
        try {
            setIsLoadingFiles(true);

            // If user is logged in, clean up their orphaned file records
            if (user) {
                await cleanupOrphanedFiles(user.uid);
            }

            // Get all files regardless of the user
            let files;
            if (selectedSportType) {
                files = await getFilesBySportType(selectedSportType);
            } else {
                files = await getAllFiles();
            }

            setAvailableFiles(files);

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
                onFileProcessed([]);
            }
        } catch (error) {
            console.error("Error fetching files:", error);
            showNotification("Error fetching saved files", "error");
        } finally {
            setIsLoadingFiles(false);
        }
    };

    // Function to handle file upload (updated for multiple files)
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || !files.length || !user) {
            if (!user) {
                showNotification("You must be logged in to upload files", "error");
            }
            return;
        }

        setIsUploading(true);
        setUploadError("");

        // Convert FileList to array
        const fileArray = Array.from(files);

        // Validate all files are Excel files
        const invalidFiles = fileArray.filter(file => {
            const fileExt = file.name.split(".").pop()?.toLowerCase();
            return fileExt !== "xlsx" && fileExt !== "xls";
        });

        if (invalidFiles.length > 0) {
            setUploadError("All files must be valid Excel files (.xlsx or .xls)");
            showNotification("Please upload only valid Excel files (.xlsx or .xls)", "error");
            setIsUploading(false);
            return;
        }

        try {
            // Process and validate each file before upload
            const validFiles: File[] = [];

            for (const file of fileArray) {
                const isValidExcel = await processExcelFile(file);
                if (isValidExcel) {
                    validFiles.push(file);
                } else {
                    showNotification(`File "${file.name}" has invalid format and will be skipped`, "warning");
                }
            }

            if (validFiles.length === 0) {
                throw new Error("No valid Excel files to upload");
            }

            // Upload all valid files with the selected sport type
            const uploadedFiles = await uploadMultipleFiles(validFiles, user.uid, "betting-files", selectedSportType);

            if (uploadedFiles.length > 0) {
                showNotification(`Successfully uploaded ${uploadedFiles.length} file(s)`, "success");

                // Refresh file list and automatically select the newly uploaded file
                await fetchSavedFiles();
            } else {
                showNotification("No files were uploaded successfully", "error");
            }
        } catch (error: unknown) {
            console.error("Error uploading files:", error);

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
                    setUploadError(`Failed to upload files: ${error.message || "Unknown error"}`);
                    showNotification("Failed to upload files to storage", "error");
                }
            } else {
                setUploadError(`Failed to upload files: ${error instanceof Error ? error.message : "Unknown error"}`);
                showNotification("Failed to upload files to storage", "error");
            }
        } finally {
            setIsUploading(false);
        }
    };

    // Handle date selection
    const handleDateChange = async (date: string) => {
        if (isUploading || isLoadingFiles) return;

        setSelectedDate(date);

        // If "All Dates" option is selected (empty date)
        if (!date) {
            // Sort files by uploadDate (newest first) and load the most recent
            const sortedFiles = [...availableFiles].sort((a, b) => b.uploadDate - a.uploadDate);
            if (sortedFiles.length > 0) {
                setIsLoadingFiles(true);
                try {
                    await handleLoadFile(sortedFiles[0]);
                    showNotification("Loaded most recent file", "success");
                } catch (error) {
                    console.error("Error loading most recent file:", error);
                    showNotification("Error loading most recent file", "error");
                } finally {
                    setIsLoadingFiles(false);
                }
            } else {
                // No files to load
                onFileProcessed([]);
            }
            return;
        }

        setIsLoadingFiles(true);

        try {
            // Get files for the selected date and sport type
            const files = await getFilesByDate(date, selectedSportType);

            if (files.length > 0) {
                // Use the first file with this date and load it automatically
                await handleLoadFile(files[0]);
                showNotification(`Loaded data for date: ${formatDateDisplay(date)}`, "success");
            } else {
                // Try to find a match in the existing files list
                const matchingFiles = availableFiles.filter(file =>
                    file.fileDate && (
                        file.fileDate === date ||
                        file.fileDate.includes(date)
                    ) && (
                        !selectedSportType || file.sportType === selectedSportType
                    )
                );

                if (matchingFiles.length > 0) {
                    // Load the first matching file
                    await handleLoadFile(matchingFiles[0]);
                    showNotification(`Loaded data for date: ${formatDateDisplay(date)}`, "success");
                } else {
                    showNotification(`No files found for date: ${date}`, "warning");
                    // Clear predictions if no files found
                    onFileProcessed([]);
                }
            }
        } catch (error) {
            console.error("Error loading files for date:", error);

            // Check if it's a Firebase index error
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            if (errorMessage.includes("requires an index")) {
                showNotification("Firebase index is being created. This may take a few minutes. Please try again later or use the 'Load' button on a file directly.", "warning");
            } else {
                showNotification("Error loading files for selected date", "error");
            }
        } finally {
            setIsLoadingFiles(false);
        }
    };

    // Helper function to format date display
    const formatDateDisplay = (dateStr: string | undefined): string => {
        if (!dateStr) return "";

        // Extract main date part if it includes time
        const dateMatch = dateStr.match(/(\d+[a-z]{2}\s+[A-Za-z]+\s+\d{4})/);
        return dateMatch && dateMatch[1] ? dateMatch[1].trim() : dateStr;
    };

    // Function to handle file deletion
    const handleDeleteFile = async (fileId: string, fileName: string) => {
        if (isUploading || isLoadingFiles) return;

        if (!confirm(`Are you sure you want to delete "${fileName}"? This action cannot be undone.`)) {
            return;
        }

        try {
            console.log(`Starting deletion of file: ${fileName} (ID: ${fileId})`);

            // Use the utility function that handles both Storage and Firestore deletion
            await deleteFile(fileId);
            console.log(`File deletion process completed for: ${fileName}`);

            showNotification(`Successfully deleted file: ${fileName}`, "success");
            // Refresh the file list
            await fetchSavedFiles();
        } catch (error) {
            console.error("Error deleting file:", error);

            // Check if it's a Firebase permission error
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            if (errorMessage.includes("permission-denied")) {
                showNotification("Permission denied. You may not have proper access rights.", "error");
            } else {
                showNotification(`Failed to delete file: ${errorMessage}`, "error");
            }
        }
    };

    console.log(availableFiles);

    return (
        <AdminOnly>
            <div className="mb-6 p-4 bg-gray-800 rounded-lg shadow-md border border-gray-700">
                <h2 className="text-lg font-semibold mb-4 text-white">Excel File Management</h2>

                {/* Upload Form */}
                <form className="mb-6">
                    <div className="flex flex-col md:flex-row items-start gap-4">
                        <div className="w-full">
                            <div className="mb-4">
                                <label htmlFor="sportType" className="block text-sm font-medium text-gray-300 mb-1">
                                    Sport Type
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    <button
                                        type="button"
                                        onClick={() => handleSportTypeChange("tennis")}
                                        className={`px-4 py-2 rounded-md ${selectedSportType === "tennis"
                                            ? "bg-blue-600 text-white"
                                            : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                                            }`}
                                        disabled={isUploading || isLoadingFiles}
                                    >
                                        Upload Tennis File
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleSportTypeChange("table-tennis")}
                                        className={`px-4 py-2 rounded-md ${selectedSportType === "table-tennis"
                                            ? "bg-blue-600 text-white"
                                            : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                                            }`}
                                        disabled={isUploading || isLoadingFiles}
                                    >
                                        Upload Table Tennis File
                                    </button>
                                </div>
                            </div>

                            <label htmlFor="fileUpload" className="block text-sm font-medium text-gray-300 mb-1">
                                Upload Excel File(s) for {selectedSportType === "tennis" ? "Tennis" : "Table Tennis"}
                            </label>
                            <input
                                type="file"
                                id="fileUpload"
                                onChange={handleFileUpload}
                                accept=".xlsx,.xls"
                                className="block w-full text-sm text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-900 file:text-blue-100 hover:file:bg-blue-800"
                                disabled={isUploading}
                                multiple // Enable multiple file selection
                            />
                            {uploadError && <p className="mt-1 text-sm text-red-400">{uploadError}</p>}
                        </div>

                        <button
                            type="button"
                            onClick={() => fetchSavedFiles()}
                            className={`px-4 py-2 rounded-md font-medium flex items-center mt-2 md:mt-6 ${isLoadingFiles ? "bg-blue-700" : "bg-blue-600 hover:bg-blue-700"} text-white`}
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
                    </div>
                </form>

                {/* Date Filter */}
                {availableDates.length > 0 && (
                    <div className="mb-6">
                        <label htmlFor="dateFilter" className="block text-sm font-medium text-gray-300 mb-1">
                            Filter by Date
                        </label>
                        <select
                            id="dateFilter"
                            value={selectedDate}
                            onChange={(e) => handleDateChange(e.target.value)}
                            className="block w-full md:w-64 px-3 py-2 bg-gray-700 border border-gray-600 rounded-md shadow-sm text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                            disabled={isLoadingFiles || isUploading}
                        >
                            <option value="">All Dates</option>
                            {availableDates.map((date) => (
                                <option key={date} value={date}>{formatDateDisplay(date)}</option>
                            ))}
                        </select>
                    </div>
                )}

                {/* File List */}
                {availableFiles.length > 0 && (
                    <div className="mt-6">
                        <h3 className="text-md font-semibold mb-2 text-white">Available Files</h3>
                        <div className="bg-gray-900 rounded-md p-2 overflow-hidden">
                            <div className="max-h-60 overflow-y-auto">
                                <table className="min-w-full divide-y divide-gray-700">
                                    <thead className="bg-gray-800 sticky top-0">
                                        <tr>
                                            <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">File Name</th>
                                            <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Date</th>
                                            <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Sport Type</th>
                                            <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-gray-900 divide-y divide-gray-800">
                                        {availableFiles.map((file) => (
                                            <tr key={file.id} className="hover:bg-gray-800">
                                                <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-300">{file.fileName}</td>
                                                <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-300">{formatDateDisplay(file.fileDate)}</td>
                                                <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-300">{file.sportType || "Unknown"}</td>
                                                <td className="px-3 py-2 whitespace-nowrap text-sm">
                                                    <div className="flex space-x-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleLoadFile(file)}
                                                            className="text-blue-400 hover:text-blue-300"
                                                            disabled={isUploading || isLoadingFiles}
                                                            aria-label={`Load file ${file.fileName}`}
                                                        >
                                                            Load
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDeleteFile(file.id, file.fileName)}
                                                            className="text-red-400 hover:text-red-300"
                                                            disabled={isUploading || isLoadingFiles}
                                                            aria-label={`Delete file ${file.fileName}`}
                                                        >
                                                            Delete
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </AdminOnly>
    );
};

export default AdminExcelPanel; 