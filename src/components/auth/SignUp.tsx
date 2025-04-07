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
    const { signUp } = useAuth();
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