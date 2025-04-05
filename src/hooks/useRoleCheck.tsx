import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export function useRoleCheck(requiredRole: "admin" | "user" | null = null) {
    const { user, userRole, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        // Wait until authentication has completed
        if (loading) return;

        // If no user is logged in, redirect to login
        if (!user) {
            router.push("/auth/signin");
            return;
        }

        // If a specific role is required, check it
        if (requiredRole && userRole !== requiredRole) {
            if (requiredRole === "admin") {
                // If admin access is required but user is not an admin
                router.push("/dashboard");
            } else {
                // Handle other role-specific redirects
                router.push("/");
            }
        }
    }, [user, userRole, loading, requiredRole, router]);

    return { isAuthorized: !loading && user !== null && (requiredRole === null || userRole === requiredRole) };
} 