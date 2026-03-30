import { NextRequest, NextResponse } from "next/server";
import { createJobPosting, getJobPostings } from "@/lib/supabaseClient";

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
        const page = Number(searchParams.get("page") ?? 0);
        const pageSize = Number(searchParams.get("pageSize") ?? 20);
        const q = searchParams.get("q") ?? undefined;

        const result = await getJobPostings(page, pageSize, q);
        return NextResponse.json(result);
    } catch (error) {
        return serverError(error);
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { company, title, url, description } = body as {
            company?: string;
            title?: string;
            url?: string;
            description?: string;
        };

        if (!company || !title) {
            return badRequest("company and title are required.");
        }

        const job = await createJobPosting(
            company,
            title,
            url ?? "",
            description ?? "",
        );

        return NextResponse.json(job, { status: 201 });
    } catch (error) {
        return serverError(error);
    }
}
