"use client";

import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { useNotification } from "@/context/NotificationContext";
import AdminOnly from "@/components/AdminOnly";
import { useState } from "react";

const Navbar = () => {
    const { user, logout } = useAuth();
    const pathname = usePathname();
    const router = useRouter();
    const { showNotification } = useNotification();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    // Don't show dashboard link on dashboard page
    const isDashboard = pathname === "/dashboard" || pathname?.startsWith("/dashboard/");

    const handleLogout = async () => {
        try {
            await logout();
            showNotification("Successfully logged out!", "success");
            router.push("/");
        } catch (error) {
            console.error("Failed to logout", error);
            showNotification("Failed to logout. Please try again.", "error");
        }
    };

    const toggleMobileMenu = () => {
        setMobileMenuOpen(!mobileMenuOpen);
    };

    return (
        <nav className="absolute top-0 left-0 right-0 z-10 py-6">
            <div className="container mx-auto px-4">
                <div className="flex justify-between items-center">
                    {/* Logo */}
                    <div className="text-white font-bold text-xl">
                        <Link href="/">
                            AI Set Match
                        </Link>
                    </div>

                    {/* Hamburger Menu Button - Only visible on mobile */}
                    <button
                        className="md:hidden text-white focus:outline-none"
                        onClick={toggleMobileMenu}
                        aria-label="Toggle mobile menu"
                        tabIndex={0}
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-6 w-6"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            {mobileMenuOpen ? (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            ) : (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                            )}
                        </svg>
                    </button>

                    {/* Desktop Menu - Hidden on mobile */}
                    <div className="hidden md:flex items-center space-x-4">
                        {!user ? (
                            <>
                                <Link
                                    href="/auth/signin"
                                    className="inline-block px-4 py-2 text-white hover:text-blue-400 transition duration-300"
                                    aria-label="Sign in to your account"
                                    tabIndex={0}
                                >
                                    Sign In
                                </Link>
                                <Link
                                    href="/auth/signup"
                                    className="inline-block bg-blue-600 px-4 py-2 text-white rounded-md hover:bg-blue-700 transition duration-300"
                                    aria-label="Create a new account"
                                    tabIndex={0}
                                >
                                    Sign Up
                                </Link>
                            </>
                        ) : (
                            <>
                                {!isDashboard && (
                                    <Link
                                        href="/dashboard"
                                        className="inline-block px-4 py-2 text-white hover:text-blue-400 transition duration-300"
                                        aria-label="Go to dashboard"
                                        tabIndex={0}
                                    >
                                        Dashboard
                                    </Link>
                                )}
                                <AdminOnly>
                                    <Link
                                        href="/admin"
                                        className="inline-block bg-indigo-600 px-4 py-2 text-white rounded-md hover:bg-indigo-700 transition duration-300"
                                        aria-label="Admin Panel"
                                        tabIndex={0}
                                    >
                                        Admin Panel
                                    </Link>
                                </AdminOnly>
                                <button
                                    onClick={handleLogout}
                                    className="inline-block bg-red-600 px-4 py-2 text-white rounded-md hover:bg-red-700 transition duration-300"
                                    aria-label="Logout"
                                    tabIndex={0}
                                >
                                    Logout
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* Mobile Menu - Only visible when toggled */}
                {mobileMenuOpen && (
                    <div className="md:hidden mt-4 pt-4 border-t border-gray-600">
                        <div className="flex flex-col space-y-3">
                            {!user ? (
                                <>
                                    <Link
                                        href="/auth/signin"
                                        className="block px-4 py-2 text-white hover:text-blue-400 transition duration-300"
                                        aria-label="Sign in to your account"
                                        tabIndex={0}
                                        onClick={() => setMobileMenuOpen(false)}
                                    >
                                        Sign In
                                    </Link>
                                    <Link
                                        href="/auth/signup"
                                        className="block bg-blue-600 px-4 py-2 text-white rounded-md hover:bg-blue-700 transition duration-300"
                                        aria-label="Create a new account"
                                        tabIndex={0}
                                        onClick={() => setMobileMenuOpen(false)}
                                    >
                                        Sign Up
                                    </Link>
                                </>
                            ) : (
                                <>
                                    {!isDashboard && (
                                        <Link
                                            href="/dashboard"
                                            className="block px-4 py-2 text-white hover:text-blue-400 transition duration-300"
                                            aria-label="Go to dashboard"
                                            tabIndex={0}
                                            onClick={() => setMobileMenuOpen(false)}
                                        >
                                            Dashboard
                                        </Link>
                                    )}
                                    <AdminOnly>
                                        <Link
                                            href="/admin"
                                            className="block bg-indigo-600 px-4 py-2 text-white rounded-md hover:bg-indigo-700 transition duration-300"
                                            aria-label="Admin Panel"
                                            tabIndex={0}
                                            onClick={() => setMobileMenuOpen(false)}
                                        >
                                            Admin Panel
                                        </Link>
                                    </AdminOnly>
                                    <button
                                        onClick={() => {
                                            handleLogout();
                                            setMobileMenuOpen(false);
                                        }}
                                        className="block bg-red-600 px-4 py-2 text-white rounded-md hover:bg-red-700 transition duration-300"
                                        aria-label="Logout"
                                        tabIndex={0}
                                    >
                                        Logout
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </nav>
    );
};

export default Navbar; 