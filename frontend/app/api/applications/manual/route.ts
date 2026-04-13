import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import {
    TRACKER_PRIVATE_MARKER,
    createApplication,
    createJobPosting,
    supabase,
} from "@/lib/supabaseClient";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

function badRequest(message: string) {
    return NextResponse.json({ error: message }, { status: 400 });
}

function unauthorized(message: string) {
    return NextResponse.json({ error: message }, { status: 401 });
}

function serverError(error: unknown) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
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
                // no-op
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
        .select("id")
        .ilike("email", email)
        .limit(1)
        .maybeSingle();

    if (error) throw error;
    return data;
}

export async function POST(req: NextRequest) {
    try {
        const email = await getCurrentUserEmail();
        if (!email) {
            return unauthorized("You must be logged in.");
        }

        const profile = await getOwnProfileByEmail(email);
        if (!profile?.id) {
            return unauthorized("No profile found for the current user.");
        }

        const body = (await req.json()) as {
            company?: string;
            title?: string;
            url?: string;
            description?: string;
            tech_tags?: string[];
            match_score?: number;
        };

        if (!(body.company ?? "").trim() || !(body.title ?? "").trim()) {
            return badRequest("company and title are required.");
        }

        if (
            body.tech_tags !== undefined &&
            (!Array.isArray(body.tech_tags) ||
                !body.tech_tags.every((tag) => typeof tag === "string"))
        ) {
            return badRequest("tech_tags must be an array of strings.");
        }

        const company = (body.company ?? "").trim();
        const title = (body.title ?? "").trim();

        const storedDescription = `${TRACKER_PRIVATE_MARKER}${
            body.description ? `\n${body.description}` : ""
        }`;

        const job = await createJobPosting(
            company,
            title,
            body.url?.trim() ?? "",
            storedDescription,
            (body.tech_tags ?? []).map((tag) => tag.trim()).filter(Boolean),
        );

        const application = await createApplication(
            profile.id,
            job.id,
            typeof body.match_score === "number" ? body.match_score : 0,
            "applied",
        );

        return NextResponse.json({ data: application }, { status: 201 });
    } catch (error) {
        return serverError(error);
    }
}
