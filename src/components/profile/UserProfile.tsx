import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { FirebaseError } from "firebase/app";
export default function UserProfile() {
    const { user, updateUserProfile, updateUserEmail, updateUserPassword, error, loading, clearError } = useAuth();
    const [displayName, setDisplayName] = useState(user?.displayName || "");
    const [newEmail, setNewEmail] = useState(user?.email || "");
    const [newPassword, setNewPassword] = useState("");
    const [message, setMessage] = useState("");

    const handleProfileUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await updateUserProfile({ displayName });
            setMessage("Profile updated successfully!");
        } catch (error: unknown) {
            if (error instanceof FirebaseError) {
                console.log(error.message);
            }
        }
    };

    const handleEmailUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await updateUserEmail(newEmail);
            setMessage("Email updated successfully! Please verify your new email.");
        } catch (error: unknown) {
            if (error instanceof FirebaseError) {
                console.log(error.message);
            }
        }
    };

    const handlePasswordUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await updateUserPassword(newPassword);
            setMessage("Password updated successfully!");
            setNewPassword("");
        } catch (error: unknown) {
            if (error instanceof FirebaseError) {
                console.log(error.message);
            }
        }
    };

    return (
        <div className="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8">
            <div className="bg-white shadow px-4 py-5 sm:rounded-lg sm:p-6">
                <div className="md:grid md:grid-cols-3 md:gap-6">
                    <div className="md:col-span-1">
                        <h3 className="text-lg font-medium leading-6 text-gray-900">Profile</h3>
                        <p className="mt-1 text-sm text-gray-500">
                            Update your profile information.
                        </p>
                    </div>
                    <div className="mt-5 md:mt-0 md:col-span-2">
                        {error && (
                            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">
                                {error}
                                <button
                                    className="absolute top-0 right-0 px-4 py-3"
                                    onClick={clearError}
                                >
                                    <span className="sr-only">Dismiss</span>
                                    <span className="text-2xl">&times;</span>
                                </button>
                            </div>
                        )}
                        {message && (
                            <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
                                {message}
                            </div>
                        )}
                        <form onSubmit={handleProfileUpdate} className="space-y-6">
                            <div>
                                <label htmlFor="displayName" className="block text-sm font-medium text-gray-700">
                                    Display Name
                                </label>
                                <input
                                    type="text"
                                    id="displayName"
                                    value={displayName}
                                    onChange={(e) => setDisplayName(e.target.value)}
                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={loading}
                                className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                            >
                                {loading ? "Updating..." : "Update Profile"}
                            </button>
                        </form>

                        <form onSubmit={handleEmailUpdate} className="space-y-6 mt-8">
                            <div>
                                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                                    Email
                                </label>
                                <input
                                    type="email"
                                    id="email"
                                    value={newEmail}
                                    onChange={(e) => setNewEmail(e.target.value)}
                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={loading}
                                className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                            >
                                {loading ? "Updating..." : "Update Email"}
                            </button>
                        </form>

                        <form onSubmit={handlePasswordUpdate} className="space-y-6 mt-8">
                            <div>
                                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                                    New Password
                                </label>
                                <input
                                    type="password"
                                    id="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={loading}
                                className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                            >
                                {loading ? "Updating..." : "Update Password"}
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
} 