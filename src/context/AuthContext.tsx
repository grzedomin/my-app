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
import { auth, db } from "@/lib/firebase";
import { doc, setDoc, getDoc } from "firebase/firestore";
import Cookies from "js-cookie";
import LoadingSpinner from "@/components/ui/LoadingSpinner";

export type UserRole = "admin" | "user";

type AuthContextType = {
    user: User | null;
    userRole: UserRole | null;
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
    const [userRole, setUserRole] = useState<UserRole | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    // We can't use useNotification() here because it would be outside the NotificationProvider
    // We'll handle notifications in the consumer components

    // Fetch user role from Firestore
    const fetchUserRole = async (uid: string) => {
        try {
            const userDoc = await getDoc(doc(db, "users", uid));
            if (userDoc.exists()) {
                const userData = userDoc.data();
                setUserRole(userData.role as UserRole);
            } else {
                setUserRole("user"); // Default role
            }
        } catch (error) {
            console.error("Error fetching user role:", error);
            setUserRole("user"); // Default to user role on error
        }
    };

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            setUser(currentUser);

            if (currentUser) {
                // User is signed in, set the cookie
                currentUser.getIdToken().then((token) => {
                    Cookies.set("__session", token, { expires: 14 }); // 14 days expiry
                });

                // Fetch user role
                await fetchUserRole(currentUser.uid);
            } else {
                // User is signed out, remove the cookie
                Cookies.remove("__session");
                setUserRole(null);
            }

            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const signIn = async (email: string, password: string) => {
        try {
            setLoading(true);
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            await fetchUserRole(userCredential.user.uid);
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
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const uid = userCredential.user.uid;

            // Determine role based on email
            const role: UserRole = email === "greg@gmail.com" ? "admin" : "user";

            // Create user document in Firestore
            await setDoc(doc(db, "users", uid), {
                email,
                role,
                createdAt: new Date().toISOString()
            });

            setUserRole(role);
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
            const result = await signInWithPopup(auth, new GoogleAuthProvider());
            const user = result.user;

            // Check if user document exists
            const userDoc = await getDoc(doc(db, "users", user.uid));

            if (!userDoc.exists()) {
                // Determine role based on email
                const role: UserRole = user.email === "greg@gmail.com" ? "admin" : "user";

                // Create user document in Firestore
                await setDoc(doc(db, "users", user.uid), {
                    email: user.email,
                    role,
                    createdAt: new Date().toISOString()
                });

                setUserRole(role);
            } else {
                // User already exists, fetch role
                await fetchUserRole(user.uid);
            }

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
            setUserRole(null);
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

            // Update email in Firestore
            if (user) {
                await setDoc(doc(db, "users", user.uid), {
                    email: newEmail
                }, { merge: true });
            }

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
                userRole,
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