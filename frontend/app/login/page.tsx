"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { createClient } from "@/utils/supabase/client";

export default function LoginPage() {
    const supabase = useMemo(() => createClient(), []);
    const router = useRouter();
    const searchParams = useSearchParams();
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [mode, setMode] = useState<"signin" | "signup">("signin");
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [authError, setAuthError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);

    const redirectPath = searchParams.get("redirect") || "/profile";

    useEffect(() => {
        const requestedMode = searchParams.get("mode");
        if (requestedMode === "signup" || requestedMode === "signin") {
            setMode(requestedMode);
        }
    }, [searchParams]);

    useEffect(() => {
        let active = true;
        const { data: listener } = supabase.auth.onAuthStateChange(
            (_event, session) => {
                if (session) {
                    router.replace(redirectPath);
                }
            },
        );

        async function checkSession() {
            const {
                data: { session },
            } = await supabase.auth.getSession();
            if (!active) return;
            if (session) {
                router.replace(redirectPath);
            } else {
                setLoading(false);
            }
        }
        checkSession();
        return () => {
            active = false;
            listener.subscription.unsubscribe();
        };
    }, [redirectPath, router, supabase]);

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center text-gray-700">
                Checking session...
            </div>
        );
    }

    async function handleAuthSubmit(e: FormEvent) {
        e.preventDefault();
        setAuthError(null);
        setMessage(null);

        if (!email.trim() || !password) {
            setAuthError("Email and password are required.");
            return;
        }

        if (mode === "signup" && !name.trim()) {
            setAuthError("Name is required for sign up.");
            return;
        }

        setSubmitting(true);

        try {
            if (mode === "signin") {
                const { error } = await supabase.auth.signInWithPassword({
                    email: email.trim(),
                    password,
                });

                if (error) {
                    throw new Error(error.message);
                }

                router.replace(redirectPath);
                return;
            }

            const { data, error } = await supabase.auth.signUp({
                email: email.trim(),
                password,
                options: {
                    // Include common metadata keys used by Supabase profile triggers.
                    data: {
                        name: name.trim(),
                        full_name: name.trim(),
                        display_name: name.trim(),
                    },
                    emailRedirectTo:
                        typeof window !== "undefined"
                            ? `${window.location.origin}/profile`
                            : undefined,
                },
            });

            if (error) {
                const message = error.message || "Authentication failed.";
                const lowered = message.toLowerCase();
                if (
                    lowered.includes("unexpected_failure") ||
                    lowered.includes("database error")
                ) {
                    throw new Error(
                        "Signup failed in Supabase Auth (likely a DB trigger/constraint issue). Check your Supabase Auth logs and profile trigger function.",
                    );
                }
                throw new Error(message);
            }

            const profileRes = await fetch("/api/profiles", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: name.trim(),
                    email: email.trim(),
                    discord_webhook_url: "",
                    skills: [],
                    location_preference: "",
                }),
            });

            if (!profileRes.ok) {
                const body = await profileRes.json().catch(() => ({}));
                const msg = body.error || "Failed creating profile settings.";
                if (
                    profileRes.status !== 409 &&
                    !String(msg).toLowerCase().includes("already exists")
                ) {
                    setMessage(
                        "Account created. We could not initialize profile settings yet, but you can sign in now.",
                    );
                }
            }

            setMessage(
                data.session
                    ? "Account created. Redirecting..."
                    : "Account created. Check your email to confirm your account.",
            );

            if (data.session) {
                router.replace(redirectPath);
            }
        } catch (err) {
            setAuthError(
                err instanceof Error ? err.message : "Authentication failed.",
            );
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
            <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-sm border border-gray-200">
                <h1 className="text-2xl font-semibold text-gray-900 mb-4">
                    {mode === "signin"
                        ? "Sign in to Internship Radar"
                        : "Create your Internship Radar account"}
                </h1>
                <p className="text-sm text-gray-600 mb-6">
                    {mode === "signin"
                        ? "Use your email and password."
                        : "Sign up with your name, email, and password."}
                </p>

                <div className="mb-4 grid grid-cols-2 gap-2 rounded-lg bg-gray-100 p-1">
                    <button
                        type="button"
                        onClick={() => {
                            setMode("signin");
                            setAuthError(null);
                            setMessage(null);
                        }}
                        className={[
                            "rounded-md px-3 py-2 text-sm font-medium",
                            mode === "signin"
                                ? "bg-white text-gray-900 shadow-sm"
                                : "text-gray-600 hover:text-gray-800",
                        ].join(" ")}
                    >
                        Sign In
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setMode("signup");
                            setAuthError(null);
                            setMessage(null);
                        }}
                        className={[
                            "rounded-md px-3 py-2 text-sm font-medium",
                            mode === "signup"
                                ? "bg-white text-gray-900 shadow-sm"
                                : "text-gray-600 hover:text-gray-800",
                        ].join(" ")}
                    >
                        Sign Up
                    </button>
                </div>

                <form
                    onSubmit={handleAuthSubmit}
                    className="space-y-4"
                    autoComplete="on"
                >
                    {mode === "signup" && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700">
                                Name
                            </label>
                            <input
                                className="mt-1 w-full rounded border-gray-300 shadow-sm"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Ada Lovelace"
                                autoComplete="name"
                                required={mode === "signup"}
                            />
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-700">
                            Email
                        </label>
                        <input
                            className="mt-1 w-full rounded border-gray-300 shadow-sm"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@example.com"
                            autoComplete="email"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">
                            Password
                        </label>
                        <input
                            className="mt-1 w-full rounded border-gray-300 shadow-sm"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="At least 6 characters"
                            autoComplete={
                                mode === "signup"
                                    ? "new-password"
                                    : "current-password"
                            }
                            minLength={6}
                            required
                        />
                    </div>

                    {authError && (
                        <p className="text-sm text-red-600">{authError}</p>
                    )}
                    {message && (
                        <p className="text-sm text-emerald-600">{message}</p>
                    )}

                    <button
                        type="submit"
                        disabled={submitting}
                        className="w-full rounded bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 disabled:opacity-60"
                    >
                        {submitting
                            ? mode === "signin"
                                ? "Signing in..."
                                : "Signing up..."
                            : mode === "signin"
                              ? "Sign In"
                              : "Create Account"}
                    </button>
                </form>
            </div>
        </div>
    );
}
