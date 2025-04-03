"use client";

import React from "react";

const LoadingSpinner = () => {
    return (
        <div className="fixed inset-0 flex items-center justify-center bg-white dark:bg-gray-900 z-50">
            <div className="relative">
                <div className="h-16 w-16 rounded-full border-t-4 border-b-4 border-blue-500 animate-spin"></div>
                <div className="mt-4 text-center text-gray-600 dark:text-gray-300 font-medium">Loading...</div>
            </div>
        </div>
    );
};

export default LoadingSpinner;