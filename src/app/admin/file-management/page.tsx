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

    const [isUploading, setIsUploading] = useState(false);
    const [isLoadingFiles, setIsLoadingFiles] = useState(false);

    useEffect(() => {
        // If user is not logged in, redirect to signin
        if (!user) {
            router.push("/auth/signin");
        }
    }, [user, router]);

    // Dummy handler for the onFileProcessed prop - we need to accept the data parameter
    // even though we don't use it, as it's required by the component interface
    const handleFileProcessed = (data: BettingPrediction[]) => {
        // The data is not used in this simplified version
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

                    <AdminOnly>
                        <div className="mb-6 p-6 bg-white rounded-lg shadow-lg">
                            <AdminExcelPanel
                                onFileProcessed={handleFileProcessed}
                                isUploading={isUploading}
                                setIsUploading={setIsUploading}
                                isLoadingFiles={isLoadingFiles}
                                setIsLoadingFiles={setIsLoadingFiles}
                            />
                        </div>
                    </AdminOnly>

                </div>
            </main>
        </div>
    );
} 