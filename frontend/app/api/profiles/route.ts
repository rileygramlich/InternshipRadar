import { NextRequest, NextResponse } from "next/server";
import { createProfile, listProfiles } from "@/lib/supabaseClient";

function badRequest(message: string) {
    return NextResponse.json({ error: message }, { status: 400 });
}

function conflict(message: string) {
    return NextResponse.json({ error: message }, { status: 409 });
}

function isUniqueViolation(error: unknown) {
    return (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code?: string }).code === "23505"
    );
}

function serverError(error: unknown) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
}

export async function GET() {
    try {
        const data = await listProfiles();
        return NextResponse.json({ data });
    } catch (error) {
        return serverError(error);
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const {
            name,
            email,
            discord_webhook_url,
            skills,
            location_preference,
            experience_level,
            remote_preference,
            about,
            profile_photo_url,
        }: {
            name?: string;
            email?: string;
            discord_webhook_url?: string;
            skills?: string[];
            location_preference?: string;
            experience_level?: string;
            remote_preference?: boolean;
            about?: string;
            profile_photo_url?: string;
        } = body;

        if (!(name ?? "").trim()) {
            return badRequest("name is required.");
        }

        if (!(email ?? "").trim()) {
            return badRequest("email is required.");
        }

        if (!skills || !Array.isArray(skills)) {
            return badRequest("skills must be an array of strings.");
        }

        const profile = await createProfile(
            (name ?? "").trim(),
            (email ?? "").trim(),
            discord_webhook_url ?? "",
            skills,
            location_preference ?? "",
            experience_level ?? null,
            typeof remote_preference === "boolean" ? remote_preference : true,
            about ?? "",
            profile_photo_url ?? "",
        );

        return NextResponse.json(profile, { status: 201 });
    } catch (error) {
        if (isUniqueViolation(error)) {
            return conflict("A profile with this email already exists.");
        }
        return serverError(error);
    }
}
