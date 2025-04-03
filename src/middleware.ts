import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
    const authToken = request.cookies.get("__session");

    // If the user is not logged in and trying to access a protected route,
    // redirect them to the login page
    if (!authToken && !request.nextUrl.pathname.startsWith("/auth")) {
        return NextResponse.redirect(new URL("/auth/signin", request.url));
    }

    return NextResponse.next();
}

// Add your protected routes here
export const config = {
    matcher: [
        "/dashboard/:path*",
        "/profile/:path*",
        // add other protected routes
    ],
};