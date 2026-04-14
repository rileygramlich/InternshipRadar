"use client";

import type { ReactNode } from "react";

import Sidebar from "@/components/Sidebar";

type AppShellProps = {
    children: ReactNode;
};

export default function AppShell({ children }: AppShellProps) {
    return (
        <div className="flex min-h-screen overflow-hidden">
            <Sidebar />
            <main className="flex-1 overflow-y-auto lg:ml-64">
                <div className="p-4 pb-24 md:p-6 md:pb-24 lg:p-8 lg:pb-8">
                    {children}
                </div>
            </main>
        </div>
    );
}
