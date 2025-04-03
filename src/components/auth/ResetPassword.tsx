import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FirebaseError } from "firebase/app";
import { useNotification } from "@/context/NotificationContext";

export default function ResetPassword() {
    const [email, setEmail] = useState("");
    const [message, setMessage] = useState("");
    const { resetPassword, error, loading, clearError } = useAuth();
    const router = useRouter();
    const { showNotification } = useNotification();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await resetPassword(email);
            const successMsg = "Password reset email sent. Please check your inbox.";
            setMessage(successMsg);
            showNotification(successMsg, "success");
            setTimeout(() => {
                router.push("/auth/signin");
            }, 3000);
        } catch (error: unknown) {
            if (error instanceof FirebaseError) {
                if (error.code === "auth/user-not-found") {
                    const errorMsg = "No account found with this email. Please check your email address.";
                    showNotification(errorMsg, "error");
                } else if (error.code === "auth/invalid-email") {
                    const errorMsg = "Invalid email format. Please enter a valid email address.";
                    showNotification(errorMsg, "error");
                } else {
                    showNotification("Password reset failed: " + error.message, "error");
                }
            } else {
                showNotification("An unexpected error occurred. Please try again.", "error");
            }
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full space-y-8">
                <div>
                    <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
                        Reset your password
                    </h2>
                </div>
                {error && (
                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">
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
                    <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
                        {message}
                    </div>
                )}
                <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                    <div>
                        <label htmlFor="email" className="sr-only">
                            Email address
                        </label>
                        <input
                            id="email"
                            name="email"
                            type="email"
                            required
                            className="appearance-none rounded relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                            placeholder="Email address"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>

                    <div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                        >
                            {loading ? "Sending..." : "Reset Password"}
                        </button>
                    </div>
                </form>

                <div className="text-center">
                    <Link
                        href="/auth/signin"
                        className="text-indigo-600 hover:text-indigo-500"
                    >
                        Back to Sign In
                    </Link>
                </div>
            </div>
        </div>
    );
} 