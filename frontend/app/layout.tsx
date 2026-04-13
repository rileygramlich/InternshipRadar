import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import Sidebar from "@/components/Sidebar";
import { ThemeProvider } from "@/components/ThemeProvider";
import "./globals.css";

const manrope = Manrope({
    subsets: ["latin"],
    variable: "--font-sans",
    display: "swap",
});

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
            <body
                className={`${manrope.variable} font-sans overflow-x-hidden bg-[radial-gradient(circle_at_top_left,_rgba(47,107,255,0.16),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(34,197,94,0.10),_transparent_26%),linear-gradient(180deg,_#fbf7f1_0%,_#f7f2ea_45%,_#f2ece2_100%)] text-md-on-surface dark:bg-[radial-gradient(circle_at_top_left,_rgba(47,107,255,0.20),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(45,212,191,0.12),_transparent_24%),linear-gradient(180deg,_#0d1630_0%,_#09101f_55%,_#050816_100%)] dark:text-gray-100`}
            >
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
