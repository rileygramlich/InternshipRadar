import { NextRequest, NextResponse } from "next/server";
import { deleteProfile, getProfile, updateProfile } from "@/lib/supabaseClient";

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

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const { id } = await params;
        const profile = await getProfile(id);
        return NextResponse.json(profile);
    } catch (error) {
        return serverError(error);
    }
}

export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const updates = (await req.json()) as {
            name?: string;
            email?: string;
            discord_webhook_url?: string;
            skills?: string[];
            location_preference?: string;
        };

        if (!updates || Object.keys(updates).length === 0) {
            return badRequest("No updates provided.");
        }

        if (typeof updates.name === "string" && !updates.name.trim()) {
            return badRequest("name cannot be empty.");
        }

        if (typeof updates.email === "string" && !updates.email.trim()) {
            return badRequest("email cannot be empty.");
        }

        const { id } = await params;
        const updated = await updateProfile(id, updates);
        return NextResponse.json(updated);
    } catch (error) {
        if (isUniqueViolation(error)) {
            return conflict("A profile with this email already exists.");
        }
        return serverError(error);
    }
}

export async function DELETE(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const { id } = await params;
        await deleteProfile(id);
        return NextResponse.json({ success: true });
    } catch (error) {
        return serverError(error);
    }
}
