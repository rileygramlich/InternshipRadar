import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabase } from "@/lib/supabaseClient";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

function badRequest(message: string) {
    return NextResponse.json({ error: message }, { status: 400 });
}

function unauthorized(message: string) {
    return NextResponse.json({ error: message }, { status: 401 });
}

function notFound(message: string) {
    return NextResponse.json({ error: message }, { status: 404 });
}

function conflict(message: string) {
    return NextResponse.json({ error: message }, { status: 409 });
}

function serverError(error: unknown) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
}

function isUniqueViolation(error: unknown) {
    return (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code?: string }).code === "23505"
    );
}

function isUndefinedColumn(error: unknown) {
    return (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code?: string }).code === "42703"
    );
}

async function getCurrentUserEmail() {
    if (!supabaseUrl || !anonKey) {
        throw new Error("Missing Supabase environment configuration.");
    }

    const cookieStore = await cookies();
    const authClient = createServerClient(supabaseUrl, anonKey, {
        cookies: {
            getAll() {
                return cookieStore.getAll();
            },
            setAll() {
                // No-op in route handlers; reading the user does not require
                // writing refreshed cookies here.
            },
        },
    });

    const {
        data: { user },
    } = await authClient.auth.getUser();

    return user?.email?.trim().toLowerCase() ?? null;
}

async function getOwnProfileByEmail(email: string) {
    const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .ilike("email", email)
        .limit(1)
        .maybeSingle();

    if (error) throw error;
    return data;
}

export async function GET() {
    try {
        const email = await getCurrentUserEmail();
        if (!email) {
            return unauthorized("You must be logged in.");
        }

        const profile = await getOwnProfileByEmail(email);
        if (!profile) {
            return notFound("No profile found for the current user.");
        }

        return NextResponse.json({ data: profile });
    } catch (error) {
        return serverError(error);
    }
}

export async function PUT(req: NextRequest) {
    try {
        const email = await getCurrentUserEmail();
        if (!email) {
            return unauthorized("You must be logged in.");
        }

        const profile = await getOwnProfileByEmail(email);
        if (!profile) {
            return notFound("No profile found for the current user.");
        }

        const body = (await req.json()) as {
            name?: string;
            discord_webhook_url?: string;
            skills?: string[];
            location_preference?: string;
            experience_level?: string;
            remote_preference?: boolean;
            about?: string;
            profile_photo_url?: string;
        };

        if (!body || Object.keys(body).length === 0) {
            return badRequest("No updates provided.");
        }

        if (typeof body.name === "string" && !body.name.trim()) {
            return badRequest("name cannot be empty.");
        }

        if (body.skills && !Array.isArray(body.skills)) {
            return badRequest("skills must be an array of strings.");
        }

        if (
            "remote_preference" in body &&
            typeof body.remote_preference !== "boolean"
        ) {
            return badRequest("remote_preference must be a boolean.");
        }

        const profileColumns = new Set(Object.keys(profile ?? {}));

        if (
            typeof body.experience_level === "string" &&
            !profileColumns.has("experience_level")
        ) {
            return badRequest(
                "Profile schema is out of date. Add the experience_level column to profiles and try again.",
            );
        }

        const updates = {
            ...(profileColumns.has("name") && typeof body.name === "string"
                ? { name: body.name.trim() }
                : {}),
            ...(profileColumns.has("discord_webhook_url") &&
            typeof body.discord_webhook_url === "string"
                ? { discord_webhook_url: body.discord_webhook_url }
                : {}),
            ...(profileColumns.has("skills") && Array.isArray(body.skills)
                ? { skills: body.skills }
                : {}),
            ...(profileColumns.has("location_preference") &&
            typeof body.location_preference === "string"
                ? { location_preference: body.location_preference }
                : {}),
            ...(profileColumns.has("experience_level") &&
            typeof body.experience_level === "string"
                ? { experience_level: body.experience_level }
                : {}),
            ...(profileColumns.has("remote_preference") &&
            typeof body.remote_preference === "boolean"
                ? { remote_preference: body.remote_preference }
                : {}),
            ...(profileColumns.has("about") && typeof body.about === "string"
                ? { about: body.about }
                : {}),
            ...(profileColumns.has("profile_photo_url") &&
            typeof body.profile_photo_url === "string"
                ? { profile_photo_url: body.profile_photo_url }
                : {}),
        };

        if (Object.keys(updates).length === 0) {
            return badRequest(
                "No valid profile fields were provided for update.",
            );
        }

        const { data, error } = await supabase
            .from("profiles")
            .update(updates)
            .eq("id", profile.id)
            .select("*")
            .single();

        if (error) {
            if (isUniqueViolation(error)) {
                return conflict("Profile update conflicts with existing data.");
            }
            if (isUndefinedColumn(error)) {
                return badRequest(
                    "Profile schema is out of date. Run the latest Supabase profile migration and try again.",
                );
            }
            throw error;
        }

        return NextResponse.json({ data });
    } catch (error) {
        return serverError(error);
    }
}
