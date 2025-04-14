"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useRoleCheck } from "@/hooks/useRoleCheck";

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const { user } = useAuth();
    const router = useRouter();
    const { isAuthorized } = useRoleCheck("admin");

    useEffect(() => {
        // If user is not logged in, redirect to signin
        if (!user) {
            router.push("/auth/signin");
        }
    }, [user, router]);

    // If not authorized, show loading or nothing while redirecting
    if (!isAuthorized) return null;

    return (
        <div className="admin-layout">
            {/* We don't include the main Navbar here since it's already in the root layout */}
            {/* Admin pages will have their own navigation */}
            {children}
        </div>
    );
} 