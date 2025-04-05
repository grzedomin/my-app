import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
    const authToken = request.cookies.get("__session");

    // If the user is not logged in and trying to access a protected route,
    // redirect them to the login page
    if (!authToken && !request.nextUrl.pathname.startsWith("/auth")) {
        return NextResponse.redirect(new URL("/auth/signin", request.url));
    }

    // For admin routes, check if the user has admin role
    if (request.nextUrl.pathname.startsWith("/admin")) {
        if (!authToken) {
            return NextResponse.redirect(new URL("/auth/signin", request.url));
        }

        // In a real implementation, you would verify the token and check claims
        // This would be done using a server-side API route rather than in middleware
        // For now, we'll redirect non-admin users at the client side
    }

    return NextResponse.next();
}

// Add your protected routes here
export const config = {
    matcher: [
        "/dashboard/:path*",
        "/profile/:path*",
        "/admin/:path*",
        // add other protected routes
    ],
};