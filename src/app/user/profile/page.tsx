"use client";

import { useAuth } from "@/context/AuthContext";
import { useUserProfile } from "@/context/UserProfileContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FirebaseError } from "firebase/app";

type ProfileSection = "password" | "info" | "subscription";

export default function UserProfilePage() {
    const { user, updateUserPassword, loading: authLoading, error: authError, clearError: clearAuthError } = useAuth();
    const { subscription, loading: subscriptionLoading, error: subscriptionError, clearError: clearSubscriptionError } = useUserProfile();
    const router = useRouter();
    const [activeSection, setActiveSection] = useState<ProfileSection>("info");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [passwordError, setPasswordError] = useState("");
    const [message, setMessage] = useState("");

    useEffect(() => {
        if (!user) {
            router.push("/auth/signin");
        }
    }, [user, router]);

    const handlePasswordUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        setPasswordError("");
        setMessage("");

        if (newPassword !== confirmPassword) {
            setPasswordError("Passwords do not match");
            return;
        }

        if (newPassword.length < 6) {
            setPasswordError("Password must be at least 6 characters");
            return;
        }

        try {
            await updateUserPassword(newPassword);
            setMessage("Password updated successfully!");
            setNewPassword("");
            setConfirmPassword("");
        } catch (error) {
            if (error instanceof FirebaseError) {
                setPasswordError(error.message);
            } else {
                setPasswordError("Failed to update password. Please try again.");
            }
        }
    };

    const loading = authLoading || subscriptionLoading;
    const error = authError || subscriptionError;

    const clearError = () => {
        clearAuthError();
        clearSubscriptionError();
    };

    if (!user) return null;

    return (
        <div className="min-h-screen bg-gray-900 pt-20 text-white">
            <div className="container mx-auto px-4 py-8">
                <h1 className="text-3xl font-bold mb-8">User Profile</h1>

                <div className="flex flex-col md:flex-row gap-6">
                    {/* Left Navigation Menu */}
                    <div className="w-full md:w-1/4">
                        <div className="bg-gray-800 rounded-lg shadow-md overflow-hidden border border-gray-700">
                            <nav className="flex flex-col">
                                <button
                                    onClick={() => setActiveSection("info")}
                                    className={`px-6 py-4 text-left ${activeSection === "info" ? "bg-blue-600 text-white" : "text-gray-200 hover:bg-gray-700"}`}
                                    aria-label="View user information"
                                    tabIndex={0}
                                >
                                    User Information
                                </button>
                                <button
                                    onClick={() => setActiveSection("password")}
                                    className={`px-6 py-4 text-left ${activeSection === "password" ? "bg-blue-600 text-white" : "text-gray-200 hover:bg-gray-700"}`}
                                    aria-label="Change password"
                                    tabIndex={0}
                                >
                                    Change Password
                                </button>
                                <button
                                    onClick={() => setActiveSection("subscription")}
                                    className={`px-6 py-4 text-left ${activeSection === "subscription" ? "bg-blue-600 text-white" : "text-gray-200 hover:bg-gray-700"}`}
                                    aria-label="View subscription details"
                                    tabIndex={0}
                                >
                                    Subscription
                                </button>
                            </nav>
                        </div>
                    </div>

                    {/* Main Content Area */}
                    <div className="w-full md:w-3/4">
                        <div className="bg-gray-800 rounded-lg shadow-md p-6 border border-gray-700">
                            {/* Error and Message Display */}
                            {error && (
                                <div className="bg-red-900 border border-red-600 text-red-200 px-4 py-3 rounded relative mb-4">
                                    {error}
                                    <button
                                        className="absolute top-0 right-0 px-4 py-3"
                                        onClick={clearError}
                                        aria-label="Dismiss error"
                                    >
                                        <span className="sr-only">Dismiss</span>
                                        <span className="text-2xl">&times;</span>
                                    </button>
                                </div>
                            )}
                            {message && (
                                <div className="bg-green-900 border border-green-600 text-green-200 px-4 py-3 rounded mb-4">
                                    {message}
                                </div>
                            )}

                            {/* User Information Section */}
                            {activeSection === "info" && (
                                <div>
                                    <h2 className="text-2xl font-semibold mb-6">User Information</h2>
                                    <div className="space-y-4">
                                        <div>
                                            <p className="text-sm font-medium text-gray-400">Email</p>
                                            <p className="mt-1 text-lg">{user?.email}</p>
                                        </div>
                                        {user?.displayName && (
                                            <div>
                                                <p className="text-sm font-medium text-gray-400">Display Name</p>
                                                <p className="mt-1 text-lg">{user.displayName}</p>
                                            </div>
                                        )}
                                        <div>
                                            <p className="text-sm font-medium text-gray-400">Account Created</p>
                                            <p className="mt-1 text-lg">
                                                {user?.metadata?.creationTime
                                                    ? new Date(user.metadata.creationTime).toLocaleDateString()
                                                    : "Not available"}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Change Password Section */}
                            {activeSection === "password" && (
                                <div>
                                    <h2 className="text-2xl font-semibold mb-6">Change Password</h2>
                                    {passwordError && (
                                        <div className="bg-red-900 border border-red-600 text-red-200 px-4 py-3 rounded relative mb-4">
                                            {passwordError}
                                        </div>
                                    )}
                                    <form onSubmit={handlePasswordUpdate} className="space-y-6">
                                        <div>
                                            <label htmlFor="newPassword" className="block text-sm font-medium text-gray-300">
                                                New Password
                                            </label>
                                            <input
                                                type="password"
                                                id="newPassword"
                                                value={newPassword}
                                                onChange={(e) => setNewPassword(e.target.value)}
                                                className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300">
                                                Confirm New Password
                                            </label>
                                            <input
                                                type="password"
                                                id="confirmPassword"
                                                value={confirmPassword}
                                                onChange={(e) => setConfirmPassword(e.target.value)}
                                                className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                                required
                                            />
                                        </div>
                                        <button
                                            type="submit"
                                            disabled={loading}
                                            className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                                        >
                                            {loading ? "Updating..." : "Update Password"}
                                        </button>
                                    </form>
                                </div>
                            )}

                            {/* Subscription Section */}
                            {activeSection === "subscription" && (
                                <div>
                                    <h2 className="text-2xl font-semibold mb-6">Subscription Details</h2>

                                    {subscription ? (
                                        <div className="space-y-6">
                                            <div className="bg-gray-700 rounded-lg p-6 border border-gray-600">
                                                <div className="flex items-center justify-between mb-4">
                                                    <h3 className="text-lg font-medium">Current Plan</h3>
                                                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${subscription.isActive
                                                        ? "bg-green-900 text-green-200"
                                                        : "bg-gray-600 text-gray-200"
                                                        }`}>
                                                        {subscription.isActive ? "Active" : "Inactive"}
                                                    </span>
                                                </div>

                                                <div className="space-y-3">
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-400">Plan Type</span>
                                                        <span className="font-medium capitalize">
                                                            {subscription.plan === "none" ? "No Plan" : subscription.plan}
                                                        </span>
                                                    </div>

                                                    {subscription.startDate && (
                                                        <div className="flex justify-between">
                                                            <span className="text-gray-400">Start Date</span>
                                                            <span className="font-medium">
                                                                {new Date(subscription.startDate).toLocaleDateString()}
                                                            </span>
                                                        </div>
                                                    )}

                                                    {subscription.endDate && (
                                                        <div className="flex justify-between">
                                                            <span className="text-gray-400">End Date</span>
                                                            <span className="font-medium">
                                                                {new Date(subscription.endDate).toLocaleDateString()}
                                                            </span>
                                                        </div>
                                                    )}

                                                    <div className="flex justify-between">
                                                        <span className="text-gray-400">Auto-Renew</span>
                                                        <span className="font-medium">
                                                            {subscription.autoRenew ? "Enabled" : "Disabled"}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            {subscription.plan === "none" && (
                                                <div className="mt-6">
                                                    <h3 className="text-lg font-medium mb-4">Upgrade Your Plan</h3>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        <div className="bg-gray-700 border border-gray-600 rounded-lg p-6 hover:border-blue-500 transition-colors">
                                                            <h4 className="text-xl font-semibold mb-2">Monthly</h4>
                                                            <p className="text-3xl font-bold mb-4">$29<span className="text-gray-400 text-lg">/month</span></p>
                                                            <p className="text-gray-400 mb-6">Perfect for bettors who want to test our premium predictions with minimal commitment.</p>
                                                            <button
                                                                className="w-full py-2 px-4 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                                                                onClick={() => router.push("/subscription/monthly")}
                                                            >
                                                                Subscribe Now
                                                            </button>
                                                        </div>
                                                        <div className="bg-gray-700 border-2 border-blue-500 rounded-lg p-6 relative">
                                                            <div className="absolute top-0 right-0 bg-blue-600 text-white text-xs font-bold px-3 py-1 uppercase tracking-wider">
                                                                Best Value
                                                            </div>
                                                            <h4 className="text-xl font-semibold mb-2">Annual</h4>
                                                            <p className="text-3xl font-bold mb-4">$249<span className="text-gray-400 text-lg">/year</span></p>
                                                            <p className="text-gray-400 mb-6">For serious bettors looking to maximize their edge with our most comprehensive package.</p>
                                                            <button
                                                                className="w-full py-2 px-4 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                                                                onClick={() => router.push("/subscription/yearly")}
                                                            >
                                                                Subscribe Now
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="text-center py-8">
                                            <p className="text-gray-400">No subscription information available.</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
} 