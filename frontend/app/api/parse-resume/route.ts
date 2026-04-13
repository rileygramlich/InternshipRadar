import { NextRequest, NextResponse } from "next/server";
import PDFParser from "pdf2json";
import OpenAI from "openai";

export const runtime = "nodejs";

const RESUME_INPUT_CHAR_LIMIT = 6000;
const RESUME_MAX_OUTPUT_TOKENS = 350;

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

function parseModelJson(raw: string) {
    const trimmed = raw.trim();
    const withoutCodeFence = trimmed
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();

    const jsonCandidate =
        withoutCodeFence.startsWith("{") || withoutCodeFence.startsWith("[")
            ? withoutCodeFence
            : (() => {
                  const firstBrace = withoutCodeFence.indexOf("{");
                  const lastBrace = withoutCodeFence.lastIndexOf("}");
                  if (firstBrace >= 0 && lastBrace > firstBrace) {
                      return withoutCodeFence.slice(firstBrace, lastBrace + 1);
                  }

                  return withoutCodeFence;
              })();

    return JSON.parse(jsonCandidate) as {
        skills?: unknown;
        location_preference?: unknown;
        experience_level?: unknown;
        remote_preference?: unknown;
        about?: unknown;
    };
}

async function extractTextFromPdf(buffer: Buffer) {
    return new Promise<string>((resolve, reject) => {
        const parser = new PDFParser(null, true);

        const cleanup = () => {
            try {
                parser.destroy();
            } catch {
                // Ignore parser cleanup failures.
            }
        };

        parser.on("pdfParser_dataReady", () => {
            try {
                resolve(parser.getRawTextContent());
            } catch (error) {
                reject(
                    error instanceof Error ? error : new Error(String(error)),
                );
            } finally {
                cleanup();
            }
        });

        parser.on("pdfParser_dataError", (error) => {
            cleanup();
            reject(error instanceof Error ? error : new Error(String(error)));
        });

        try {
            parser.parseBuffer(buffer);
        } catch (error) {
            cleanup();
            reject(error instanceof Error ? error : new Error(String(error)));
        }
    });
}

export async function POST(req: NextRequest) {
    try {
        let formData: FormData;
        try {
            formData = await req.formData();
        } catch {
            return badRequest(
                "Invalid upload payload. Send a multipart/form-data request with a 'resume' file.",
            );
        }
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
            extractedText = await extractTextFromPdf(buffer);
        } catch (error) {
            console.error("parse-resume: PDF parse failed", error);
            const message =
                error instanceof Error
                    ? error.message
                    : "Unknown PDF parse error";
            return badRequest(`Failed to parse the PDF file: ${message}`);
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

        let completion;
        try {
            const compactResumeText = extractedText
                .replace(/\s+/g, " ")
                .trim()
                .slice(0, RESUME_INPUT_CHAR_LIMIT);

            completion = await openai.chat.completions.create({
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
- "remote_preference": boolean, true if the candidate explicitly indicates remote preference or remote-only
- "about": a concise 1-3 sentence professional summary based on the resume

Resume text:
${compactResumeText}`,
                    },
                ],
                response_format: { type: "json_object" },
                temperature: 0.2,
                max_tokens: RESUME_MAX_OUTPUT_TOKENS,
            });
            console.log("parse-resume: OpenAI request completed");
        } catch (error) {
            console.error("parse-resume: OpenAI request failed", error);
            throw error;
        }

        const raw = completion.choices[0]?.message?.content ?? "{}";

        if (!raw || typeof raw !== "string" || !raw.trim()) {
            return serverError("OpenAI returned empty response.");
        }

        let parsed: {
            skills?: unknown;
            location_preference?: unknown;
            experience_level?: unknown;
            remote_preference?: unknown;
            about?: unknown;
        };
        try {
            parsed = parseModelJson(raw);
        } catch (error) {
            const errorMsg =
                error instanceof Error ? error.message : "Unknown parse error";
            return serverError(`Failed to parse OpenAI response: ${errorMsg}`);
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

        const remotePreference =
            typeof parsed.remote_preference === "boolean"
                ? parsed.remote_preference
                : /\bremote\b/i.test(locationPreference);

        const about =
            typeof parsed.about === "string" ? parsed.about.trim() : "";

        return NextResponse.json({
            skills,
            location_preference: locationPreference,
            experience_level: experienceLevel,
            remote_preference: remotePreference,
            about,
        });
    } catch (error) {
        return serverError(error);
    }
}
