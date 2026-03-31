import { NextRequest, NextResponse } from "next/server";
import { createProfile, listProfiles } from "@/lib/supabaseClient";

function badRequest(message: string) {
    return NextResponse.json({ error: message }, { status: 400 });
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
        }: {
            name?: string;
            email?: string;
            discord_webhook_url?: string;
            skills?: string[];
            location_preference?: string;
        } = body;

        if (!skills || !Array.isArray(skills)) {
            return badRequest("skills must be an array of strings.");
        }

        const profile = await createProfile(
            (name ?? "").trim(),
            (email ?? "").trim(),
            discord_webhook_url ?? "",
            skills,
            location_preference ?? "",
        );

        return NextResponse.json(profile, { status: 201 });
    } catch (error) {
        return serverError(error);
    }
}
