"use client";
import { createContext, useContext, useEffect, useState } from "react";
import {
    onAuthStateChanged,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    GoogleAuthProvider,
    signInWithPopup,
    User,
    sendPasswordResetEmail,
    updateProfile,
    updateEmail,
    updatePassword
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import Cookies from "js-cookie";
import LoadingSpinner from "@/components/ui/LoadingSpinner";

type AuthContextType = {
    user: User | null;
    loading: boolean;
    error: string | null;
    signIn: (email: string, password: string) => Promise<void>;
    signUp: (email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    signInWithGoogle: () => Promise<void>;
    resetPassword: (email: string) => Promise<void>;
    updateUserProfile: (data: { displayName?: string; photoURL?: string }) => Promise<void>;
    updateUserEmail: (newEmail: string) => Promise<void>;
    updateUserPassword: (newPassword: string) => Promise<void>;
    clearError: () => void;
};

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    // We can't use useNotification() here because it would be outside the NotificationProvider
    // We'll handle notifications in the consumer components

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setUser(user);
            setLoading(false);

            // Set or remove cookie based on auth state
            if (user) {
                // User is signed in, set the cookie
                user.getIdToken().then((token) => {
                    Cookies.set("__session", token, { expires: 14 }); // 14 days expiry
                });
            } else {
                // User is signed out, remove the cookie
                Cookies.remove("__session");
            }
        });

        return () => unsubscribe();
    }, []);

    const signIn = async (email: string, password: string) => {
        try {
            setLoading(true);
            await signInWithEmailAndPassword(auth, email, password);
            return Promise.resolve();
        } catch (error) {
            if (error instanceof Error) {
                setError(error.message);
            }
            throw error;
        } finally {
            setLoading(false);
        }
    };

    const signUp = async (email: string, password: string) => {
        try {
            setLoading(true);
            await createUserWithEmailAndPassword(auth, email, password);
            return Promise.resolve();
        } catch (error) {
            if (error instanceof Error) {
                setError(error.message);
            }
            throw error;
        } finally {
            setLoading(false);
        }
    };

    const signInWithGoogle = async () => {
        try {
            setLoading(true);
            await signInWithPopup(auth, new GoogleAuthProvider());
            return Promise.resolve();
        } catch (error) {
            if (error instanceof Error) {
                setError(error.message);
            }
            throw error;
        } finally {
            setLoading(false);
        }
    };

    const logout = async () => {
        try {
            setLoading(true);
            await signOut(auth);
            return Promise.resolve();
        } catch (error) {
            if (error instanceof Error) {
                setError(error.message);
            }
            throw error;
        } finally {
            setLoading(false);
        }
    };

    const resetPassword = async (email: string) => {
        try {
            setLoading(true);
            await sendPasswordResetEmail(auth, email);
            return Promise.resolve();
        } catch (error) {
            if (error instanceof Error) {
                setError(error.message);
            }
            throw error;
        } finally {
            setLoading(false);
        }
    };

    const updateUserProfile = async (data: { displayName?: string; photoURL?: string }) => {
        try {
            setLoading(true);
            if (!user) throw new Error("No user logged in");
            await updateProfile(user, data);
            // Force refresh the user object
            setUser({ ...user, ...data });
            return Promise.resolve();
        } catch (error) {
            if (error instanceof Error) {
                setError(error.message);
            }
            throw error;
        } finally {
            setLoading(false);
        }
    };

    const updateUserEmail = async (newEmail: string) => {
        try {
            setLoading(true);
            if (!user) throw new Error("No user logged in");
            await updateEmail(user, newEmail);
            return Promise.resolve();
        } catch (error) {
            if (error instanceof Error) {
                setError(error.message);
            }
            throw error;
        } finally {
            setLoading(false);
        }
    };

    const updateUserPassword = async (newPassword: string) => {
        try {
            setLoading(true);
            if (!user) throw new Error("No user logged in");
            await updatePassword(user, newPassword);
            return Promise.resolve();
        } catch (error) {
            if (error instanceof Error) {
                setError(error.message);
            }
            throw error;
        } finally {
            setLoading(false);
        }
    };

    const clearError = () => setError(null);

    return (
        <AuthContext.Provider
            value={{
                user,
                loading,
                error,
                signIn,
                signUp,
                logout,
                signInWithGoogle,
                resetPassword,
                updateUserProfile,
                updateUserEmail,
                updateUserPassword,
                clearError,
            }}
        >
            {loading ? <LoadingSpinner /> : children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);