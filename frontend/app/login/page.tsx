"use client";

import { useEffect, useMemo, useState } from "react";
import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { useRouter } from "next/navigation";

import { createClient } from "@/utils/supabase/client";

export default function LoginPage() {
    const supabase = useMemo(() => createClient(), []);
    const router = useRouter();
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let active = true;
        const { data: listener } = supabase.auth.onAuthStateChange(
            (_event, session) => {
                if (session) {
                    router.replace("/profile");
                }
            },
        );

        async function checkSession() {
            const {
                data: { session },
            } = await supabase.auth.getSession();
            if (!active) return;
            if (session) {
                router.replace("/profile");
            } else {
                setLoading(false);
            }
        }
        checkSession();
        return () => {
            active = false;
            listener.subscription.unsubscribe();
        };
    }, [router, supabase]);

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center text-gray-700">
                Checking session...
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
            <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-sm border border-gray-200">
                <h1 className="text-2xl font-semibold text-gray-900 mb-4">
                    Sign in to Internship Radar
                </h1>
                <p className="text-sm text-gray-600 mb-6">
                    Use email/password to get started.
                </p>
                <Auth
                    supabaseClient={supabase}
                    appearance={{ theme: ThemeSupa }}
                    providers={[]}
                    redirectTo={
                        typeof window !== "undefined"
                            ? `${window.location.origin}/profile`
                            : undefined
                    }
                />
            </div>
        </div>
    );
}
