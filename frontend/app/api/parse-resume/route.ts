import { NextRequest, NextResponse } from "next/server";
import pdfParse from "pdf-parse";
import OpenAI from "openai";

function badRequest(message: string) {
    return NextResponse.json({ error: message }, { status: 400 });
}

function serverError(error: unknown) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
}

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get("resume");

        if (!file || !(file instanceof Blob)) {
            return badRequest("A PDF file is required in the 'resume' field.");
        }

        if (file.type !== "application/pdf") {
            return badRequest("Only PDF files are supported.");
        }

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        let extractedText: string;
        try {
            const parsed = await pdfParse(buffer);
            extractedText = parsed.text;
        } catch {
            return badRequest("Failed to parse the PDF file.");
        }

        if (!extractedText.trim()) {
            return badRequest(
                "No text could be extracted from the PDF. Please ensure the file is a text-based PDF.",
            );
        }

        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            return serverError("OpenAI API key is not configured.");
        }

        const openai = new OpenAI({ apiKey });

        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content:
                        "You are a resume parser. Extract structured information from the provided resume text and return only valid JSON with no additional commentary.",
                },
                {
                    role: "user",
                    content: `Extract the following fields from this resume and return a JSON object with exactly these keys:
- "skills": an array of strings listing the candidate's technical and professional skills
- "location_preference": a string describing the candidate's preferred work location or "Remote" if not specified
- "experience_level": a string that is one of "Internship", "Entry Level", "Mid Level", or "Senior Level" based on their experience

Resume text:
${extractedText.slice(0, 8000)}`,
                },
            ],
            response_format: { type: "json_object" },
            temperature: 0.2,
        });

        const raw = completion.choices[0]?.message?.content ?? "{}";

        let parsed: {
            skills?: unknown;
            location_preference?: unknown;
            experience_level?: unknown;
        };
        try {
            parsed = JSON.parse(raw);
        } catch {
            return serverError("Failed to parse OpenAI response.");
        }

        const skills = Array.isArray(parsed.skills)
            ? (parsed.skills as string[]).filter(
                  (s) => typeof s === "string" && s.trim(),
              )
            : [];

        const locationPreference =
            typeof parsed.location_preference === "string"
                ? parsed.location_preference.trim()
                : "";

        const experienceLevel =
            typeof parsed.experience_level === "string"
                ? parsed.experience_level.trim()
                : "";

        return NextResponse.json({
            skills,
            location_preference: locationPreference,
            experience_level: experienceLevel,
        });
    } catch (error) {
        return serverError(error);
    }
}
