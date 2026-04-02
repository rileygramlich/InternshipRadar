"use client";

import { useEffect, useState } from "react";

type Profile = {
    id: string;
    name: string | null;
    email: string | null;
    discord_webhook_url: string | null;
    skills: string[];
    location_preference: string | null;
    created_at: string;
};

type EditableFields = {
    name: string;
    email: string;
    discord_webhook_url: string;
    skills: string;
    location_preference: string;
    experience_level: string;
};

async function parseApiResponse(res: Response) {
    const text = await res.text();

    if (!text.trim()) {
        return null;
    }

    try {
        return JSON.parse(text) as Record<string, unknown>;
    } catch {
        throw new Error(
            res.ok
                ? "Server returned invalid JSON."
                : `Request failed (${res.status}): ${text.slice(0, 240)}`,
        );
    }
}

export default function ProfileManager() {
    const [profile, setProfile] = useState<Profile | null>(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [resumeParsing, setResumeParsing] = useState(false);
    const [resumeError, setResumeError] = useState<string | null>(null);

    const [edits, setEdits] = useState<EditableFields | null>(null);

    useEffect(() => {
        refresh();
    }, []);

    async function refresh() {
        setLoading(true);
        setError(null);
        setSuccess(null);
        try {
            const res = await fetch("/api/profiles/me", { cache: "no-store" });
            const json = (await parseApiResponse(res)) as {
                error?: string;
                data?: Profile;
            } | null;
            if (!res.ok)
                throw new Error(json?.error || "Failed to load profile");
            const data = json?.data;
            if (!data) {
                throw new Error("Profile response is missing data.");
            }
            setProfile(data);
            setEdits({
                name: data.name ?? "",
                email: data.email ?? "",
                discord_webhook_url: data.discord_webhook_url ?? "",
                skills: (data.skills || []).join(", "),
                location_preference: data.location_preference ?? "",
                experience_level: "",
            });
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "Failed to load profile",
            );
            setProfile(null);
            setEdits(null);
        } finally {
            setLoading(false);
        }
    }

    async function handleResumeUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;

        setResumeParsing(true);
        setResumeError(null);
        try {
            const formData = new FormData();
            formData.append("resume", file);

            const res = await fetch("/api/parse-resume", {
                method: "POST",
                body: formData,
            });
            const json = (await parseApiResponse(res)) as {
                error?: string;
                skills?: string[];
                location_preference?: string;
                experience_level?: string;
            } | null;
            if (!res.ok)
                throw new Error(json?.error || "Failed to parse resume");

            setEdits((prev) =>
                prev
                    ? {
                          ...prev,
                          skills: Array.isArray(json.skills)
                              ? json.skills.join(", ")
                              : prev.skills,
                          location_preference:
                              json.location_preference ||
                              prev.location_preference,
                          experience_level:
                              json.experience_level || prev.experience_level,
                      }
                    : prev,
            );
        } catch (err) {
            setResumeError(
                err instanceof Error ? err.message : "Failed to parse resume",
            );
        } finally {
            setResumeParsing(false);
            e.target.value = "";
        }
    }

    async function handleUpdate() {
        const update = edits;
        if (!update) return;
        if (!update.name.trim()) {
            setError("Name is required.");
            return;
        }

        setSaving(true);
        setError(null);
        setSuccess(null);
        try {
            const res = await fetch("/api/profiles/me", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: update.name,
                    discord_webhook_url: update.discord_webhook_url,
                    skills: update.skills
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    location_preference: update.location_preference,
                }),
            });
            const json = (await parseApiResponse(res)) as {
                error?: string;
            } | null;
            if (!res.ok)
                throw new Error(json?.error || "Failed to update profile");
            setSuccess("Profile settings updated.");
            await refresh();
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "Failed to update profile",
            );
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900 mb-3">
                    Import from Resume
                </h2>
                <p className="text-sm text-gray-500 mb-3">
                    Upload your PDF resume to automatically fill in your skills,
                    location preference, and experience level.
                </p>
                {resumeError && (
                    <p className="text-sm text-red-600 mb-3">{resumeError}</p>
                )}
                <label className="flex items-center gap-3 cursor-pointer">
                    <span className="px-4 py-2 rounded bg-indigo-600 text-white text-sm hover:bg-indigo-700 disabled:opacity-60">
                        {resumeParsing ? "Parsing…" : "Upload PDF Resume"}
                    </span>
                    <input
                        type="file"
                        accept="application/pdf"
                        className="sr-only"
                        disabled={resumeParsing}
                        onChange={handleResumeUpload}
                    />
                    {resumeParsing && (
                        <span className="text-sm text-gray-500">
                            Extracting data from your resume…
                        </span>
                    )}
                </label>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold text-gray-900">
                        Profile Settings
                    </h2>
                    <button
                        onClick={refresh}
                        className="text-sm text-indigo-600 hover:text-indigo-700"
                        disabled={loading}
                    >
                        {loading ? "Refreshing..." : "Refresh"}
                    </button>
                </div>
                {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
                {success && (
                    <p className="text-sm text-emerald-600 mb-3">{success}</p>
                )}
                {!profile || !edits ? (
                    <p className="text-gray-500">
                        No profile found yet. Sign up first to create your
                        account profile.
                    </p>
                ) : (
                    <div className="p-4 border border-gray-200 rounded-md">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-500">
                                    Created:{" "}
                                    {new Date(
                                        profile.created_at,
                                    ).toLocaleString()}
                                </p>
                                <p className="text-sm text-gray-700 font-medium">
                                    {(edits.name || "").trim() || "Unnamed"}
                                </p>
                                <p className="text-sm text-gray-500">
                                    {edits.email || "No email"}
                                </p>
                            </div>
                            <div />
                        </div>
                        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">
                                    Name
                                </label>
                                <input
                                    className="mt-1 w-full rounded border-gray-300 shadow-sm text-sm"
                                    value={edits.name}
                                    onChange={(e) =>
                                        setEdits((prev) =>
                                            prev
                                                ? {
                                                      ...prev,
                                                      name: e.target.value,
                                                  }
                                                : prev,
                                        )
                                    }
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">
                                    Email
                                </label>
                                <input
                                    className="mt-1 w-full rounded border-gray-300 bg-gray-100 shadow-sm text-sm text-gray-600"
                                    type="email"
                                    value={edits.email}
                                    readOnly
                                />
                                <p className="mt-1 text-xs text-gray-500">
                                    Email is managed by your account login.
                                </p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">
                                    Webhook URL
                                </label>
                                <input
                                    className="mt-1 w-full rounded border-gray-300 shadow-sm text-sm"
                                    value={edits.discord_webhook_url}
                                    onChange={(e) =>
                                        setEdits((prev) =>
                                            prev
                                                ? {
                                                      ...prev,
                                                      discord_webhook_url:
                                                          e.target.value,
                                                  }
                                                : prev,
                                        )
                                    }
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">
                                    Skills
                                </label>
                                <input
                                    className="mt-1 w-full rounded border-gray-300 shadow-sm text-sm"
                                    value={edits.skills}
                                    onChange={(e) =>
                                        setEdits((prev) =>
                                            prev
                                                ? {
                                                      ...prev,
                                                      skills: e.target.value,
                                                  }
                                                : prev,
                                        )
                                    }
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">
                                    Location
                                </label>
                                <input
                                    className="mt-1 w-full rounded border-gray-300 shadow-sm text-sm"
                                    value={edits.location_preference}
                                    onChange={(e) =>
                                        setEdits((prev) =>
                                            prev
                                                ? {
                                                      ...prev,
                                                      location_preference:
                                                          e.target.value,
                                                  }
                                                : prev,
                                        )
                                    }
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">
                                    Experience Level
                                </label>
                                <input
                                    className="mt-1 w-full rounded border-gray-300 shadow-sm text-sm"
                                    value={edits.experience_level}
                                    onChange={(e) =>
                                        setEdits((prev) =>
                                            prev
                                                ? {
                                                      ...prev,
                                                      experience_level:
                                                          e.target.value,
                                                  }
                                                : prev,
                                        )
                                    }
                                    placeholder="e.g. Internship, Entry Level"
                                />
                            </div>
                        </div>
                        <div className="mt-3 flex justify-end">
                            <button
                                onClick={handleUpdate}
                                className="px-3 py-1.5 rounded bg-indigo-600 text-white text-sm hover:bg-indigo-700 disabled:opacity-60"
                                disabled={saving}
                            >
                                {saving ? "Saving..." : "Save Changes"}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
