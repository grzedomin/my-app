import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { FirebaseError } from "firebase/app";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useNotification } from "@/context/NotificationContext";

// Validation helpers
const validateEmail = (email: string): string => {
    if (!email) return "Email is required";

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return "Please enter a valid email address";

    return "";
};

const validatePassword = (password: string): string => {
    if (!password) return "Password is required";
    if (password.length < 6) return "Password must be at least 6 characters";
    if (!/\d/.test(password)) return "Password must contain at least one number";
    if (!/[A-Z]/.test(password)) return "Password must contain at least one uppercase letter";

    return "";
};

const validatePasswordMatch = (password: string, confirmPassword: string): string => {
    if (!confirmPassword) return "Please confirm your password";
    if (password !== confirmPassword) return "Passwords do not match";

    return "";
};

export default function SignUp() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState("");
    const [emailError, setEmailError] = useState("");
    const [passwordError, setPasswordError] = useState("");
    const [confirmPasswordError, setConfirmPasswordError] = useState("");
    const [formTouched, setFormTouched] = useState(false);
    const [success, setSuccess] = useState("");
    const { signUp, signInWithGoogle } = useAuth();
    const router = useRouter();
    const { showNotification } = useNotification();

    const validateForm = (): boolean => {
        const emailValidationError = validateEmail(email);
        const passwordValidationError = validatePassword(password);
        const confirmPasswordValidationError = validatePasswordMatch(password, confirmPassword);

        setEmailError(emailValidationError);
        setPasswordError(passwordValidationError);
        setConfirmPasswordError(confirmPasswordValidationError);

        return !emailValidationError && !passwordValidationError && !confirmPasswordValidationError;
    };

    const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setEmail(e.target.value);
        if (formTouched) {
            setEmailError(validateEmail(e.target.value));
        }
    };

    const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newPassword = e.target.value;
        setPassword(newPassword);
        if (formTouched) {
            setPasswordError(validatePassword(newPassword));
            setConfirmPasswordError(validatePasswordMatch(newPassword, confirmPassword));
        }
    };

    const handleConfirmPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newConfirmPassword = e.target.value;
        setConfirmPassword(newConfirmPassword);
        if (formTouched) {
            setConfirmPasswordError(validatePasswordMatch(password, newConfirmPassword));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormTouched(true);
        setError("");
        setSuccess("");

        if (!validateForm()) {
            return;
        }

        try {
            await signUp(email, password);
            const successMsg = "Account created successfully! You can now sign in.";
            setSuccess(successMsg);
            showNotification(successMsg, "success");
            setTimeout(() => {
                router.push("/auth/signin");
            }, 2000);
        } catch (error: unknown) {
            if (error instanceof FirebaseError) {
                if (error.code === "auth/email-already-in-use") {
                    const errorMsg = "This email address is already in use. Please use a different email or sign in.";
                    setError(errorMsg);
                    showNotification(errorMsg, "error");
                } else if (error.code === "auth/weak-password") {
                    const errorMsg = "Password is too weak. Please choose a stronger password.";
                    setError(errorMsg);
                    showNotification(errorMsg, "error");
                } else {
                    setError(error.message);
                    showNotification("Sign-up failed: " + error.message, "error");
                }
            } else {
                const errorMsg = "An unexpected error occurred. Please try again.";
                setError(errorMsg);
                showNotification(errorMsg, "error");
            }
        }
    };

    const handleGoogleSignUp = async () => {
        setError("");
        setSuccess("");

        try {
            await signInWithGoogle();
            const successMsg = "Account created/signed in successfully with Google!";
            showNotification(successMsg, "success");
            router.push("/dashboard");
        } catch (error: unknown) {
            if (error instanceof FirebaseError) {
                const errorMsg = error.message || "Failed to sign in with Google";
                setError(errorMsg);
                showNotification(errorMsg, "error");
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
                        Create your account
                    </h2>
                </div>
                {error && (
                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">
                        <span className="block sm:inline">{error}</span>
                    </div>
                )}
                {success && (
                    <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mb-4">
                        <span className="block sm:inline">{success}</span>
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
                                    setEmailError(validateEmail(email));
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
                                autoComplete="new-password"
                                required
                                className={`mt-1 appearance-none rounded-md relative block w-full px-3 py-2 border ${passwordError ? "border-red-300" : "border-gray-300"
                                    } placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm`}
                                placeholder="Password (min 6 characters, with a number and uppercase letter)"
                                value={password}
                                onChange={handlePasswordChange}
                                onBlur={() => {
                                    setFormTouched(true);
                                    setPasswordError(validatePassword(password));
                                }}
                            />
                            {passwordError && (
                                <p className="mt-1 text-sm text-red-600">{passwordError}</p>
                            )}
                        </div>
                        <div>
                            <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700">
                                Confirm Password
                            </label>
                            <input
                                id="confirm-password"
                                name="confirm-password"
                                type="password"
                                autoComplete="new-password"
                                required
                                className={`mt-1 appearance-none rounded-md relative block w-full px-3 py-2 border ${confirmPasswordError ? "border-red-300" : "border-gray-300"
                                    } placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm`}
                                placeholder="Confirm password"
                                value={confirmPassword}
                                onChange={handleConfirmPasswordChange}
                                onBlur={() => {
                                    setFormTouched(true);
                                    setConfirmPasswordError(validatePasswordMatch(password, confirmPassword));
                                }}
                            />
                            {confirmPasswordError && (
                                <p className="mt-1 text-sm text-red-600">{confirmPasswordError}</p>
                            )}
                        </div>
                    </div>

                    <div>
                        <button
                            type="submit"
                            className="w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                            Sign up
                        </button>
                    </div>

                    <div className="flex items-center my-4">
                        <div className="flex-grow h-px bg-gray-300"></div>
                        <div className="mx-4 text-gray-500 text-sm">or</div>
                        <div className="flex-grow h-px bg-gray-300"></div>
                    </div>

                    <div>
                        <button
                            type="button"
                            onClick={handleGoogleSignUp}
                            className="w-full flex justify-center items-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                            aria-label="Sign up with Google"
                            tabIndex={0}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    handleGoogleSignUp();
                                }
                            }}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 24 24">
                                <path
                                    fill="#4285F4"
                                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                />
                                <path
                                    fill="#34A853"
                                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                />
                                <path
                                    fill="#FBBC05"
                                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                />
                                <path
                                    fill="#EA4335"
                                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                />
                            </svg>
                            Sign up with Google
                        </button>
                    </div>

                    <div className="text-center mt-4">
                        <Link
                            href="/auth/signin"
                            className="font-medium text-blue-600 hover:text-blue-500"
                        >
                            Already have an account? Sign in
                        </Link>
                    </div>
                </form>
            </div>
        </div>
    );
}