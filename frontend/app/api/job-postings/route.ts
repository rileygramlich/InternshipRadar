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
        const { company, title, location, url, description, tech_tags } = body as {
            company?: string;
            title?: string;
            location?: string;
            url?: string;
            description?: string;
            tech_tags?: string[];
        };

        if (!company || !title) {
            return badRequest("company and title are required.");
        }

        if (
            tech_tags !== undefined &&
            (!Array.isArray(tech_tags) ||
                !tech_tags.every((t) => typeof t === "string"))
        ) {
            return badRequest("tech_tags must be an array of strings.");
        }

        const job = await createJobPosting(
            company,
            title,
            location ?? "",
            url ?? "",
            description ?? "",
            tech_tags,
        );

        return NextResponse.json(job, { status: 201 });
    } catch (error) {
        return serverError(error);
    }
}
