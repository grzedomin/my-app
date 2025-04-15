"use client";

import Link from "next/link";
import { useAuth } from "@/context/AuthContext";

export default function Home() {
  const { user, loading } = useAuth();

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Hero Banner */}
      <div
        className="relative h-screen w-full bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/background.avif')" }}
      >
        <div className="absolute inset-0">
          <div className="container mx-auto px-4 h-full flex items-center">
            <div className="max-w-3xl">
              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-6">
                In the game of tennis, knowledge is power. Our AI brings you the knowledge you need.
              </h1>
              {loading ? (
                <div className="mt-8">
                  <div className="inline-block bg-gray-700 animate-pulse px-6 py-3 rounded-md w-32"></div>
                </div>
              ) : (
                <>
                  {!user && (
                    <div className="mt-8 flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
                      <Link
                        href="/auth/signin"
                        className="inline-block bg-blue-600 px-6 py-3 text-white rounded-md hover:bg-blue-700 transition duration-300 text-center"
                        aria-label="Sign in to your account"
                        tabIndex={0}
                      >
                        Sign In
                      </Link>
                      <Link
                        href="/auth/signup"
                        className="inline-block bg-transparent border-2 border-white px-6 py-3 text-white rounded-md hover:bg-white hover:text-gray-900 transition duration-300 text-center"
                        aria-label="Create a new account"
                        tabIndex={0}
                      >
                        Sign Up
                      </Link>
                    </div>
                  )}
                  {user && (
                    <div className="mt-8">
                      <Link
                        href="/scorepredictions"
                        className="inline-block bg-blue-600 px-6 py-3 text-white rounded-md hover:bg-blue-700 transition duration-300 text-center"
                        aria-label="View predictions"
                        tabIndex={0}
                      >
                        View Predictions
                      </Link>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Revolutionizing Tennis Betting */}
      <section className="py-16 md:py-20 bg-gray-900">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl sm:text-4xl font-bold mb-6">Revolutionizing Tennis Betting</h2>
            <p className="text-lg sm:text-xl text-gray-300 mb-10">
              Experience the future of sports betting with our AI-powered predictions, meticulously calculated through 10,000 simulations for unparalleled accuracy.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 mt-12">
            <div className="bg-gray-800 p-6 sm:p-8 rounded-lg text-center">
              <h3 className="text-xl sm:text-2xl font-bold mb-4">80+ Parameters</h3>
              <p className="text-gray-300">Every single detail you can think of is there</p>
            </div>
            <div className="bg-gray-800 p-6 sm:p-8 rounded-lg text-center">
              <h3 className="text-xl sm:text-2xl font-bold mb-4">Automatic Prediction</h3>
              <p className="text-gray-300">Computer Generated picks</p>
            </div>
            <div className="bg-gray-800 p-6 sm:p-8 rounded-lg text-center">
              <h3 className="text-xl sm:text-2xl font-bold mb-4">Backtest Approach</h3>
              <p className="text-gray-300">Each system goes through advanced backtests and forward-tests</p>
            </div>
          </div>
        </div>
      </section>

      {/* Maximize Your Winnings */}
      <section className="py-16 md:py-20 bg-gray-800">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl sm:text-4xl font-bold mb-6">Maximize Your Winnings</h2>
            <p className="text-lg sm:text-xl text-gray-300 mb-10">
              Join us for a smarter betting experience. Our AI technology transforms complex data into clear, actionable insights to help you maximize your returns.
            </p>
            {loading ? (
              <div className="mt-8 flex justify-center">
                <div className="inline-block bg-gray-700 animate-pulse px-6 py-3 rounded-md w-32"></div>
              </div>
            ) : (
              <>
                {!user && (
                  <div className="mt-8 flex flex-col sm:flex-row justify-center space-y-4 sm:space-y-0 sm:space-x-4">
                    <Link
                      href="/auth/signup"
                      className="inline-block bg-blue-600 px-6 py-3 sm:px-8 sm:py-4 text-lg sm:text-xl font-bold text-white rounded-md hover:bg-blue-700 transition duration-300 text-center"
                      aria-label="Sign up now"
                      tabIndex={0}
                    >
                      Sign Up Now
                    </Link>
                    <Link
                      href="/auth/signin"
                      className="inline-block bg-transparent border-2 border-white px-6 py-3 sm:px-8 sm:py-4 text-lg sm:text-xl font-bold text-white rounded-md hover:bg-white hover:text-gray-900 transition duration-300 text-center"
                      aria-label="Already have an account? Sign in"
                      tabIndex={0}
                    >
                      Sign In
                    </Link>
                  </div>
                )}
                {user && (
                  <div className="mt-8">
                    <Link
                      href="/scorepredictions"
                      className="inline-block bg-blue-600 px-6 py-3 sm:px-8 sm:py-4 text-lg sm:text-xl font-bold text-white rounded-md hover:bg-blue-700 transition duration-300 text-center"
                      aria-label="View predictions"
                      tabIndex={0}
                    >
                      View Predictions
                    </Link>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </section>

      {/* Unmatched Precision */}
      <section className="py-16 md:py-20 bg-gray-900">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl sm:text-4xl font-bold mb-6">Unmatched Precision</h2>
            <p className="text-lg sm:text-xl text-gray-300 mb-12">
              Our sophisticated models analyze past performances and current trends to provide you with the most precise predictions in the tennis betting arena.
            </p>
          </div>
          <div className="max-w-4xl mx-auto bg-gray-800 p-6 sm:p-8 rounded-lg">
            <p className="text-base sm:text-xl mb-6">
              We are not looking for only a winner and a loser. It seeks the &quot;value&quot; in each game, where you can make the most money with the smallest risk possible... therefore it predicts bets such as &quot;how many goals will fall&quot; or &quot;who&apos;s going to score the most points&quot; or &quot;will there be more than 5 goals or less&quot;... seeking the value in every game and giving you the most earnings!
            </p>
          </div>
        </div>
      </section>

      {/* Subscription Plans */}
      <section className="py-16 md:py-24 bg-gray-800">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold mb-6">Choose Your Winning Plan</h2>
            <p className="text-lg sm:text-xl text-gray-300">
              Subscribe to unlock our premium AI tennis predictions and gain the competitive edge you need to succeed.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {/* Monthly Subscription */}
            <div className="bg-gray-900 rounded-xl overflow-hidden border border-gray-700 transition-transform duration-300 hover:transform hover:scale-105">
              <div className="p-8">
                <h3 className="text-2xl font-bold mb-2">Monthly Access</h3>
                <div className="flex items-end mb-6">
                  <span className="text-4xl font-bold">$29</span>
                  <span className="text-gray-400 ml-1">/month</span>
                </div>
                <p className="text-gray-300 mb-6">Perfect for bettors who want to test our premium predictions with minimal commitment.</p>

                <Link
                  href="/subscription/monthly"
                  className="block w-full bg-blue-600 py-3 rounded-md font-semibold text-center hover:bg-blue-700 transition duration-300"
                  aria-label="Subscribe to monthly plan"
                  tabIndex={0}
                >
                  Subscribe Now
                </Link>
              </div>
              <div className="bg-gray-800 p-4 text-center text-sm text-gray-400">
                Cancel anytime. No long-term commitment.
              </div>
            </div>

            {/* Yearly Subscription */}
            <div className="bg-gray-900 rounded-xl overflow-hidden border border-blue-500 transition-transform duration-300 hover:transform hover:scale-105 relative">
              <div className="absolute top-0 right-0 bg-blue-600 text-xs font-bold px-3 py-1 uppercase tracking-wider">
                Best Value
              </div>
              <div className="p-8">
                <h3 className="text-2xl font-bold mb-2">Annual Access</h3>
                <div className="flex items-end mb-6">
                  <span className="text-4xl font-bold">$249</span>
                  <span className="text-gray-400 ml-1">/year</span>
                </div>
                <p className="text-gray-300 mb-6">For serious bettors looking to maximize their edge with our most comprehensive package.</p>

                <Link
                  href="/subscription/yearly"
                  className="block w-full bg-blue-600 py-3 rounded-md font-semibold text-center hover:bg-blue-700 transition duration-300"
                  aria-label="Subscribe to yearly plan"
                  tabIndex={0}
                >
                  Subscribe Now
                </Link>
              </div>
              <div className="bg-gray-800 p-4 text-center text-sm text-gray-400">
                <span className="text-blue-400 font-semibold">Save $99</span> compared to monthly billing
              </div>
            </div>
          </div>

          <div className="max-w-2xl mx-auto mt-12 text-center">
            <p className="text-gray-400 text-sm">
              All subscriptions include access to our AI prediction engine, daily match insights, and betting recommendations.
              Your subscription helps us maintain and improve our prediction algorithms.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 bg-gray-900 border-t border-gray-800">
        <div className="container mx-auto px-4 text-center">
          <p className="text-gray-500">Copyright 2025</p>
        </div>
      </footer>
    </div>
  );
}
