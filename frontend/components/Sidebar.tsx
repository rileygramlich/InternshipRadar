"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
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
    const [userAvatarUrl, setUserAvatarUrl] = useState<string | null>(null);
    const [authLoading, setAuthLoading] = useState(false);
    const isLoggedIn = Boolean(userEmail);

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
            const metadataAvatar =
                (
                    user?.user_metadata as {
                        avatar_url?: string;
                        picture?: string;
                    } | null
                )?.avatar_url ??
                (
                    user?.user_metadata as {
                        avatar_url?: string;
                        picture?: string;
                    } | null
                )?.picture ??
                null;
            setUserName(metadataName || user?.email || null);
            setUserAvatarUrl(metadataAvatar);
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
            const metadataAvatar =
                (
                    session?.user?.user_metadata as {
                        avatar_url?: string;
                        picture?: string;
                    } | null
                )?.avatar_url ??
                (
                    session?.user?.user_metadata as {
                        avatar_url?: string;
                        picture?: string;
                    } | null
                )?.picture ??
                null;
            setUserName(metadataName || session?.user?.email || null);
            setUserAvatarUrl(metadataAvatar);
        });

        return () => {
            subscription.unsubscribe();
        };
    }, [supabase]);

    async function handleLogout() {
        if (!isLoggedIn) {
            return;
        }

        try {
            setAuthLoading(true);
            await supabase.auth.signOut();
            setUserEmail(null);
            setUserName(null);
            setUserAvatarUrl(null);
            router.replace("/login");
        } finally {
            setAuthLoading(false);
        }
    }

    async function handleSwitchUser() {
        if (!isLoggedIn) {
            return;
        }

        try {
            setAuthLoading(true);
            await supabase.auth.signOut();
            setUserEmail(null);
            setUserName(null);
            setUserAvatarUrl(null);
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
            <aside className="hidden md:flex md:fixed md:left-0 md:top-0 md:h-screen md:w-64 md:flex-col md:bg-white md:shadow-md3-1 dark:md:bg-[#0b0f14]">
                <div className="p-6 lg:p-8">
                    <h1 className="text-xl font-bold text-md-on-surface dark:text-white lg:text-2xl">
                        Radar
                    </h1>
                    <p className="mt-1 text-sm text-md-subtitle dark:text-gray-400">
                        InternshipRadar
                    </p>
                </div>

                <nav className="mt-2">
                    <ul className="space-y-1 px-3">
                        {navItems.map((item) => {
                            const isActive = pathname === item.href;
                            return (
                                <li key={item.href}>
                                    <Link
                                        href={item.href}
                                        className={`flex min-h-[44px] items-center gap-3 rounded-2xl px-4 py-3 text-sm transition-all duration-150 lg:text-base ${
                                            isActive
                                                ? "bg-primary-light font-medium text-primary dark:bg-blue-900/30 dark:text-blue-400"
                                                : "text-md-on-surface hover:bg-md-surface dark:text-gray-300 dark:hover:bg-gray-800"
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

                <div className="mt-auto border-t border-gray-100 p-4 dark:border-[#313c4d]">
                    <div className="rounded-2xl bg-md-surface px-4 py-3 dark:bg-[#1a2230]">
                        <div className="flex items-start gap-3">
                            <div className="min-w-0">
                                <div className="flex items-center gap-3">
                                    {userAvatarUrl ? (
                                        <Image
                                            src={userAvatarUrl}
                                            alt="Profile photo"
                                            width={36}
                                            height={36}
                                            className="h-9 w-9 rounded-full object-cover"
                                        />
                                    ) : (
                                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-light text-xs font-semibold text-primary dark:bg-[#242d3a] dark:text-blue-200">
                                            {(userName || "A")
                                                .trim()
                                                .charAt(0)
                                                .toUpperCase()}
                                        </div>
                                    )}
                                    <p className="truncate text-sm font-medium text-md-on-surface dark:text-white">
                                        {userName || "Account"}
                                    </p>
                                </div>
                            </div>
                        </div>
                        {mounted && (
                            <div className="mt-2">
                                <button
                                    onClick={() =>
                                        setTheme(
                                            resolvedTheme === "dark"
                                                ? "light"
                                                : "dark",
                                        )
                                    }
                                    aria-label="Toggle dark mode"
                                    className="btn-ripple min-h-[44px] min-w-[44px] rounded-xl p-2 text-md-subtitle transition-colors hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-[#242d3a]"
                                >
                                    {resolvedTheme === "dark" ? "☀️" : "🌙"}
                                </button>
                            </div>
                        )}
                        {isLoggedIn && (
                            <div className="mt-3 grid grid-cols-2 gap-2">
                                <button
                                    onClick={handleSwitchUser}
                                    className="btn-ripple min-h-[44px] w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-md-on-surface hover:bg-md-surface disabled:opacity-60 dark:border-[#344051] dark:bg-[#202938] dark:text-gray-100 dark:hover:bg-[#2b3542]"
                                    disabled={authLoading}
                                >
                                    Switch user
                                </button>
                                <button
                                    onClick={handleLogout}
                                    className="btn-ripple min-h-[44px] w-full rounded-xl bg-red-600 px-3 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-60"
                                    disabled={authLoading}
                                >
                                    Log out
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </aside>

            <nav className="fixed bottom-0 left-0 z-50 flex w-full items-center justify-around border-t border-gray-100 bg-white px-2 py-2 dark:border-[#313c4d] dark:bg-[#0b0f14] md:hidden">
                {navItems.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-1 rounded-2xl px-3 py-2 text-xs transition-colors ${
                                isActive
                                    ? "text-primary dark:text-blue-400"
                                    : "text-md-subtitle dark:text-gray-300"
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
                        className="btn-ripple flex min-h-[44px] min-w-[44px] flex-col items-center justify-center rounded-2xl px-3 py-2 text-xs text-md-subtitle transition-colors hover:bg-md-surface dark:text-gray-300 dark:hover:bg-gray-800"
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
