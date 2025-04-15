"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";
import { useRoleCheck } from "@/hooks/useRoleCheck";

export default function AdminDashboard() {
    const { user } = useAuth();
    const router = useRouter();
    const { isAuthorized } = useRoleCheck("admin");

    // Migration state

    useEffect(() => {

        // If user is not logged in, redirect to signin
        if (!user) {
            router.push("/auth/signin");
        }
    }, [user, router]);

    // If not authorized, show loading or nothing while redirecting
    if (!isAuthorized) return null;

    return (
        <div className="min-h-screen bg-gray-900 text-white">
            <nav className="bg-gray-800 shadow border-b border-gray-700">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16">
                        <div className="flex items-center space-x-4">
                            <h1 className="text-xl font-bold">Admin Dashboard</h1>
                            <Link
                                href="/dashboard"
                                className="bg-gray-700 px-4 py-2 text-white rounded-md hover:bg-gray-600 transition-colors"
                            >
                                Back to Dashboard
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

            <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
                <div className="px-4 py-6 sm:px-0">
                    <h2 className="text-2xl font-bold mb-6">Admin Control Panel</h2>

                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                        {/* User Management Card */}
                        <div className="bg-gray-800 overflow-hidden shadow rounded-lg border border-gray-700">
                            <div className="px-4 py-5 sm:p-6">
                                <div className="flex items-center">
                                    <div className="flex-shrink-0 bg-indigo-600 rounded-md p-3">
                                        <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                                        </svg>
                                    </div>
                                    <div className="ml-5 w-0 flex-1">
                                        <dt className="text-lg font-medium text-white">User Management</dt>
                                        <dd className="mt-2 text-sm text-gray-400">
                                            View and manage all users in the system
                                        </dd>
                                    </div>
                                </div>
                                <div className="mt-5">
                                    <Link
                                        href="/admin/users"
                                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                                    >
                                        View Users
                                    </Link>
                                </div>
                            </div>
                        </div>


                        {/* File Management Card */}
                        <div className="bg-gray-800 overflow-hidden shadow rounded-lg border border-gray-700">
                            <div className="px-4 py-5 sm:p-6">
                                <div className="flex items-center">
                                    <div className="flex-shrink-0 bg-purple-600 rounded-md p-3">
                                        <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                    </div>
                                    <div className="ml-5 w-0 flex-1">
                                        <dt className="text-lg font-medium text-white">File Management</dt>
                                        <dd className="mt-2 text-sm text-gray-400">
                                            Upload and manage files
                                        </dd>
                                    </div>
                                </div>
                                <div className="mt-5">
                                    <Link
                                        href="/admin/file-management"
                                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
                                    >
                                        Manage Files
                                    </Link>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-8 bg-yellow-900 border-l-4 border-yellow-500 p-4 text-yellow-200">
                        <div className="flex">
                            <div className="flex-shrink-0">
                                <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <div className="ml-3">
                                <p className="text-sm text-yellow-200">
                                    <strong>Note:</strong> As an admin, you have elevated privileges. Use them responsibly.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
} 