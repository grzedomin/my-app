import React from "react";
import { useAuth } from "@/context/AuthContext";

interface AdminOnlyProps {
    children: React.ReactNode;
    fallback?: React.ReactNode;
}

export default function AdminOnly({ children, fallback = null }: AdminOnlyProps) {
    const { userRole } = useAuth();

    if (userRole !== "admin") {
        return <>{fallback}</>;
    }

    return <>{children}</>;
} 