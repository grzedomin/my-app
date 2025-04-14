import { ref, getDownloadURL, deleteObject, uploadBytesResumable } from "firebase/storage";
import { storage, db } from "./firebase";
import { doc, setDoc, collection, getDocs, query, orderBy, deleteDoc, getDoc, where } from "firebase/firestore";
import { v4 as uuidv4 } from "uuid";
import * as XLSX from "xlsx";
import { FileData } from "@/types";

// Extract date from Excel file
export const extractDateFromExcel = async (file: File): Promise<string | null> => {
    try {
        // First, try to extract date from the filename (sportType-DD-MM-YYYY format)
        const filenameMatch = file.name.match(/(?:tennis|table-tennis)-(\d{2})-(\d{2})-(\d{4})/i);

        if (filenameMatch) {
            const [, day, month, year] = filenameMatch;

            // Convert month number to month name
            const monthNames = [
                "Jan", "Feb", "Mar", "Apr", "May", "Jun",
                "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
            ];

            const monthIndex = parseInt(month, 10) - 1; // Convert to 0-based index
            const monthName = monthNames[monthIndex];

            // Add appropriate suffix to day
            let daySuffix = "th";
            if (day.endsWith("1") && day !== "11") daySuffix = "st";
            if (day.endsWith("2") && day !== "12") daySuffix = "nd";
            if (day.endsWith("3") && day !== "13") daySuffix = "rd";

            // Format as "DDth MMM YYYY" (e.g., "12th Apr 2025")
            const formattedDate = `${parseInt(day, 10)}${daySuffix} ${monthName} ${year}`;
            return formattedDate;
        }

        // If filename doesn't match the pattern, fall back to extracting from file content
        return new Promise((resolve) => {
            const reader = new FileReader();

            reader.onload = (event) => {
                try {
                    const data = event.target?.result;
                    const workbook = XLSX.read(data, { type: "binary" });
                    const firstSheetName = workbook.SheetNames[0];

                    if (!firstSheetName) {
                        resolve(null);
                        return;
                    }

                    const worksheet = workbook.Sheets[firstSheetName];
                    const jsonData = XLSX.utils.sheet_to_json<{ Date?: string }>(worksheet);

                    // Look for rows with a valid Date field that includes both date and time
                    // Start at index 1 to skip potential header rows
                    for (let i = 1; i < jsonData.length; i++) {
                        if (jsonData[i] && jsonData[i].Date) {
                            const fullDate = jsonData[i].Date;

                            // Check if it has a time component
                            if (fullDate && fullDate.includes(":")) {
                                // Extract the date part for better matching while preserving time
                                const dateMatch = fullDate.match(/(\d+[a-z]{2}\s+[A-Za-z]+\s+\d{4})/);
                                if (dateMatch && dateMatch[1]) {
                                    // Return the full date with time
                                    resolve(fullDate);
                                    return;
                                }
                            }
                        }
                    }

                    // If no row with time was found, fall back to the first row
                    if (jsonData.length > 0 && jsonData[0].Date) {
                        const firstDate = jsonData[0].Date;
                        resolve(firstDate);
                    } else {
                        resolve(null);
                    }
                } catch (error) {
                    console.error("Error extracting date from Excel:", error);
                    resolve(null);
                }
            };

            reader.onerror = () => {
                console.error("Error reading file for date extraction");
                resolve(null);
            };

            reader.readAsBinaryString(file);
        });
    } catch (error) {
        console.error("Error in extractDateFromExcel:", error);
        return null;
    }
};

// Firebase functions API URL
const FUNCTIONS_BASE_URL = process.env.NEXT_PUBLIC_FIREBASE_FUNCTIONS_URL || "https://us-central1-[YOUR-PROJECT-ID].cloudfunctions.net";

/**
 * Fetch an Excel file safely using the Cloud Function to avoid CORS issues
 */
