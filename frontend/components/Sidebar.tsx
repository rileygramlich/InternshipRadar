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

    useEffect(() => {
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            setUserEmail(session?.user?.email ?? null);
            const metadataName =
                (session?.user?.user_metadata as { full_name?: string } | null)
                    ?.full_name ?? null;
            setUserName(metadataName || session?.user?.email || null);
        });

        return () => {
            subscription.unsubscribe();
        };
    }, [supabase]);

    async function handleLogout() {
        try {
            setAuthLoading(true);
            await supabase.auth.signOut();
            setUserEmail(null);
            setUserName(null);
            router.replace("/login");
        } finally {
            setAuthLoading(false);
        }
    }

    async function handleSwitchUser() {
        try {
            setAuthLoading(true);
            await supabase.auth.signOut();
            setUserEmail(null);
            setUserName(null);
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
        <aside className="w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 shadow-sm h-screen fixed left-0 top-0">
            <div className="p-8">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Radar
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    InternshipRadar
                </p>
            </div>

            <nav className="mt-8">
                <ul className="space-y-2 px-4">
                    {navItems.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                            <li key={item.href}>
                                <Link
                                    href={item.href}
                                    className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                                        isActive
                                            ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium"
                                            : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                                    }`}
                                >
                                    <span className="text-xl">{item.icon}</span>
                                    <span>{item.label}</span>
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            </nav>

            <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 dark:border-gray-700">
                <div className="px-4 py-3 rounded-lg bg-gray-50 dark:bg-gray-800">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                                {userName || "Account"}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
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
                                    className="rounded p-1 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                                >
                                    {resolvedTheme === "dark" ? "☀️" : "🌙"}
                                </button>
                            )}
                        </div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                        <button
                            onClick={handleSwitchUser}
                            className="w-full rounded bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600"
                            disabled={authLoading}
                        >
                            Switch user
                        </button>
                        <button
                            onClick={handleLogout}
                            className="w-full rounded bg-red-600 px-3 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-60"
                            disabled={authLoading}
                        >
                            Log out
                        </button>
                    </div>
                </div>
            </div>
        </aside>
    );
}
