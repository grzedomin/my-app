import Link from "next/link";

const Navbar = () => {
    return (
        <nav className="absolute top-0 left-0 right-0 z-10 py-6">
            <div className="container mx-auto px-4">
                <div className="flex justify-between items-center">
                    {/* Logo */}
                    <div className="text-white font-bold text-xl">
                        LOGO
                    </div>

                    {/* Auth Buttons */}
                    <div className="space-x-4">
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
                    </div>
                </div>
            </div>
        </nav>
    );
};

export default Navbar; 