import type { Metadata } from "next";
import Sidebar from "@/components/Sidebar";
import { ThemeProvider } from "@/components/ThemeProvider";
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
        <html lang="en" suppressHydrationWarning>
            <body className="bg-gray-50 dark:bg-gray-950">
                <ThemeProvider
                    attribute="class"
                    defaultTheme="system"
                    enableSystem
                >
                    <div className="flex h-screen overflow-hidden">
                        <Sidebar />
                        <main className="ml-64 flex-1 overflow-auto">
                            <div className="p-8">{children}</div>
                        </main>
                    </div>
                </ThemeProvider>
            </body>
        </html>
    );
}
