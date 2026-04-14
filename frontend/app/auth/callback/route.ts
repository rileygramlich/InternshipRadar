import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

import { supabase as adminSupabase } from "@/lib/supabaseClient";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

function normalizeNextPath(nextParam: string | null) {
    if (
        !nextParam ||
        !nextParam.startsWith("/") ||
        nextParam.startsWith("//")
    ) {
        return "/profile";
    }

    return nextParam;
}

function loginErrorRedirect(request: NextRequest, message: string) {
    const target = new URL("/login", request.url);
    target.searchParams.set("auth_error", message);
    return NextResponse.redirect(target);
}

async function ensureProfileForUser(
    email: string,
    fallbackName: string,
    avatarUrl: string,
) {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedName = fallbackName.trim() || normalizedEmail;

    const { data: existing, error: fetchError } = await adminSupabase
        .from("profiles")
        .select("id,name,email")
        .ilike("email", normalizedEmail)
        .limit(1)
        .maybeSingle();

    if (fetchError) {
        throw fetchError;
    }

    if (!existing) {
        const { error: insertError } = await adminSupabase
            .from("profiles")
            .insert({
                name: normalizedName,
                email: normalizedEmail,
                discord_webhook_url: "",
                skills: [],
                location_preference: "",
                experience_level: "",
                remote_preference: true,
                about: "",
                profile_photo_url: avatarUrl,
            });

        if (insertError) {
            throw insertError;
        }

        return;
    }

    const updates: {
        name?: string;
        email?: string;
        profile_photo_url?: string;
    } = {};

    if (existing.email?.toLowerCase() !== normalizedEmail) {
        updates.email = normalizedEmail;
    }

    if (!existing.name || existing.name.trim() !== normalizedName) {
        updates.name = normalizedName;
    }

    if (avatarUrl) {
        updates.profile_photo_url = avatarUrl;
    }

    if (Object.keys(updates).length === 0) {
        return;
    }

    const { error: updateError } = await adminSupabase
        .from("profiles")
        .update(updates)
        .eq("id", existing.id);

    if (updateError) {
        throw updateError;
    }
}

export async function GET(request: NextRequest) {
    if (!supabaseUrl || !anonKey) {
        return loginErrorRedirect(
            request,
            "Missing Supabase auth environment variables.",
        );
    }

    const code = request.nextUrl.searchParams.get("code");
    const nextPath = normalizeNextPath(
        request.nextUrl.searchParams.get("next"),
    );

    if (!code) {
        return loginErrorRedirect(request, "Missing OAuth authorization code.");
    }

    const redirectTo = new URL(nextPath, request.url);
    const response = NextResponse.redirect(redirectTo);

    const supabase = createServerClient(supabaseUrl, anonKey, {
        cookies: {
            getAll() {
                return request.cookies.getAll();
            },
            setAll(cookiesToSet) {
                cookiesToSet.forEach(({ name, value, options }) => {
                    response.cookies.set(name, value, options);
                });
            },
        },
    });

    const { error: exchangeError } =
        await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
        return loginErrorRedirect(
            request,
            exchangeError.message || "Could not complete Google sign-in.",
        );
    }

    const {
        data: { user },
    } = await supabase.auth.getUser();

    const email = user?.email;

    if (!email) {
        await supabase.auth.signOut();
        return loginErrorRedirect(
            request,
            "Signed in with Google, but no email was returned.",
        );
    }

    const metadata = (user.user_metadata ?? {}) as {
        full_name?: string;
        name?: string;
        avatar_url?: string;
        picture?: string;
    };

    const candidateName = metadata.full_name || metadata.name || email;
    const candidateAvatar = metadata.avatar_url || metadata.picture || "";

    try {
        await ensureProfileForUser(email, candidateName, candidateAvatar);
    } catch {
        await supabase.auth.signOut();
        return loginErrorRedirect(
            request,
            "Sign-in succeeded but profile setup failed. Please try again.",
        );
    }

    return response;
}
