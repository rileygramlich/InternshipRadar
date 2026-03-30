import type { Metadata } from "next";
import Sidebar from "@/components/Sidebar";
import "./globals.css";

export const metadata: Metadata = {
    title: "InternshipRadar",
    description: "Discover and track your ideal internship opportunities",
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en">
            <body className="bg-gray-50">
                <div className="flex h-screen overflow-hidden">
                    <Sidebar />
                    <main className="ml-64 flex-1 overflow-auto">
                        <div className="p-8">{children}</div>
                    </main>
                </div>
            </body>
        </html>
    );
}
