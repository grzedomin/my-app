"use client";

import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

export function DevtoolsWrapper() {
    // Only render in development mode
    if (process.env.NODE_ENV === "production") {
        return null;
    }

    return <ReactQueryDevtools initialIsOpen={false} />;
} 