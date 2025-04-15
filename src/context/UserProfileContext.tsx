"use client";

import { Subscription } from "@/types";
import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useAuth } from "./AuthContext";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface UserProfileContextType {
    subscription: Subscription | null;
    loading: boolean;
    error: string | null;
    fetchUserSubscription: () => Promise<void>;
    clearError: () => void;
}

const UserProfileContext = createContext<UserProfileContextType>({} as UserProfileContextType);

export const UserProfileProvider = ({ children }: { children: React.ReactNode }) => {
    const { user } = useAuth();
    const [subscription, setSubscription] = useState<Subscription | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchUserSubscription = useCallback(async () => {
        if (!user) return;

        try {
            setLoading(true);
            // Check if the user has a subscription document
            const subscriptionDoc = await getDoc(doc(db, "subscriptions", user.uid));

            if (subscriptionDoc.exists()) {
                setSubscription(subscriptionDoc.data() as Subscription);
            } else {
                // Create a default subscription entry if none exists
                const defaultSubscription: Subscription = {
                    id: user.uid,
                    userId: user.uid,
                    plan: "none",
                    startDate: "",
                    endDate: "",
                    isActive: false,
                    autoRenew: false
                };

                // Save the default subscription to Firestore
                await setDoc(doc(db, "subscriptions", user.uid), defaultSubscription);
                setSubscription(defaultSubscription);
            }
        } catch (error) {
            console.error("Error fetching subscription:", error);
            setError("Failed to load subscription information. Please try again.");
        } finally {
            setLoading(false);
        }
    }, [user, setSubscription, setLoading, setError]);

    // Fetch subscription when user changes
    useEffect(() => {
        if (user) {
            fetchUserSubscription();
        } else {
            setSubscription(null);
        }
    }, [user, fetchUserSubscription]);

    const clearError = () => setError(null);

    return (
        <UserProfileContext.Provider
            value={{
                subscription,
                loading,
                error,
                fetchUserSubscription,
                clearError
            }}
        >
            {children}
        </UserProfileContext.Provider>
    );
};

export const useUserProfile = () => useContext(UserProfileContext); 