export const fetchExcelFile = async (filePath: string): Promise<ArrayBuffer> => {
    try {
        // First check if we should use direct URL or function URL
        let url;
        const isLocalhost = typeof window !== "undefined" && window.location.hostname === "localhost";

        if (isLocalhost) {
            // In development, try to use direct storage URL
            try {
                const storageRef = ref(storage, filePath);
                url = await getDownloadURL(storageRef);
            } catch (error) {
                console.warn("Failed to get direct download URL, falling back to function", error);
                url = `${FUNCTIONS_BASE_URL}/getFile?path=${encodeURIComponent(filePath)}`;
            }
        } else {
            // In production, always use the function URL to avoid CORS issues
            url = `${FUNCTIONS_BASE_URL}/getFile?path=${encodeURIComponent(filePath)}`;
        }

        console.log("Fetching Excel file from:", url);

        // Fetch the file as an array buffer
        const response = await fetch(url, {
            method: "GET",
            headers: {
                "Accept": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            },
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch Excel file: ${response.status} ${response.statusText}`);
        }

        return await response.arrayBuffer();
    } catch (error) {
        console.error("Error fetching Excel file:", error);
        throw error;
    }
};

/**
 * Upload multiple files to Firebase Storage and save metadata to Firestore
 */
export const uploadMultipleFiles = async (
    files: File[],
    userId: string,
    path: string = "betting-files",
    sportType: string = "tennis" // Default to tennis
): Promise<FileData[]> => {
    const uploadedFiles: FileData[] = [];

    for (const file of files) {
        try {
            // Extract date from Excel file
            const fileDate = await extractDateFromExcel(file);

            // Upload file and get file data
            const fileData = await uploadFile(file, userId, path, fileDate, sportType);
            uploadedFiles.push(fileData);
        } catch (error) {
            console.error(`Error uploading file ${file.name}:`, error);
            // Continue with next file even if one fails
        }
    }

    return uploadedFiles;
};

/**
 * Upload a file to Firebase Storage and save metadata to Firestore
 */
export const uploadFile = async (
    file: File,
    userId: string,
    path: string = "betting-files",
    fileDate?: string | null,
    sportType: string = "tennis" // Default to tennis
): Promise<FileData> => {
    try {
        // Create a unique filename
        const fileExtension = file.name.split(".").pop();
        const uniqueId = uuidv4();
        const uniqueFileName = `${uniqueId}.${fileExtension}`;

        // Clean up the path - ensure no double slashes and handle special characters
        // Make sure the path doesn't start with a slash
        const cleanPath = path.startsWith("/") ? path.slice(1) : path;
        // Ensure we have a clean userId with no special characters that could affect the path
        const cleanUserId = userId.replace(/[#$.\[\]\/]/g, "_");

        // Construct the file path
        const filePath = `${cleanPath}/${cleanUserId}/${uniqueFileName}`;
        console.log("Uploading file to path:", filePath);

        // Add metadata to help with CORS and content type issues
        const metadata = {
            contentType: file.type,
            customMetadata: {
                userId: userId,
                originalName: file.name,
                accessLevel: "public", // Allow public access to this file
                fileDate: fileDate || "", // Store the date in metadata
                sportType: sportType // Store the sport type in metadata
            }
        };

        // Upload to storage with metadata
        const storageRef = ref(storage, filePath);
        await uploadBytesResumable(storageRef, file, metadata);

        // Get download URL
        const downloadUrl = await getDownloadURL(storageRef);
        console.log("File uploaded, download URL:", downloadUrl);

        // Create file metadata
        const fileData: FileData = {
            id: uniqueId,
            fileName: file.name,
            filePath,
            downloadUrl,
            contentType: file.type,
            uploadDate: Date.now(),
            userId,
            size: file.size,
            isPublic: true, // Mark all files as public by default
            fileDate: fileDate || undefined,
            sportType: sportType
        };

        // Save to Firestore
        await setDoc(doc(db, "files", uniqueId), fileData);
        console.log("File metadata saved to Firestore");

        return fileData;
    } catch (error) {
        console.error("Error uploading file:", error);
        throw error;
    }
};

/**
 * Get all files for a user
 */
export const getUserFiles = async (userId: string): Promise<FileData[]> => {
    try {
        console.log("Getting files for user:", userId);
        const q = query(
            collection(db, "files"),
            where("userId", "==", userId),
            orderBy("uploadDate", "desc")
        );

        const querySnapshot = await getDocs(q);
        const files: FileData[] = [];

        querySnapshot.forEach((doc) => {
            const fileData = doc.data() as FileData;
            console.log("File data retrieved:", fileData.fileName, fileData.downloadUrl);
            files.push(fileData);
        });

        return files;
    } catch (error) {
        console.error("Error getting user files:", error);
        return [];
    }
};

/**
 * Get all available files from the database
 * This allows all users to see all uploaded files
 */
export const getAllFiles = async (): Promise<FileData[]> => {
    try {
        console.log("Getting all available files");
        const q = query(
            collection(db, "files"),
            orderBy("uploadDate", "desc")
        );

        const querySnapshot = await getDocs(q);
        const files: FileData[] = [];

        querySnapshot.forEach((doc) => {
            const fileData = doc.data() as FileData;
            console.log("File data retrieved:", fileData.fileName, fileData.downloadUrl);
            files.push(fileData);
        });

        return files;
    } catch (error) {
        console.error("Error getting all files:", error);
        return [];
    }
};

/**
 * Get a file by ID
 */
export const getFileById = async (fileId: string): Promise<FileData | null> => {
    try {
        const docRef = doc(db, "files", fileId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            return docSnap.data() as FileData;
        }

        return null;
    } catch (error) {
        console.error("Error getting file by ID:", error);
        return null;
    }
};

/**
 * Delete a file from Storage and Firestore
 */
export const deleteFile = async (fileId: string): Promise<void> => {
    try {
        // Get file data first
        const fileData = await getFileById(fileId);

        if (!fileData) {
            console.error("File not found in Firestore:", fileId);
            // Delete from Firestore even if file data is not found
            await deleteDoc(doc(db, "files", fileId));
            return;
        }

        console.log("File data retrieved for deletion:", fileData);

        // Try to delete from storage - Use a more direct approach
        try {
            console.log("Attempting to delete from Storage:", fileData.filePath);
            const storageRef = ref(storage, fileData.filePath);

            // First try the normal path
            try {
                await deleteObject(storageRef);
                console.log("File successfully deleted from Storage (normal path):", fileData.filePath);
            } catch (normalPathError) {
                console.warn("Error with normal path deletion, trying alternative approaches:", normalPathError);

                // Try with direct path that follows the betting-files/userId/fileId.ext pattern
                const fileParts = fileData.filePath.split('/');
                const fileName = fileParts[fileParts.length - 1];
                const userId = fileData.userId;

                const directPath = `betting-files/${userId}/${fileName}`;
                console.log("Trying direct path deletion:", directPath);

                try {
                    const directRef = ref(storage, directPath);
                    await deleteObject(directRef);
                    console.log("File successfully deleted from Storage (direct path):", directPath);
                } catch (directPathError) {
                    console.error("Failed to delete file from Storage using direct path:", directPathError);
                    throw directPathError; // Re-throw to handle in the outer catch
                }
            }
        } catch (storageError) {
            console.error("All attempts to delete from Storage failed:", storageError);
            // Continue to delete from Firestore even if Storage deletion fails
            // This helps clean up orphaned records
        }

        // Delete from Firestore
        await deleteDoc(doc(db, "files", fileId));
        console.log("File metadata successfully deleted from Firestore:", fileId);
    } catch (error) {
        console.error("Error in deleteFile:", error);
        throw error;
    }
};

/**
 * Verify if a file exists in Storage
 */
export const verifyFileExists = async (filePath: string): Promise<boolean> => {
    try {
        const storageRef = ref(storage, filePath);
        await getDownloadURL(storageRef);
        // If we get here, the file exists
        return true;
    } catch (error) {
        console.error("File does not exist in Storage:", filePath, error);
        return false;
    }
};

/**
 * Clean up orphaned file records - files in Firestore that don't exist in Storage
 */
export const cleanupOrphanedFiles = async (userId: string): Promise<void> => {
    try {
        const files = await getUserFiles(userId);
        console.log(`Checking ${files.length} files for orphaned records...`);

        for (const file of files) {
            const exists = await verifyFileExists(file.filePath);
            if (!exists) {
                console.log(`Cleaning up orphaned file record: ${file.fileName} (${file.id})`);
                await deleteDoc(doc(db, "files", file.id));
            }
        }
    } catch (error) {
        console.error("Error cleaning up orphaned files:", error);
    }
};

/**
 * Get files filtered by date
 */
export const getFilesByDate = async (date: string, sportType?: string): Promise<FileData[]> => {
    try {
        console.log("Getting files for date:", date, "sport type:", sportType);

        try {
            let q;

            if (sportType) {
                // Query with date and sport type
                q = query(
                    collection(db, "files"),
                    where("fileDate", "==", date),
                    where("sportType", "==", sportType),
                    orderBy("uploadDate", "desc")
                );
            } else {
                // Query with just date
                q = query(
                    collection(db, "files"),
                    where("fileDate", "==", date),
                    orderBy("uploadDate", "desc")
                );
            }

            const querySnapshot = await getDocs(q);
            const files: FileData[] = [];

            querySnapshot.forEach((doc) => {
                const fileData = doc.data() as FileData;
                files.push(fileData);
            });

            return files;
        } catch (indexError) {
            console.warn("Index error, falling back to simpler query:", indexError);

            // Fallback without ordering (doesn't require composite index)
            let fallbackQuery;

            if (sportType) {
                fallbackQuery = query(
                    collection(db, "files"),
                    where("fileDate", "==", date),
                    where("sportType", "==", sportType)
                );
            } else {
                fallbackQuery = query(
                    collection(db, "files"),
                    where("fileDate", "==", date)
                );
            }

            const fallbackSnapshot = await getDocs(fallbackQuery);
            const fallbackFiles: FileData[] = [];

            fallbackSnapshot.forEach((doc) => {
                const fileData = doc.data() as FileData;
                fallbackFiles.push(fileData);
            });

            // If fallback with exact match found results, return them
            if (fallbackFiles.length > 0) {
                // Sort client-side instead since we can't use orderBy
                return fallbackFiles.sort((a, b) => b.uploadDate - a.uploadDate);
            }

            // If still no exact matches, try partial matching (client-side)
            // Get all files and filter on client
            const allFiles = await getAllFiles();
            return allFiles
                .filter(file => {
                    // Filter by date
                    const dateMatch = file.fileDate && file.fileDate.includes(date);

                    // Filter by sport type if specified
                    if (sportType) {
                        return dateMatch && file.sportType === sportType;
                    }

                    return dateMatch;
                })
                .sort((a, b) => b.uploadDate - a.uploadDate);
        }
    } catch (error) {
        console.error("Error getting files by date:", error);
        return [];
    }
};

/**
 * Get files filtered by sport type
 */
export const getFilesBySportType = async (sportType: string): Promise<FileData[]> => {
    try {
        console.log("Getting files for sport type:", sportType);

        try {
            // Query with sport type + ordering
            const q = query(
                collection(db, "files"),
                where("sportType", "==", sportType),
                orderBy("uploadDate", "desc")
            );

            const querySnapshot = await getDocs(q);
            const files: FileData[] = [];

            querySnapshot.forEach((doc) => {
                const fileData = doc.data() as FileData;
                files.push(fileData);
            });

            return files;
        } catch (indexError) {
            console.warn("Index error, falling back to simpler query:", indexError);

            // Fallback without ordering (doesn't require composite index)
            const fallbackQuery = query(
                collection(db, "files"),
                where("sportType", "==", sportType)
            );

            const fallbackSnapshot = await getDocs(fallbackQuery);
            const fallbackFiles: FileData[] = [];

            fallbackSnapshot.forEach((doc) => {
                const fileData = doc.data() as FileData;
                fallbackFiles.push(fileData);
            });

            // If fallback found results, return them
            if (fallbackFiles.length > 0) {
                // Sort client-side instead since we can't use orderBy
                return fallbackFiles.sort((a, b) => b.uploadDate - a.uploadDate);
            }

            // If still no matches, filter all files client-side
            const allFiles = await getAllFiles();
            return allFiles
                .filter(file => file.sportType === sportType)
                .sort((a, b) => b.uploadDate - a.uploadDate);
        }
    } catch (error) {
        console.error("Error getting files by sport type:", error);
        return [];
    }
}; 