import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900">Welcome to Oskar App</h1>
          <div className="mt-8 space-x-4">
            <Link
              href="/auth/signin"
              className="inline-block bg-indigo-600 px-4 py-2 text-white rounded-md hover:bg-indigo-700"
            >
              Sign In
            </Link>
            <Link
              href="/auth/signup"
              className="inline-block bg-gray-600 px-4 py-2 text-white rounded-md hover:bg-gray-700"
            >
              Sign Up
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
