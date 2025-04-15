import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    collection,
    getDocs,
    getDoc,
    doc,
    addDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    limit,
    QueryConstraint,
    DocumentData,
    Firestore,
    collectionGroup,
    WhereFilterOp
} from "firebase/firestore";
import { db } from "@/lib/firebase";

// Types for the hook parameters
type CollectionName = string;
type DocId = string;
type QueryOptions = {
    constraints?: QueryConstraint[];
    isCollectionGroup?: boolean;
}

// Cache keys for React Query
const firestoreKeys = {
    all: ["firestore"] as const,
    collections: (collectionName: CollectionName) => [...firestoreKeys.all, collectionName] as const,
    collection: (collectionName: CollectionName, options?: QueryOptions) =>
        [...firestoreKeys.collections(collectionName), { ...options }] as const,
    docs: (collectionName: CollectionName) => [...firestoreKeys.collections(collectionName), "docs"] as const,
    doc: (collectionName: CollectionName, docId: DocId) =>
        [...firestoreKeys.docs(collectionName), docId] as const,
};

/**
 * Hook to get documents from a collection with optional query constraints
 */
export const useCollection = (
    collectionName: CollectionName,
    options: QueryOptions = {}
) => {
    const { constraints = [], isCollectionGroup: isColGroup = false } = options;

    return useQuery({
        queryKey: firestoreKeys.collection(collectionName, options),
        queryFn: async () => {
            try {
                // Use collection or collectionGroup based on the isCollectionGroup flag
                const colRef = isColGroup
                    ? collectionGroup(db as Firestore, collectionName)
                    : collection(db as Firestore, collectionName);

                // Apply constraints if any
                const q = constraints.length > 0
                    ? query(colRef, ...constraints)
                    : colRef;

                const snapshot = await getDocs(q);
                return snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
            } catch (error) {
                console.error(`Error fetching collection ${collectionName}:`, error);
                throw error;
            }
        }
    });
};

/**
 * Hook to get a single document by ID
 */
export const useDocument = (collectionName: CollectionName, docId: DocId) => {
    return useQuery({
        queryKey: firestoreKeys.doc(collectionName, docId),
        queryFn: async () => {
            try {
                const docRef = doc(db as Firestore, collectionName, docId);
                const snapshot = await getDoc(docRef);

                if (!snapshot.exists()) {
                    throw new Error(`Document ${docId} does not exist in ${collectionName}`);
                }

                return {
                    id: snapshot.id,
                    ...snapshot.data()
                };
            } catch (error) {
                console.error(`Error fetching document ${docId} from ${collectionName}:`, error);
                throw error;
            }
        },
        enabled: !!docId // Only run query if we have a document ID
    });
};

/**
 * Hook to add a new document to a collection
 */
export const useAddDocument = (collectionName: CollectionName) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: DocumentData) => {
            try {
                const colRef = collection(db as Firestore, collectionName);
                const docRef = await addDoc(colRef, {
                    ...data,
                    createdAt: new Date()
                });
                return docRef.id;
            } catch (error) {
                console.error(`Error adding document to ${collectionName}:`, error);
                throw error;
            }
        },
        onSuccess: () => {
            // Invalidate the collection query to fetch fresh data
            queryClient.invalidateQueries({ queryKey: firestoreKeys.collections(collectionName) });
        }
    });
};

/**
 * Hook to update an existing document
 */
export const useUpdateDocument = (collectionName: CollectionName) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ docId, data }: { docId: DocId; data: DocumentData }) => {
            try {
                const docRef = doc(db as Firestore, collectionName, docId);
                await updateDoc(docRef, {
                    ...data,
                    updatedAt: new Date()
                });
                return docId;
            } catch (error) {
                console.error(`Error updating document ${docId} in ${collectionName}:`, error);
                throw error;
            }
        },
        onSuccess: (docId) => {
            // Invalidate both the collection and the specific document
            queryClient.invalidateQueries({ queryKey: firestoreKeys.collections(collectionName) });
            queryClient.invalidateQueries({ queryKey: firestoreKeys.doc(collectionName, docId) });
        }
    });
};

/**
 * Hook to delete a document
 */
export const useDeleteDocument = (collectionName: CollectionName) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (docId: DocId) => {
            try {
                const docRef = doc(db as Firestore, collectionName, docId);
                await deleteDoc(docRef);
                return docId;
            } catch (error) {
                console.error(`Error deleting document ${docId} from ${collectionName}:`, error);
                throw error;
            }
        },
        onSuccess: (docId) => {
            // Invalidate collection queries and remove the document from cache
            queryClient.invalidateQueries({ queryKey: firestoreKeys.collections(collectionName) });
            queryClient.removeQueries({ queryKey: firestoreKeys.doc(collectionName, docId) });
        }
    });
};

/**
 * Helper function to create query constraints
 */
export const createConstraints = {
    where: (field: string, operator: WhereFilterOp, value: unknown) => where(field, operator, value),
    orderBy: (field: string, direction: "asc" | "desc" = "asc") => orderBy(field, direction),
    limit: (n: number) => limit(n)
};

/**
 * Export all hooks for easy importing
 */
export const useFirestore = {
    useCollection,
    useDocument,
    useAddDocument,
    useUpdateDocument,
    useDeleteDocument,
    createConstraints
}; 