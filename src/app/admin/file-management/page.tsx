"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRoleCheck } from "@/hooks/useRoleCheck";
import AdminExcelPanel from "@/components/admin/AdminExcelPanel";
import AdminOnly from "@/components/AdminOnly";
import { BettingPrediction } from "@/types";

export default function FileManagement() {
    const { user } = useAuth();
    const router = useRouter();
    const { isAuthorized } = useRoleCheck("admin");

    const [predictionsData, setPredictionsData] = useState<BettingPrediction[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [isLoadingFiles, setIsLoadingFiles] = useState(false);
    const [selectedSportType, setSelectedSportType] = useState<string>("tennis");

    useEffect(() => {
        // If user is not logged in, redirect to signin
        if (!user) {
            router.push("/auth/signin");
        }
    }, [user, router]);

    const handleFileProcessed = (data: BettingPrediction[]) => {
        setPredictionsData(data);
    };

    // Handle sport type change
    const handleSportTypeChange = (sportType: string) => {
        setSelectedSportType(sportType);
    };

    // If not authorized, show loading or nothing while redirecting
    if (!isAuthorized) return null;

    return (
        <div className="min-h-screen bg-gray-50">
            <nav className="bg-white shadow">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16">
                        <div className="flex items-center space-x-4">
                            <h1 className="text-xl font-bold">File Management</h1>
                            <Link
                                href="/admin"
                                className="bg-gray-600 px-4 py-2 text-white rounded-md hover:bg-gray-700"
                            >
                                Back to Admin Dashboard
                            </Link>
                        </div>
                        <div className="flex items-center">
                            <span className="mr-4">{user?.email}</span>
                            <span className="bg-indigo-100 text-indigo-800 py-1 px-2 rounded-full text-sm font-semibold">
                                Admin
                            </span>
                        </div>
                    </div>
                </div>
            </nav>

            <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
                <div className="px-4 py-6 sm:px-0">
                    <h2 className="text-2xl font-bold mb-6">Excel File Management</h2>

                    <div className="mb-6">
                        <div className="mb-4 flex space-x-4">
                            <button
                                className={`px-4 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 ${selectedSportType === "tennis"
                                    ? "bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500"
                                    : "bg-gray-200 text-gray-700 hover:bg-gray-300 focus:ring-gray-500"
                                    }`}
                                onClick={() => handleSportTypeChange("tennis")}
                                disabled={isUploading || isLoadingFiles}
                            >
                                Tennis
                            </button>
                            <button
                                className={`px-4 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 ${selectedSportType === "table-tennis"
                                    ? "bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500"
                                    : "bg-gray-200 text-gray-700 hover:bg-gray-300 focus:ring-gray-500"
                                    }`}
                                onClick={() => handleSportTypeChange("table-tennis")}
                                disabled={isUploading || isLoadingFiles}
                            >
                                Table Tennis
                            </button>
                        </div>
                    </div>

                    <AdminOnly>
                        <div className="mb-6 p-6 bg-white rounded-lg shadow-lg">
                            <AdminExcelPanel
                                onFileProcessed={handleFileProcessed}
                                isUploading={isUploading}
                                setIsUploading={setIsUploading}
                                isLoadingFiles={isLoadingFiles}
                                setIsLoadingFiles={setIsLoadingFiles}
                                selectedSportType={selectedSportType}
                            />
                        </div>
                    </AdminOnly>

                    {predictionsData.length > 0 && (
                        <div className="mt-6 p-6 bg-white rounded-lg shadow-lg">
                            <h3 className="text-lg font-medium mb-4">Loaded Predictions</h3>
                            <div className="text-sm text-gray-500 mb-2">
                                Successfully loaded {predictionsData.length} predictions
                            </div>
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Date
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Team 1
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Team 2
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Score Prediction
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Confidence
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {predictionsData.slice(0, 5).map((prediction, index) => (
                                            <tr key={index} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    {prediction.date}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    {prediction.team1} ({prediction.oddTeam1})
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    {prediction.team2} ({prediction.oddTeam2})
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    {prediction.scorePrediction}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    {prediction.confidence}%
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {predictionsData.length > 5 && (
                                    <div className="mt-2 text-sm text-gray-500">
                                        Showing 5 of {predictionsData.length} records
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
} 