"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";

import { createClient } from "@/utils/supabase/client";

export default function Sidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const supabase = useMemo(() => createClient(), []);
    const { resolvedTheme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    const [userEmail, setUserEmail] = useState<string | null>(null);
    const [userName, setUserName] = useState<string | null>(null);
    const [authLoading, setAuthLoading] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        let active = true;
        async function loadUser() {
            const {
                data: { user },
            } = await supabase.auth.getUser();
            if (!active) return;
            setUserEmail(user?.email ?? null);
            const metadataName =
                (user?.user_metadata as { full_name?: string } | null)
                    ?.full_name ?? null;
            setUserName(metadataName || user?.email || null);
        }

        loadUser();
        return () => {
            active = false;
        };
    }, [supabase]);

    async function handleLogout() {
        try {
            setAuthLoading(true);
            await supabase.auth.signOut();
            router.replace("/login");
        } finally {
            setAuthLoading(false);
        }
    }

    async function handleSwitchUser() {
        try {
            setAuthLoading(true);
            await supabase.auth.signOut();
            router.push("/login");
        } finally {
            setAuthLoading(false);
        }
    }

    const navItems = [
        { href: "/radar", label: "Discovery", icon: "📡" },
        { href: "/tracker", label: "Applications", icon: "📋" },
        { href: "/profile", label: "Settings", icon: "⚙️" },
    ];

    return (
        <>
            <aside className="hidden md:flex md:fixed md:left-0 md:top-0 md:h-screen md:w-64 md:flex-col md:border-r md:border-gray-200 md:bg-white md:shadow-sm dark:md:border-gray-700 dark:md:bg-gray-900">
                <div className="p-6 lg:p-8">
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white lg:text-2xl">
                        Radar
                    </h1>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        InternshipRadar
                    </p>
                </div>

                <nav className="mt-2">
                    <ul className="space-y-2 px-4">
                        {navItems.map((item) => {
                            const isActive = pathname === item.href;
                            return (
                                <li key={item.href}>
                                    <Link
                                        href={item.href}
                                        className={`flex min-h-[44px] items-center gap-3 rounded-lg px-4 py-3 text-sm transition-colors lg:text-base ${
                                            isActive
                                                ? "bg-blue-50 font-medium text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                                                : "text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"
                                        }`}
                                    >
                                        <span
                                            className="text-xl"
                                            aria-hidden="true"
                                        >
                                            {item.icon}
                                        </span>
                                        <span className="truncate">
                                            {item.label}
                                        </span>
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                </nav>

                <div className="mt-auto border-t border-gray-200 p-4 dark:border-gray-700">
                    <div className="rounded-lg bg-gray-50 px-4 py-3 dark:bg-gray-800">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
                                    {userName || "Account"}
                                </p>
                                <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                                    {userEmail || "Not signed in"}
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                    v0.1.0
                                </span>
                                {mounted && (
                                    <button
                                        onClick={() =>
                                            setTheme(
                                                resolvedTheme === "dark"
                                                    ? "light"
                                                    : "dark",
                                            )
                                        }
                                        aria-label="Toggle dark mode"
                                        className="min-h-[44px] min-w-[44px] rounded p-2 text-gray-500 transition-colors hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-700"
                                    >
                                        {resolvedTheme === "dark" ? "☀️" : "🌙"}
                                    </button>
                                )}
                            </div>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-2">
                            <button
                                onClick={handleSwitchUser}
                                className="min-h-[44px] w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-60 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                                disabled={authLoading}
                            >
                                Switch user
                            </button>
                            <button
                                onClick={handleLogout}
                                className="min-h-[44px] w-full rounded bg-red-600 px-3 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-60"
                                disabled={authLoading}
                            >
                                Log out
                            </button>
                        </div>
                    </div>
                </div>
            </aside>

            <nav className="fixed bottom-0 left-0 z-50 flex w-full items-center justify-around border-t border-gray-200 bg-white px-2 py-2 dark:border-gray-700 dark:bg-gray-900 md:hidden">
                {navItems.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-1 rounded-md px-3 py-2 text-xs transition-colors ${
                                isActive
                                    ? "text-blue-600 dark:text-blue-400"
                                    : "text-gray-600 dark:text-gray-300"
                            }`}
                        >
                            <span className="text-base" aria-hidden="true">
                                {item.icon}
                            </span>
                            <span className="leading-none">{item.label}</span>
                        </Link>
                    );
                })}
                {mounted && (
                    <button
                        onClick={() =>
                            setTheme(
                                resolvedTheme === "dark" ? "light" : "dark",
                            )
                        }
                        aria-label="Toggle dark mode"
                        className="flex min-h-[44px] min-w-[44px] flex-col items-center justify-center rounded-md px-3 py-2 text-xs text-gray-600 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                    >
                        <span className="text-base" aria-hidden="true">
                            {resolvedTheme === "dark" ? "☀️" : "🌙"}
                        </span>
                        <span className="leading-none">Theme</span>
                    </button>
                )}
            </nav>
        </>
    );
}
