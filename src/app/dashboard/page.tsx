"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import BettingPredictionsTable from "@/components/ui/BettingPredictionsTable";
import AdminOnly from "@/components/AdminOnly";

export default function Dashboard() {
    const { user } = useAuth();
    const router = useRouter();

    useEffect(() => {
        // If user is not logged in, redirect to signin
        if (!user) {
            router.push("/auth/signin");
        }
    }, [user, router]);

    // If user is not logged in, show nothing while redirecting
    if (!user) return null;

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Hero Header with Background Image */}
            <div
                className="relative w-full h-64 md:h-80 bg-cover bg-center"
                style={{ backgroundImage: "url('/background.avif')" }}
            >
                <div className="absolute inset-0 flex items-center justify-center">
                    <h1 className="text-4xl md:text-5xl font-bold text-white">Dashboard</h1>
                </div>
            </div>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 mt-6">
                <div className="bg-white rounded-lg shadow-xl p-6">
                    <div className="mb-6">
                        <h2 className="text-2xl font-bold">
                            Welcome to your Dashboard
                            <AdminOnly>
                                <span className="ml-2 text-sm bg-indigo-100 text-indigo-800 py-1 px-2 rounded-full">
                                    Admin Access
                                </span>
                            </AdminOnly>
                        </h2>
                    </div>

                    {/* User Info */}
                    <div className="mb-6 text-gray-600">
                        <p>Signed in as: <span className="font-medium">{user.email}</span></p>
                    </div>

                    {/* Betting Predictions Table */}
                    <div className="mt-6">
                        <BettingPredictionsTable />
                    </div>
                </div>
            </main>
        </div>
    );
} 