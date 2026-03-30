import { NextRequest, NextResponse } from "next/server";
import { createApplication, listApplications } from "@/lib/supabaseClient";

function badRequest(message: string) {
    return NextResponse.json({ error: message }, { status: 400 });
}

function serverError(error: unknown) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
}

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const profileId = searchParams.get("profileId") ?? undefined;
        const jobId = searchParams.get("jobId") ?? undefined;
        const status = searchParams.get("status") ?? undefined;

        const data = await listApplications({ profileId, jobId, status });
        return NextResponse.json({ data });
    } catch (error) {
        return serverError(error);
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { profileId, jobId, matchScore, status } = body as {
            profileId?: string;
            jobId?: string;
            matchScore?: number;
            status?: "saved" | "applied" | "interview" | "rejected" | "offer";
        };

        if (!profileId || !jobId) {
            return badRequest("profileId and jobId are required.");
        }

        const application = await createApplication(
            profileId,
            jobId,
            matchScore ?? 0,
            status ?? "saved",
        );

        return NextResponse.json(application, { status: 201 });
    } catch (error) {
        return serverError(error);
    }
}
