import { useState, useEffect, useRef, useCallback } from "react";
import { BettingPrediction, getPredictionsBySportType, getPredictionsByDate } from "@/lib/prediction-service";

// Define the pagination state interface
interface PaginationState {
    lastDocId: string | null;
    hasMore: boolean;
    isLoadingMore: boolean;
}

// Define the result type for the hook
export interface UseMatchesByDateResult {
    predictions: BettingPrediction[];
    isLoading: boolean;
    error: string | null;
    loadMore: () => Promise<boolean>;
    hasMore: boolean;
    isLoadingMore: boolean;
}

/**
 * Custom hook to fetch predictions with pagination
 */
export const useMatchesByDate = (
    selectedDate: string,
    sportType: string = "tennis",
    pageSize: number = 20
): UseMatchesByDateResult => {
    const [predictions, setPredictions] = useState<BettingPrediction[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    // Pagination state
    const [paginationState, setPaginationState] = useState<PaginationState>({
        lastDocId: null,
        hasMore: true,
        isLoadingMore: false,
    });

    // Use a ref to track if this is the initial load
    const initialLoadRef = useRef<boolean>(true);

    // Reset when date or sport type changes
    useEffect(() => {
        setPredictions([]);
        setPaginationState({
            lastDocId: null,
            hasMore: true,
            isLoadingMore: false,
        });
        initialLoadRef.current = true;
    }, [selectedDate, sportType]);

    // Initial data fetch
    useEffect(() => {
        if (!initialLoadRef.current) return;

        const fetchInitialData = async () => {
            if (!selectedDate) return;

            setIsLoading(true);
            setError(null);

            try {
                let result;

                if (selectedDate) {
                    // Fetch by date
                    result = await getPredictionsByDate(selectedDate, sportType, pageSize);
                } else {
                    // Fetch by sport type only
                    result = await getPredictionsBySportType(sportType, pageSize);
                }

                setPredictions(result.predictions);
                setPaginationState({
                    lastDocId: result.lastDocId,
                    hasMore: result.hasMore,
                    isLoadingMore: false
                });

                initialLoadRef.current = false;
            } catch (err) {
                console.error("Error fetching predictions:", err);
                setError("Failed to load predictions. Please try again.");
            } finally {
                setIsLoading(false);
            }
        };

        fetchInitialData();
    }, [selectedDate, sportType, pageSize, initialLoadRef]);

    // Function to load more data
    const loadMore = useCallback(async (): Promise<boolean> => {
        if (paginationState.isLoadingMore) {
            return false;
        }

        setPaginationState(prev => ({ ...prev, isLoadingMore: true }));

        try {
            let result;

            if (selectedDate) {
                // Load more by date
                result = await getPredictionsByDate(
                    selectedDate,
                    sportType,
                    pageSize,
                    paginationState.lastDocId || undefined
                );
            } else {
                // Load more by sport type
                result = await getPredictionsBySportType(
                    sportType,
                    pageSize,
                    paginationState.lastDocId || undefined
                );
            }

            // Add new predictions to existing array
            setPredictions(prev => [...prev, ...result.predictions]);

            // Update pagination state with more generous hasMore check
            setPaginationState({
                lastDocId: result.lastDocId,
                hasMore: result.predictions.length >= pageSize,
                isLoadingMore: false
            });

            return result.predictions.length > 0;
        } catch (err) {
            console.error("Error loading more predictions:", err);
            setError("Failed to load more predictions. Please try again.");
            setPaginationState(prev => ({ ...prev, isLoadingMore: false }));
            return false;
        }
    }, [selectedDate, sportType, pageSize, paginationState.lastDocId, paginationState.isLoadingMore]);

    return {
        predictions,
        isLoading,
        error,
        loadMore,
        hasMore: paginationState.hasMore,
        isLoadingMore: paginationState.isLoadingMore
    };
}; 