import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    getAllFiles,
    getUserFiles,
    getFileById,
    deleteFile,
    uploadFile,
    uploadMultipleFiles,
    getFilesByDate,
    getFilesBySportType
} from "@/lib/storage";

// Query key factory for better type safety and consistency
const fileKeys = {
    all: ["files"] as const,
    lists: () => [...fileKeys.all, "list"] as const,
    list: (filters: { userId?: string; date?: string; sportType?: string }) =>
        [...fileKeys.lists(), filters] as const,
    details: () => [...fileKeys.all, "detail"] as const,
    detail: (id: string) => [...fileKeys.details(), id] as const,
};

// Get all files
export function useAllFiles() {
    return useQuery({
        queryKey: fileKeys.lists(),
        queryFn: getAllFiles,
    });
}

// Get files for a specific user
export function useUserFiles(userId: string) {
    return useQuery({
        queryKey: fileKeys.list({ userId }),
        queryFn: () => getUserFiles(userId),
        enabled: !!userId, // Only run query if userId is provided
    });
}

// Get file by ID
export function useFileById(fileId: string) {
    return useQuery({
        queryKey: fileKeys.detail(fileId),
        queryFn: () => getFileById(fileId),
        enabled: !!fileId, // Only run query if fileId is provided
    });
}

// Get files by date
export function useFilesByDate(date: string, sportType?: string) {
    return useQuery({
        queryKey: fileKeys.list({ date, sportType }),
        queryFn: () => getFilesByDate(date, sportType),
        enabled: !!date, // Only run query if date is provided
    });
}

// Get files by sport type
export function useFilesBySportType(sportType: string) {
    return useQuery({
        queryKey: fileKeys.list({ sportType }),
        queryFn: () => getFilesBySportType(sportType),
        enabled: !!sportType, // Only run query if sportType is provided
    });
}

// Upload single file mutation
export function useUploadFile() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (params: {
            file: File;
            userId: string;
            path?: string;
            fileDate?: string | null;
            sportType?: string;
        }) => uploadFile(
            params.file,
            params.userId,
            params.path,
            params.fileDate,
            params.sportType
        ),
        onSuccess: () => {
            // Invalidate all file queries when a new file is uploaded
            queryClient.invalidateQueries({ queryKey: fileKeys.lists() });
        },
    });
}

// Upload multiple files mutation
export function useUploadMultipleFiles() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (params: {
            files: File[];
            userId: string;
            path?: string;
            sportType?: string;
        }) => uploadMultipleFiles(
            params.files,
            params.userId,
            params.path,
            params.sportType
        ),
        onSuccess: () => {
            // Invalidate all file queries when new files are uploaded
            queryClient.invalidateQueries({ queryKey: fileKeys.lists() });
        },
    });
}

// Delete file mutation
export function useDeleteFile() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: deleteFile,
        onSuccess: (_, fileId) => {
            // Invalidate specific file query when deleted
            queryClient.removeQueries({ queryKey: fileKeys.detail(fileId) });
            // Invalidate all file lists
            queryClient.invalidateQueries({ queryKey: fileKeys.lists() });
        },
    });
} 