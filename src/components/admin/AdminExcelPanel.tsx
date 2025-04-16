import React, { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { useNotification } from "@/context/NotificationContext";
import {
    uploadMultipleFiles,
    getAllFiles,
    cleanupOrphanedFiles,
    fetchExcelFile,
    deleteFile
} from "@/lib/storage";
import { FirebaseError } from "firebase/app";
import * as XLSX from "xlsx";
import AdminOnly from "@/components/AdminOnly";
import { useSearchParams } from "next/navigation";
import { BettingPrediction, FileData } from "@/types";

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
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [uploadError, setUploadError] = useState("");
    const [availableFiles, setAvailableFiles] = useState<FileData[]>([]);
    const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);

    // Confirmation modal state
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [fileToDelete, setFileToDelete] = useState<{ id: string, name: string } | null>(null);
    // Add a state for tracking delete operation loading
    const [isDeleting, setIsDeleting] = useState(false);

    // Get default sport type from URL params or props for viewing - but we won't use this for filtering
    const [viewSportType, setViewSportType] = useState<string>("all");

    // Forward declare handleLoadFile function
    const handleLoadFile = useCallback(async (fileData: FileData) => {
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
                showNotification(`Successfully loaded file: ${fileData.fileName}`, "success");
            } catch (error) {
                console.error("Error processing Excel file:", error);
                showNotification(`Error processing Excel file: ${error instanceof Error ? error.message : "Unknown error"}`, "error");
            }
        } catch (error) {
            console.error("Error loading file from storage:", error);
            showNotification("Failed to load file from storage", "error");
        } finally {
            setIsUploading(false);
        }
    }, [isUploading, setIsUploading, onFileProcessed, showNotification]);

    // Function to fetch saved files from database - using useCallback to avoid dependency cycles
    const fetchSavedFiles = useCallback(async () => {
        try {
            setIsLoadingFiles(true);

            // If user is logged in, clean up their orphaned file records
            if (user) {
                await cleanupOrphanedFiles(user.uid);
            }

            // Always get all files regardless of the user and sport type
            const files = await getAllFiles();

            setAvailableFiles(files);

            // Automatically load the most recent file (if any exist)
            if (files.length > 0) {
                // Sort files by uploadDate (descending order - newest first)
                const sortedFiles = [...files].sort((a, b) => b.uploadDate - a.uploadDate);
                const mostRecentFile = sortedFiles[0];

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
    }, [user, onFileProcessed, setIsLoadingFiles, showNotification, handleLoadFile]);

    // Update when propSportType changes - we keep these functions for compatibility
    useEffect(() => {
        if (propSportType !== viewSportType) {
            setViewSportType(propSportType);
            fetchSavedFiles();
        }
    }, [propSportType, viewSportType, fetchSavedFiles]);

    // Update when search params change
    useEffect(() => {
        const sportParam = searchParams.get("sport");
        if (sportParam && sportParam !== viewSportType) {
            setViewSportType(sportParam);
            fetchSavedFiles();
        }
    }, [searchParams, viewSportType, fetchSavedFiles]);

    // Function to detect sport type from file name
    const detectSportTypeFromFileName = (fileName: string): string | null => {
        // Extract file name without extension
        const fileNameWithoutExt = fileName.split(".")[0];

        // Check for tennis variants
        if (fileNameWithoutExt.startsWith("tennis-spread-")) {
            return "tennis";
        }
        if (fileNameWithoutExt.startsWith("tennis-kelly-")) {
            return "tennis";
        }
        if (fileNameWithoutExt.startsWith("tennis-")) {
            return "tennis";
        }

        // Check for table tennis variants
        if (fileNameWithoutExt.startsWith("table-tennis-kelly-")) {
            return "table-tennis";
        }
        if (fileNameWithoutExt.startsWith("table-tennis-")) {
            return "table-tennis";
        }

        return null;
    };

    // Function to check if file name follows the required format
    const isValidFileNameFormat = (fileName: string): boolean => {
        // Extract file name without extension
        const fileNameWithoutExt = fileName.split(".")[0];

        // Define the expected format for both sport types
        const datePattern = "\\d{2}-\\d{2}-\\d{4}"; // Format: DD-MM-YYYY

        // Regular tennis format
        const tennisPattern = new RegExp(`^tennis-${datePattern}$`);

        // Tennis with bet types
        const tennisSpreadPattern = new RegExp(`^tennis-spread-${datePattern}$`);
        const tennisKellyPattern = new RegExp(`^tennis-kelly-${datePattern}$`);

        // Table tennis formats
        const tableTennisPattern = new RegExp(`^table-tennis-${datePattern}$`);
        const tableTennisKellyPattern = new RegExp(`^table-tennis-kelly-${datePattern}$`);

        return (
            tennisPattern.test(fileNameWithoutExt) ||
            tableTennisPattern.test(fileNameWithoutExt) ||
            tennisSpreadPattern.test(fileNameWithoutExt) ||
            tennisKellyPattern.test(fileNameWithoutExt) ||
            tableTennisKellyPattern.test(fileNameWithoutExt)
        );
    };

    // Function to suggest valid file names based on current date
    const suggestValidFileNames = (): string[] => {
        const today = new Date();
        const day = String(today.getDate()).padStart(2, "0");
        const month = String(today.getMonth() + 1).padStart(2, "0");
        const year = today.getFullYear();

        const formattedDate = `${day}-${month}-${year}`;
        return [
            `tennis-${formattedDate}.xlsx`,
            `tennis-spread-${formattedDate}.xlsx`,
            `tennis-kelly-${formattedDate}.xlsx`,
            `table-tennis-${formattedDate}.xlsx`,
            `table-tennis-kelly-${formattedDate}.xlsx`
        ];
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

    // Function to handle file selection
    const handleFileSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || !files.length) {
            return;
        }

        setSelectedFiles(files);
        setUploadError("");
    };

    // Function to clear selected files
    const clearSelectedFiles = () => {
        setSelectedFiles(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    // Function to handle file upload
    const handleUploadSelectedFiles = async () => {
        if (!selectedFiles || !selectedFiles.length || !user) {
            if (!user) {
                showNotification("You must be logged in to upload files", "error");
            } else if (!selectedFiles || !selectedFiles.length) {
                showNotification("Please select files to upload", "error");
            }
            return;
        }

        setIsUploading(true);
        setUploadError("");

        // Convert FileList to array
        const fileArray = Array.from(selectedFiles);

        // Validate all files are Excel files and follow naming convention
        const invalidExtFiles = fileArray.filter(file => {
            const fileExt = file.name.split(".").pop()?.toLowerCase();
            return fileExt !== "xlsx" && fileExt !== "xls";
        });

        if (invalidExtFiles.length > 0) {
            setUploadError("All files must be valid Excel files (.xlsx or .xls)");
            showNotification("Please upload only valid Excel files (.xlsx or .xls)", "error");
            setIsUploading(false);
            return;
        }

        // Check file name format
        const invalidNameFiles = fileArray.filter(file => !isValidFileNameFormat(file.name));

        if (invalidNameFiles.length > 0) {
            const expectedFormats = [
                "tennis-DD-MM-YYYY.xlsx",
                "tennis-spread-DD-MM-YYYY.xlsx",
                "tennis-kelly-DD-MM-YYYY.xlsx",
                "table-tennis-DD-MM-YYYY.xlsx",
                "table-tennis-kelly-DD-MM-YYYY.xlsx"
            ];
            const suggestedExamples = suggestValidFileNames().join(", ");

            setUploadError(`File names must follow one of these formats: ${expectedFormats.join(", ")}. Examples: ${suggestedExamples}`);
            showNotification(`Invalid file name format. Please use one of the approved formats`, "error");

            // List invalid files
            if (invalidNameFiles.length <= 3) {
                const invalidNames = invalidNameFiles.map(f => f.name).join(", ");
                showNotification(`Invalid file names: ${invalidNames}`, "warning");
            } else {
                showNotification(`${invalidNameFiles.length} files have invalid names`, "warning");
            }

            setIsUploading(false);
            return;
        }

        try {
            // Group files by sport type
            const filesByType: Record<string, File[]> = {};

            for (const file of fileArray) {
                const sportType = detectSportTypeFromFileName(file.name);
                if (sportType) {
                    if (!filesByType[sportType]) {
                        filesByType[sportType] = [];
                    }
                    filesByType[sportType].push(file);
                } else {
                    throw new Error(`Could not determine sport type for file: ${file.name}`);
                }
            }

            // Process and validate each file before upload
            const validFiles: { file: File, sportType: string }[] = [];

            for (const sportType in filesByType) {
                for (const file of filesByType[sportType]) {
                    const isValidExcel = await processExcelFile(file);
                    if (isValidExcel) {
                        validFiles.push({ file, sportType });
                    } else {
                        showNotification(`File "${file.name}" has invalid format and will be skipped`, "warning");
                    }
                }
            }

            if (validFiles.length === 0) {
                throw new Error("No valid Excel files to upload");
            }

            // Upload files by sport type
            let totalUploaded = 0;

            for (const sportType in filesByType) {
                const filesToUpload = validFiles
                    .filter(item => item.sportType === sportType)
                    .map(item => item.file);

                if (filesToUpload.length > 0) {
                    const uploadedFiles = await uploadMultipleFiles(filesToUpload, user.uid, "betting-files", sportType);
                    totalUploaded += uploadedFiles.length;
                }
            }

            if (totalUploaded > 0) {
                showNotification(`Successfully uploaded ${totalUploaded} file(s)`, "success");

                // Refresh file list and automatically select the newly uploaded file
                await fetchSavedFiles();

                // Reset file input and selected files after successful upload
                if (fileInputRef.current) {
                    fileInputRef.current.value = "";
                }
                setSelectedFiles(null);
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

    // Function to handle deleting a file
    const handleDeleteFile = async (fileId: string, fileName: string) => {
        setFileToDelete({ id: fileId, name: fileName });
        setIsConfirmModalOpen(true);
    };

    // Function to format date display
    const formatDateDisplay = (dateStr: string | undefined): string => {
        if (!dateStr) return "-";
        return dateStr.replace("-", "/").replace("-", "/");
    };

    // Function to confirm file deletion - wrapped in useCallback to avoid dependency issues
    const confirmDeleteFile = useCallback(async () => {
        if (!fileToDelete?.id) return;

        try {
            setIsDeleting(true);
            setIsLoadingFiles(true);
            await deleteFile(fileToDelete.id);
            showNotification(`File deleted: ${fileToDelete.name}`, "success");
            setIsConfirmModalOpen(false);
            setFileToDelete(null);

            // Refresh file list
            await fetchSavedFiles();
        } catch (error) {
            console.error("Error deleting file:", error);
            showNotification(`Failed to delete file: ${fileToDelete.name}`, "error");
        } finally {
            setIsDeleting(false);
            setIsLoadingFiles(false);
        }
    }, [fileToDelete, setIsLoadingFiles, showNotification, fetchSavedFiles]);

    // Function to cancel file deletion
    const cancelDeleteFile = useCallback(() => {
        setIsConfirmModalOpen(false);
        setFileToDelete(null);
    }, []);

    // Handle keyboard events for the modal
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isConfirmModalOpen) return;

            if (e.key === "Escape") {
                cancelDeleteFile();
            } else if (e.key === "Enter" && fileToDelete) {
                confirmDeleteFile();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isConfirmModalOpen, fileToDelete, confirmDeleteFile, cancelDeleteFile]);

    return (
        <AdminOnly>
            <div className="mb-6 p-4 bg-gray-800 rounded-lg shadow-md border border-gray-700">
                <h2 className="text-lg font-semibold mb-4 text-white">Excel File Management</h2>

                {/* Upload Form */}
                <form className="mb-6">
                    <div className="flex flex-col md:flex-row items-start gap-4">
                        <div className="w-full">
                            <label htmlFor="fileUpload" className="block text-sm font-medium text-gray-300 mb-1">
                                Upload Excel File(s)
                            </label>
                            <input
                                type="file"
                                id="fileUpload"
                                onChange={handleFileSelection}
                                accept=".xlsx,.xls"
                                className="block w-full text-sm text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-900 file:text-blue-100 hover:file:bg-blue-800"
                                disabled={isUploading}
                                multiple // Enable multiple file selection
                                ref={fileInputRef}
                            />
                            <p className="mt-1 text-xs text-gray-400">
                                File names must be in one of these formats:
                                <span className="font-mono ml-1">tennis-DD-MM-YYYY.xlsx</span>,
                                <span className="font-mono ml-1">tennis-spread-DD-MM-YYYY.xlsx</span>,
                                <span className="font-mono ml-1">tennis-kelly-DD-MM-YYYY.xlsx</span>,
                                <span className="font-mono ml-1">table-tennis-DD-MM-YYYY.xlsx</span>, or
                                <span className="font-mono ml-1">table-tennis-kelly-DD-MM-YYYY.xlsx</span>
                            </p>
                            <p className="mt-1 text-xs text-blue-400">
                                Example: {suggestValidFileNames().join(" or ")}
                            </p>
                            {selectedFiles && selectedFiles.length > 0 && (
                                <p className="mt-1 text-sm text-blue-400 flex items-center">
                                    {selectedFiles.length} file{selectedFiles.length !== 1 ? "s" : ""} selected
                                    <button
                                        type="button"
                                        onClick={clearSelectedFiles}
                                        className="ml-2 text-gray-400 hover:text-gray-300 focus:outline-none"
                                        aria-label="Clear selected files"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </p>
                            )}
                            {uploadError && <p className="mt-1 text-sm text-red-400">{uploadError}</p>}
                        </div>

                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={handleUploadSelectedFiles}
                                className={`px-4 py-2 rounded-md font-medium flex items-center mt-2 md:mt-6 ${isUploading ? "bg-green-700" : "bg-green-600 hover:bg-green-700"} text-white`}
                                disabled={isUploading || !selectedFiles || selectedFiles.length === 0}
                            >
                                {isUploading ? (
                                    <>
                                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Uploading...
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-4 h-4 mr-2" fill="currentColor" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                                        </svg>
                                        Upload Files
                                    </>
                                )}
                            </button>

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
                    </div>
                </form>

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

                {/* Confirmation Modal */}
                {isConfirmModalOpen && fileToDelete && (
                    <div
                        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="modal-title"
                    >
                        <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 shadow-xl border border-gray-700">
                            <h3 id="modal-title" className="text-xl font-semibold mb-4 text-white">Confirm Deletion</h3>
                            <p className="text-gray-300 mb-6">
                                Are you sure you want to delete <span className="font-semibold text-white">&ldquo;{fileToDelete.name}&rdquo;</span>? This action cannot be undone.
                            </p>
                            <div className="flex justify-end space-x-3">
                                <button
                                    type="button"
                                    onClick={cancelDeleteFile}
                                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    aria-label="Cancel deletion"
                                    disabled={isDeleting}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={confirmDeleteFile}
                                    className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-red-500 flex items-center justify-center"
                                    aria-label="Confirm deletion"
                                    disabled={isDeleting}
                                >
                                    {isDeleting ? (
                                        <>
                                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            Loading
                                        </>
                                    ) : (
                                        "Delete"
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </AdminOnly>
    );
};

export default AdminExcelPanel; 