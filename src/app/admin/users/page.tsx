"use client";

import { useAuth } from "@/context/AuthContext";
import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Link from "next/link";
import { useRoleCheck } from "@/hooks/useRoleCheck";

interface UserData {
    id: string;
    email: string;
    role: string;
    createdAt: string;
}

export default function AdminUsersPage() {
    const { user } = useAuth();
    const { isAuthorized } = useRoleCheck("admin");
    const [users, setUsers] = useState<UserData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        const fetchUsers = async () => {
            try {
                setLoading(true);
                const usersCollection = collection(db, "users");
                const usersSnapshot = await getDocs(usersCollection);

                const usersData: UserData[] = usersSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                } as UserData));

                setUsers(usersData);
            } catch (error) {
                console.error("Error fetching users:", error);
                setError("Failed to load users. Please try again.");
            } finally {
                setLoading(false);
            }
        };

        if (isAuthorized) {
            fetchUsers();
        }
    }, [isAuthorized]);

    // If not authorized, show loading or nothing while redirecting
    if (!isAuthorized) return null;

    return (
        <div className="min-h-screen bg-gray-900 text-white">
            <nav className="bg-gray-800 shadow border-b border-gray-700">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16">
                        <div className="flex items-center space-x-4">
                            <h1 className="text-xl font-bold">User Management</h1>
                            <Link
                                href="/admin"
                                className="bg-gray-700 px-4 py-2 text-white rounded-md hover:bg-gray-600 transition-colors"
                            >
                                Back to Admin
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
                    <h2 className="text-2xl font-bold mb-6">User List</h2>

                    {error && (
                        <div className="bg-red-900 border border-red-600 text-red-200 px-4 py-3 rounded relative mb-4">
                            <span className="block sm:inline">{error}</span>
                        </div>
                    )}

                    {loading ? (
                        <div className="flex justify-center items-center h-64">
                            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
                        </div>
                    ) : (
                        <div className="bg-gray-800 shadow overflow-hidden sm:rounded-md border border-gray-700">
                            <ul className="divide-y divide-gray-700">
                                {users.map((user) => (
                                    <li key={user.id}>
                                        <div className="px-4 py-4 sm:px-6">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center">
                                                    <p className="text-sm font-medium text-blue-400 truncate">
                                                        {user.email}
                                                    </p>
                                                    <span className={`ml-2 px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${user.role === "admin"
                                                        ? "bg-green-900 text-green-200"
                                                        : "bg-gray-700 text-gray-200"
                                                        }`}>
                                                        {user.role}
                                                    </span>
                                                </div>
                                                <div className="ml-2 flex-shrink-0 flex">
                                                    <p className="text-sm text-gray-400">
                                                        Created: {new Date(user.createdAt).toLocaleDateString()}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </li>
                                ))}
                                {users.length === 0 && (
                                    <li>
                                        <div className="px-4 py-4 sm:px-6 text-center text-gray-400">
                                            No users found
                                        </div>
                                    </li>
                                )}
                            </ul>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
} 