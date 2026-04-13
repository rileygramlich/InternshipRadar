import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

const JOB_LINK_INPUT_CHAR_LIMIT = 8000;
const JOB_LINK_MAX_OUTPUT_TOKENS = 350;

function badRequest(message: string) {
    return NextResponse.json({ error: message }, { status: 400 });
}

function serverError(error: unknown) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    const status =
        typeof error === "object" &&
        error !== null &&
        "status" in error &&
        typeof (error as { status?: unknown }).status === "number"
            ? ((error as { status: number }).status ?? 500)
            : 500;

    return NextResponse.json({ error: message }, { status });
}

function htmlToText(html: string) {
    return html
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/\s+/g, " ")
        .trim();
}

function safeUrl(value: string) {
    try {
        const parsed = new URL(value);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
            return null;
        }
        return parsed.toString();
    } catch {
        return null;
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = (await req.json()) as { url?: string };
        const normalizedUrl = safeUrl(body.url ?? "");

        if (!normalizedUrl) {
            return badRequest("A valid http(s) URL is required.");
        }

        const pageRes = await fetch(normalizedUrl, {
            headers: {
                "User-Agent": "InternshipRadarBot/1.0",
            },
        });

        if (!pageRes.ok) {
            return badRequest("Failed to fetch job URL.");
        }

        const html = await pageRes.text();
        const text = htmlToText(html).slice(0, JOB_LINK_INPUT_CHAR_LIMIT);

        if (!text) {
            return badRequest("Could not read content from that URL.");
        }

        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            return serverError("OpenAI API key is not configured.");
        }

        const openai = new OpenAI({ apiKey });
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            response_format: { type: "json_object" },
            temperature: 0.2,
            max_tokens: JOB_LINK_MAX_OUTPUT_TOKENS,
            messages: [
                {
                    role: "system",
                    content:
                        "Extract structured job posting fields from webpage text and return only JSON.",
                },
                {
                    role: "user",
                    content: `Extract this job posting into JSON with EXACT keys:\n- company (string)\n- title (string)\n- description (string)\n- tech_tags (string array, max 15)\n\nURL: ${normalizedUrl}\n\nPage text:\n${text}`,
                },
            ],
        });

        const raw = completion.choices[0]?.message?.content ?? "{}";
        const parsed = JSON.parse(raw) as {
            company?: unknown;
            title?: unknown;
            description?: unknown;
            tech_tags?: unknown;
        };

        const company =
            typeof parsed.company === "string" ? parsed.company.trim() : "";
        const title =
            typeof parsed.title === "string" ? parsed.title.trim() : "";
        const description =
            typeof parsed.description === "string"
                ? parsed.description.trim()
                : "";
        const tech_tags = Array.isArray(parsed.tech_tags)
            ? parsed.tech_tags
                  .filter((value): value is string => typeof value === "string")
                  .map((tag) => tag.trim())
                  .filter(Boolean)
                  .slice(0, 15)
            : [];

        return NextResponse.json({
            company,
            title,
            description,
            tech_tags,
            url: normalizedUrl,
        });
    } catch (error) {
        return serverError(error);
    }
}
