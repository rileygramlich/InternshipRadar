import { NextRequest, NextResponse } from "next/server";
import {
    deleteApplication,
    getApplicationById,
    updateApplication,
} from "@/lib/supabaseClient";

function badRequest(message: string) {
    return NextResponse.json({ error: message }, { status: 400 });
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
        const application = await getApplicationById(id);
        return NextResponse.json(application);
    } catch (error) {
        return serverError(error);
    }
}

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const updates = (await req.json()) as {
            status?: "saved" | "applied" | "interview" | "rejected" | "offer";
            match_score?: number;
        };

        if (!updates || Object.keys(updates).length === 0) {
            return badRequest("No updates provided.");
        }

        const { id } = await params;
        const updated = await updateApplication(id, updates);
        return NextResponse.json(updated);
    } catch (error) {
        return serverError(error);
    }
}

export async function DELETE(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const { id } = await params;
        await deleteApplication(id);
        return NextResponse.json({ success: true });
    } catch (error) {
        return serverError(error);
    }
}
