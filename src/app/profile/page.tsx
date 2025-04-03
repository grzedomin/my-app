"use client";

import UserProfile from "@/components/profile/UserProfile";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function ProfilePage() {
    const { user } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!user) {
            router.push("/auth/signin");
        }
    }, [user, router]);

    if (!user) return null;

    return <UserProfile />;
} 