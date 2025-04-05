import { ref, getDownloadURL, deleteObject, uploadBytesResumable } from "firebase/storage";
import { storage, db } from "./firebase";
import { doc, setDoc, collection, getDocs, query, orderBy, deleteDoc, getDoc, where } from "firebase/firestore";
import { v4 as uuidv4 } from "uuid";

export interface FileData {
    id: string;
    fileName: string;
    filePath: string;
    downloadUrl: string;
    contentType: string;
    uploadDate: number;
    userId: string;
    size: number;
    isPublic?: boolean;
}

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
 * Upload a file to Firebase Storage and save metadata to Firestore
 */
export const uploadFile = async (
    file: File,
    userId: string,
    path: string = "betting-files"
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
                accessLevel: "public" // Allow public access to this file
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
            isPublic: true // Mark all files as public by default
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

        // Try to delete from storage
        try {
            const storageRef = ref(storage, fileData.filePath);
            await deleteObject(storageRef);
            console.log("File deleted from Storage:", fileData.filePath);
        } catch (storageError) {
            console.error("Error deleting file from Storage:", storageError);
            // Continue to delete from Firestore even if Storage deletion fails
            // This helps clean up orphaned records
        }

        // Delete from Firestore
        await deleteDoc(doc(db, "files", fileId));
        console.log("File metadata deleted from Firestore:", fileId);
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