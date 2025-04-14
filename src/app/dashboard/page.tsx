"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import BettingPredictionsTable from "@/components/ui/BettingPredictionsTable";

export default function Dashboard() {
    const { user } = useAuth();
    const router = useRouter();
    const tableRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // If user is not logged in, redirect to signin
        if (!user) {
            router.push("/auth/signin");
        }
    }, [user, router]);

    const handleScrollToTable = () => {
        tableRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    // If user is not logged in, show nothing while redirecting
    if (!user) return null;

    return (
        <div className="min-h-screen bg-gray-900 text-white">
            {/* Hero Header with Background Image */}
            <div
                className="relative w-full h-80 sm:h-88 md:h-104 lg:h-[532px] bg-cover bg-center"
                style={{ backgroundImage: "url('/background.avif')" }}
            >
                <div className="absolute inset-0 flex flex-col items-center justify-center px-4 text-center">
                    <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4">Dashboard</h1>
                    <p className="text-xl sm:text-2xl text-white mb-6 max-w-2xl">
                        Unlock the power of AI-driven predictions and make smarter tennis bets
                    </p>
                    <button
                        onClick={handleScrollToTable}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg shadow-lg transition-all duration-300 transform hover:scale-105"
                        aria-label="Check predictions"
                        tabIndex={0}
                        onKeyDown={(e) => e.key === "Enter" && handleScrollToTable()}
                    >
                        Check Predictions
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <main className="max-w-[90%] mx-auto py-6 px-2 sm:py-8 sm:px-4 lg:px-8 mt-4 sm:mt-6">
                <div className="bg-gray-800 rounded-lg shadow-xl p-4 sm:p-6 border border-gray-700">
                    <div className="mb-4 sm:mb-6">
                        <h2 className="text-xl sm:text-2xl font-bold flex flex-col sm:flex-row sm:items-center gap-2 text-white">
                            Score predictions
                        </h2>
                    </div>

                    {/* Betting Predictions Table */}
                    <div ref={tableRef} className="mt-4 sm:mt-6 w-full">
                        <BettingPredictionsTable />
                    </div>
                </div>
            </main>
        </div>
    );
} 