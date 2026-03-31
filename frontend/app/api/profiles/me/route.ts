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
            setAll(cookiesToSet) {
                cookiesToSet.forEach(({ name, value, options }) => {
                    cookieStore.set(name, value, options);
                });
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

        const updates = {
            ...(typeof body.name === "string"
                ? { name: body.name.trim() }
                : {}),
            ...(typeof body.discord_webhook_url === "string"
                ? { discord_webhook_url: body.discord_webhook_url }
                : {}),
            ...(Array.isArray(body.skills) ? { skills: body.skills } : {}),
            ...(typeof body.location_preference === "string"
                ? { location_preference: body.location_preference }
                : {}),
        };

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
            throw error;
        }

        return NextResponse.json({ data });
    } catch (error) {
        return serverError(error);
    }
}
