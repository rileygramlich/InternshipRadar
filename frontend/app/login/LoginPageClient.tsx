"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/utils/supabase/client";

function getAppBaseUrl() {
    return (
        process.env.NEXT_PUBLIC_APP_URL ||
        (typeof window !== "undefined" ? window.location.origin : "")
    );
}

export default function LoginPageClient() {
    const supabase = useMemo(() => createClient(), []);
    const router = useRouter();
    const appBaseUrl = getAppBaseUrl();
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [mode, setMode] = useState<"signin" | "signup">("signin");
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [authError, setAuthError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [oauthSubmitting, setOauthSubmitting] = useState(false);
    const [redirectPath, setRedirectPath] = useState("/profile");

    function redirectAfterAuth(path: string) {
        router.replace(path);
        router.refresh();
    }

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);

        const requestedMode = params.get("mode");
        if (requestedMode === "signup" || requestedMode === "signin") {
            setMode(requestedMode);
        }

        const callbackError = params.get("auth_error");
        if (callbackError) {
            setAuthError(callbackError);
        }

        const requestedRedirect = params.get("redirect");
        if (
            requestedRedirect &&
            requestedRedirect.startsWith("/") &&
            !requestedRedirect.startsWith("//")
        ) {
            setRedirectPath(requestedRedirect);
        }
    }, []);

    useEffect(() => {
        let active = true;
        const { data: listener } = supabase.auth.onAuthStateChange(
            (_event, session) => {
                if (session) {
                    redirectAfterAuth(redirectPath);
                }
            },
        );

        async function checkSession() {
            const {
                data: { session },
            } = await supabase.auth.getSession();
            if (!active) return;
            if (session) {
                redirectAfterAuth(redirectPath);
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
            <div className="px-4 py-6 text-gray-700 dark:text-gray-300">
                Checking session...
            </div>
        );
    }

    async function handleGoogleAuth() {
        setAuthError(null);
        setMessage(null);
        setOauthSubmitting(true);

        try {
            const callbackUrl = appBaseUrl
                ? `${appBaseUrl}/auth/callback?next=${encodeURIComponent(
                      redirectPath,
                  )}`
                : undefined;

            const { error } = await supabase.auth.signInWithOAuth({
                provider: "google",
                options: {
                    redirectTo: callbackUrl,
                    queryParams: {
                        access_type: "offline",
                        prompt: "consent",
                    },
                },
            });

            if (error) {
                throw new Error(error.message || "Google sign-in failed.");
            }
        } catch (err) {
            setAuthError(
                err instanceof Error
                    ? err.message
                    : "Google sign-in could not be started.",
            );
            setOauthSubmitting(false);
        }
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

                redirectAfterAuth(redirectPath);
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
                    emailRedirectTo: appBaseUrl
                        ? `${appBaseUrl}/profile`
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
                redirectAfterAuth(redirectPath);
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
        <div className="flex justify-center px-4 py-6">
            <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-md3-2 dark:border dark:border-[#313c4d] dark:bg-[#0b0f14] dark:shadow-[0_10px_24px_rgba(0,0,0,0.24)]">
                <h1 className="text-2xl font-semibold text-md-on-surface dark:text-white mb-4">
                    {mode === "signin"
                        ? "Sign in to Internship Radar"
                        : "Create your Internship Radar account"}
                </h1>
                <p className="text-sm text-md-subtitle dark:text-gray-400 mb-6">
                    {mode === "signin"
                        ? "Use your email and password."
                        : "Sign up with your name, email, and password."}
                </p>

                <div className="mb-4 grid grid-cols-2 gap-2 rounded-2xl bg-md-surface dark:bg-[#1b2430] p-1">
                    <button
                        type="button"
                        onClick={() => {
                            setMode("signin");
                            setAuthError(null);
                            setMessage(null);
                        }}
                        className={[
                            "btn-ripple rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                            mode === "signin"
                                ? "bg-white dark:bg-gray-700 text-md-on-surface dark:text-white shadow-sm"
                                : "text-md-subtitle dark:text-gray-400 hover:text-md-on-surface dark:hover:text-gray-200",
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
                            "btn-ripple rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                            mode === "signup"
                                ? "bg-white dark:bg-gray-700 text-md-on-surface dark:text-white shadow-sm"
                                : "text-md-subtitle dark:text-gray-400 hover:text-md-on-surface dark:hover:text-gray-200",
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
                    <button
                        type="button"
                        onClick={handleGoogleAuth}
                        disabled={oauthSubmitting || submitting}
                        className="btn-ripple flex w-full items-center justify-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-md-on-surface transition-colors hover:bg-md-surface disabled:opacity-60 dark:border-[#344051] dark:bg-[#1b2430] dark:text-gray-100 dark:hover:bg-[#242d3a]"
                    >
                        <svg
                            aria-hidden="true"
                            viewBox="0 0 48 48"
                            className="h-5 w-5 shrink-0"
                        >
                            <path
                                fill="#EA4335"
                                d="M24 9.5c3.18 0 6.04 1.09 8.3 3.22l6.19-6.19C35.74 3.25 30.47 1 24 1 14.73 1 6.73 6.31 2.85 13.9l7.33 5.69C12.03 13.12 17.57 9.5 24 9.5z"
                            />
                            <path
                                fill="#4285F4"
                                d="M46.5 24.55c0-1.54-.14-3.02-.39-4.45H24v8.42h12.7c-.55 2.98-2.23 5.51-4.76 7.21l7.26 5.63C43.64 37.67 46.5 31.72 46.5 24.55z"
                            />
                            <path
                                fill="#FBBC05"
                                d="M10.18 28.59a14.5 14.5 0 0 1 0-9.18L2.85 13.9A23.95 23.95 0 0 0 0 24c0 3.84.92 7.47 2.85 10.1l7.33-5.51z"
                            />
                            <path
                                fill="#34A853"
                                d="M24 48c6.47 0 11.9-2.13 15.87-5.79l-7.26-5.63c-2.02 1.36-4.61 2.16-8.61 2.16-6.43 0-11.97-3.62-13.82-8.59l-7.33 5.51C6.73 41.69 14.73 48 24 48z"
                            />
                        </svg>
                        {oauthSubmitting
                            ? "Redirecting to Google..."
                            : "Sign in with Google"}
                    </button>

                    <div className="flex items-center gap-3">
                        <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
                        <span className="text-xs uppercase tracking-wide text-md-subtitle dark:text-gray-500">
                            or
                        </span>
                        <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
                    </div>

                    {mode === "signup" && (
                        <div>
                            <label className="block text-sm font-medium text-md-on-surface dark:text-gray-300">
                                Name
                            </label>
                            <input
                                className="mt-1 w-full rounded-2xl border border-gray-200 dark:border-[#344051] bg-white dark:bg-[#1b2430] text-md-on-surface dark:text-white placeholder-md-subtitle dark:placeholder-gray-400 px-3 py-2 shadow-sm"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Ada Lovelace"
                                autoComplete="name"
                                required={mode === "signup"}
                            />
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-md-on-surface dark:text-gray-300">
                            Email
                        </label>
                        <input
                            className="mt-1 w-full rounded-2xl border border-gray-200 dark:border-[#344051] bg-white dark:bg-[#1b2430] text-md-on-surface dark:text-white placeholder-md-subtitle dark:placeholder-gray-400 px-3 py-2 shadow-sm"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@example.com"
                            autoComplete="email"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-md-on-surface dark:text-gray-300">
                            Password
                        </label>
                        <input
                            className="mt-1 w-full rounded-2xl border border-gray-200 dark:border-[#344051] bg-white dark:bg-[#1b2430] text-md-on-surface dark:text-white placeholder-md-subtitle dark:placeholder-gray-400 px-3 py-2 shadow-sm"
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
                        <p className="text-sm text-red-600 dark:text-red-400">
                            {authError}
                        </p>
                    )}
                    {message && (
                        <p className="text-sm text-emerald-600 dark:text-emerald-400">
                            {message}
                        </p>
                    )}

                    <button
                        type="submit"
                        disabled={submitting}
                        className="btn-ripple w-full rounded-2xl bg-primary dark:bg-primary px-4 py-3 text-white font-medium hover:bg-primary-dark dark:hover:bg-primary-dark disabled:opacity-60 transition-colors"
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
