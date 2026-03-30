import { NextRequest, NextResponse } from "next/server";
import {
    deleteJobPosting,
    getJobPosting,
    updateJobPosting,
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
        const job = await getJobPosting(id);
        return NextResponse.json(job);
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
            company?: string;
            title?: string;
            url?: string;
            description?: string;
        };

        if (!updates || Object.keys(updates).length === 0) {
            return badRequest("No updates provided.");
        }

        const { id } = await params;
        const updated = await updateJobPosting(id, updates);
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
        await deleteJobPosting(id);
        return NextResponse.json({ success: true });
    } catch (error) {
        return serverError(error);
    }
}
