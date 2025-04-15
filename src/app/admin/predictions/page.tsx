"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";
import { useRoleCheck } from "@/hooks/useRoleCheck";
import BettingPredictionsTable from "@/components/ui/BettingPredictionsTable";
import AdminOnly from "@/components/AdminOnly";
import MigratePredictionsPanel from "@/components/admin/MigratePredictionsPanel";

export default function PredictionsManagement() {
    const { user, loading } = useAuth();
    const router = useRouter();
    const { isAuthorized } = useRoleCheck("admin");

    useEffect(() => {
        // If user is not logged in, redirect to signin
        if (!user && !loading) {
            router.push("/auth/signin");
        }
    }, [user, router, loading]);

    // If not authorized or still loading, show nothing while redirecting
    if (!isAuthorized) return null;

    return (
        <div className="min-h-screen bg-gray-900 text-white">
            <nav className="bg-gray-800 shadow border-b border-gray-700">
                <div className="max-w-[90%] mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16">
                        <div className="flex items-center space-x-4">
                            <h1 className="text-xl font-bold">Predictions Management</h1>
                            <Link
                                href="/admin"
                                className="bg-gray-700 px-4 py-2 text-white rounded-md hover:bg-gray-600 transition-colors"
                            >
                                Back to Admin
                            </Link>
                            <Link
                                href="/dashboard"
                                className="bg-blue-600 px-4 py-2 text-white rounded-md hover:bg-blue-700 transition-colors"
                            >
                                Dashboard
                            </Link>
                        </div>
                        <div className="flex items-center">
                            <span className="mr-4">{user?.email}</span>
                            <span className="bg-indigo-900 text-indigo-200 py-1 px-2 rounded-full text-sm font-semibold">
                                Admin
                            </span>
                        </div>
                    </div>
                </div>
            </nav>

            <main className="max-w-[90%] mx-auto py-6 sm:px-4 lg:px-8">
                <div className="px-2 py-6 sm:px-0">
                    <h2 className="text-2xl font-bold mb-6">Betting Predictions Management</h2>

                    {/* Migration tool section */}
                    <MigratePredictionsPanel />

                    <div className="bg-gray-800 shadow overflow-hidden sm:rounded-lg mb-8 border border-gray-700">
                        <div className="px-4 py-5 sm:px-6">
                            <h3 className="text-lg leading-6 font-medium text-white">Manage Prediction Data</h3>
                            <p className="mt-1 max-w-2xl text-sm text-gray-400">
                                Upload, refresh, and manage prediction Excel files. All changes will be visible to all users.
                            </p>
                        </div>
                    </div>

                    <div className="bg-gray-800 shadow overflow-hidden sm:rounded-lg border border-gray-700">
                        <div className="px-2 py-5 sm:p-6">
                            <BettingPredictionsTable />
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
} 