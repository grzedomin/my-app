"use client";

import { AuthProvider } from "@/context/AuthContext";
import { NotificationProvider } from "@/context/NotificationContext";
import { UserProfileProvider } from "@/context/UserProfileContext";
import { QueryProvider } from "@/context/QueryProvider";
import Navbar from "@/components/ui/Navbar";
import { ReactNode } from "react";

interface ClientProvidersProps {
    children: ReactNode;
}

export default function ClientProviders({ children }: ClientProvidersProps) {
    return (
        <QueryProvider>
            <AuthProvider>
                <NotificationProvider>
                    <UserProfileProvider>
                        <Navbar />
                        {children}
                    </UserProfileProvider>
                </NotificationProvider>
            </AuthProvider>
        </QueryProvider>
    );
} 