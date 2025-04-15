import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { FirebaseError } from "firebase/app";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useNotification } from "@/context/NotificationContext";

// Simple validation for SignIn - just check if fields are not empty
const validateField = (value: string, fieldName: string): string => {
    return value ? "" : `${fieldName} is required`;
};

export default function SignIn() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [emailError, setEmailError] = useState("");
    const [passwordError, setPasswordError] = useState("");
    const [formTouched, setFormTouched] = useState(false);
    const { signIn, signInWithGoogle, loading, user } = useAuth();
    const router = useRouter();
    const { showNotification } = useNotification();

    useEffect(() => {
        // Redirect if user is already logged in
        if (user) {
            router.push("/scorepredictions");
        }
    }, [user, router]);

    const validateForm = (): boolean => {
        const emailValidationError = validateField(email, "Email");
        const passwordValidationError = validateField(password, "Password");

        setEmailError(emailValidationError);
        setPasswordError(passwordValidationError);

        return !emailValidationError && !passwordValidationError;
    };

    const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setEmail(e.target.value);
        if (formTouched) {
            setEmailError(validateField(e.target.value, "Email"));
        }
    };

    const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setPassword(e.target.value);
        if (formTouched) {
            setPasswordError(validateField(e.target.value, "Password"));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormTouched(true);
        setError("");

        if (!validateForm()) {
            return;
        }

        try {
            await signIn(email, password);
            showNotification("Successfully signed in!", "success");
            router.push("/scorepredictions");
        } catch (error: unknown) {
            if (error instanceof FirebaseError) {
                // Provide user-friendly error messages
                if (error.code === "auth/user-not-found" || error.code === "auth/wrong-password" || error.code === "auth/invalid-credential") {
                    const errorMsg = "Invalid email or password. Please try again.";
                    setError(errorMsg);
                    showNotification(errorMsg, "error");
                } else if (error.code === "auth/too-many-requests") {
                    const errorMsg = "Too many failed login attempts. Please try again later or reset your password.";
                    setError(errorMsg);
                    showNotification(errorMsg, "error");
                } else {
                    setError(error.message);
                    showNotification("Sign-in failed. " + error.message, "error");
                }
            } else {
                const errorMsg = "An unexpected error occurred. Please try again.";
                setError(errorMsg);
                showNotification(errorMsg, "error");
            }
        }
    };

    const handleGoogleSignIn = async () => {
        try {
            setError("");
            await signInWithGoogle();
            showNotification("Successfully signed in with Google!", "success");
            router.push("/scorepredictions");
        } catch (error: unknown) {
            if (error instanceof FirebaseError) {
                if (error.code === "auth/popup-closed-by-user") {
                    const errorMsg = "Sign-in was canceled. Please try again.";
                    setError(errorMsg);
                    showNotification(errorMsg, "info");
                } else {
                    setError(error.message);
                    showNotification("Google sign-in failed. " + error.message, "error");
                }
            } else {
                const errorMsg = "An unexpected error occurred. Please try again.";
                setError(errorMsg);
                showNotification(errorMsg, "error");
            }
        }
    };

    return (
        <div
            className="min-h-screen flex items-center justify-center bg-cover bg-center"
            style={{ backgroundImage: "url('/background.avif')" }}
        >
            <div className="absolute inset-0 bg-black bg-opacity-50"></div>
            <div className="max-w-md w-full bg-white rounded-xl shadow-2xl p-8 z-10">
                <div>
                    <h2 className="text-center text-3xl font-extrabold text-gray-900 mb-6">
                        Sign in to your account
                    </h2>
                </div>
                {error && (
                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">
                        <span className="block sm:inline">{error}</span>
                    </div>
                )}
                <form className="space-y-6" onSubmit={handleSubmit}>
                    <div className="space-y-4">
                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                                Email address
                            </label>
                            <input
                                id="email"
                                name="email"
                                type="email"
                                autoComplete="email"
                                required
                                className={`mt-1 appearance-none rounded-md relative block w-full px-3 py-2 border ${emailError ? "border-red-300" : "border-gray-300"
                                    } placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm`}
                                placeholder="Email address"
                                value={email}
                                onChange={handleEmailChange}
                                onBlur={() => {
                                    setFormTouched(true);
                                    setEmailError(validateField(email, "Email"));
                                }}
                            />
                            {emailError && (
                                <p className="mt-1 text-sm text-red-600">{emailError}</p>
                            )}
                        </div>
                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                                Password
                            </label>
                            <input
                                id="password"
                                name="password"
                                type="password"
                                autoComplete="current-password"
                                required
                                className={`mt-1 appearance-none rounded-md relative block w-full px-3 py-2 border ${passwordError ? "border-red-300" : "border-gray-300"
                                    } placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm`}
                                placeholder="Password"
                                value={password}
                                onChange={handlePasswordChange}
                                onBlur={() => {
                                    setFormTouched(true);
                                    setPasswordError(validateField(password, "Password"));
                                }}
                            />
                            {passwordError && (
                                <p className="mt-1 text-sm text-red-600">{passwordError}</p>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center justify-between">
                        <div className="text-sm">
                            <Link
                                href="/auth/reset-password"
                                className="font-medium text-blue-600 hover:text-blue-500"
                            >
                                Forgot your password?
                            </Link>
                        </div>
                    </div>

                    <div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                        >
                            {loading ? "Signing in..." : "Sign in"}
                        </button>
                    </div>
                </form>

                <div className="mt-6">
                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-gray-300"></div>
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className="px-2 bg-white text-gray-500">Or continue with</span>
                        </div>
                    </div>

                    <div className="mt-6">
                        <button
                            onClick={handleGoogleSignIn}
                            disabled={loading}
                            className="w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
                        >
                            {loading ? "Signing in..." : "Sign in with Google"}
                        </button>
                    </div>
                </div>

                <div className="mt-6 text-center">
                    <Link
                        href="/auth/signup"
                        className="font-medium text-blue-600 hover:text-blue-500"
                    >
                        Don&apos;t have an account? Sign up
                    </Link>
                </div>
            </div>
        </div>
    );
}