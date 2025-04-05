"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useNotification } from "@/context/NotificationContext";
import BettingPredictionsTable from "@/components/ui/BettingPredictionsTable";
import Link from "next/link";
import AdminOnly from "@/components/AdminOnly";

export default function Dashboard() {
    const { user, logout } = useAuth();
    const router = useRouter();
    const { showNotification } = useNotification();
    const [isLoggingOut, setIsLoggingOut] = useState(false);

    useEffect(() => {
        // If user is explicitly logged out (via button click), redirect to home
        if (isLoggingOut && !user) {
            router.push("/");
        }
        // If user is not logged in (and not explicitly logging out), redirect to signin
        else if (!user && !isLoggingOut) {
            router.push("/auth/signin");
        }
    }, [user, router, isLoggingOut]);

    const handleLogout = async () => {
        try {
            setIsLoggingOut(true);
            await logout();
            showNotification("Successfully logged out!", "success");
            // The redirection will happen in the useEffect above when auth state changes
        } catch (error) {
            console.error("Failed to logout", error);
            showNotification("Failed to logout. Please try again.", "error");
            setIsLoggingOut(false);
        }
    };

    // If user is not logged in, show nothing while redirecting
    if (!user) return null;

    return (
        <div className="min-h-screen bg-gray-50">
            <nav className="bg-white shadow">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16">
                        <div className="flex items-center space-x-4">
                            <h1 className="text-xl font-bold">Dashboard</h1>
                            <AdminOnly>
                                <Link
                                    href="/admin"
                                    className="bg-indigo-600 px-4 py-2 text-white rounded-md hover:bg-indigo-700"
                                >
                                    Admin Panel
                                </Link>
                            </AdminOnly>
                        </div>
                        <div className="flex items-center">
                            <div className="mr-4 flex flex-col items-end">
                                <span>{user.email}</span>
                            </div>
                            <button
                                onClick={handleLogout}
                                disabled={isLoggingOut}
                                className="bg-red-600 px-4 py-2 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
                            >
                                {isLoggingOut ? "Logging out..." : "Logout"}
                            </button>
                        </div>
                    </div>
                </div>
            </nav>

            <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
                <div className="px-4 py-6 sm:px-0">
                    <h2 className="text-2xl font-bold mb-6">
                        Welcome to your Dashboard
                        <AdminOnly>
                            <span className="ml-2 text-sm bg-indigo-100 text-indigo-800 py-1 px-2 rounded-full">
                                Admin Access
                            </span>
                        </AdminOnly>
                    </h2>

                    {/* Betting Predictions Table */}
                    <div className="bg-white rounded-lg shadow-md p-6 mb-8">
                        <BettingPredictionsTable />
                    </div>
                </div>
            </main>
        </div>
    );
} 