import { AuthProvider } from "@/context/AuthContext";
import { NotificationProvider } from "@/context/NotificationContext";
import { UserProfileProvider } from "@/context/UserProfileContext";
import Navbar from "@/components/ui/Navbar";
import { Inter } from "next/font/google";
import type { Metadata } from "next";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Oskar App",
  description: "Next.js application with Firebase authentication",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          <NotificationProvider>
            <UserProfileProvider>
              <Navbar />
              {children}
            </UserProfileProvider>
          </NotificationProvider>
        </AuthProvider>
      </body>
    </html>
  );
}