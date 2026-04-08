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
            <body className="bg-gray-50 dark:bg-gray-950 overflow-x-hidden">
                <ThemeProvider
                    attribute="class"
                    defaultTheme="system"
                    enableSystem
                >
                    <div className="flex min-h-screen overflow-hidden">
                        <Sidebar />
                        <main className="flex-1 overflow-y-auto md:ml-64">
                            <div className="p-4 pb-24 md:p-6 md:pb-6 lg:p-8">
                                {children}
                            </div>
                        </main>
                    </div>
                </ThemeProvider>
            </body>
        </html>
    );
}
