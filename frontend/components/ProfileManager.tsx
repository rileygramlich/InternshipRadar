"use client";

import { useEffect, useState } from "react";

type Profile = {
    id: string;
    name: string | null;
    email: string | null;
    discord_webhook_url: string | null;
    skills: string[];
    location_preference: string | null;
    experience_level: string | null;
    remote_preference: boolean | null;
    about: string | null;
    profile_photo_url: string | null;
    created_at: string;
};

function profileToEdits(data: Profile): EditableFields {
    return {
        name: data.name ?? "",
        email: data.email ?? "",
        discord_webhook_url: data.discord_webhook_url ?? "",
        skills: (data.skills || []).join(", "),
        location_preference: data.location_preference ?? "",
        experience_level: data.experience_level ?? "",
        remote_preference: Boolean(data.remote_preference),
        about: data.about ?? "",
        profile_photo_url: data.profile_photo_url ?? "",
    };
}

type EditableFields = {
    name: string;
    email: string;
    discord_webhook_url: string;
    skills: string;
    location_preference: string;
    experience_level: string;
    remote_preference: boolean;
    about: string;
    profile_photo_url: string;
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

function arraysEqual(a: string[], b: string[]) {
    return (
        a.length === b.length && a.every((value, index) => value === b[index])
    );
}

function buildUpdatePayload(edits: EditableFields, base: EditableFields) {
    const payload: Record<string, unknown> = {};

    if (edits.name.trim() !== base.name.trim()) {
        payload.name = edits.name;
    }

    if (edits.discord_webhook_url !== base.discord_webhook_url) {
        payload.discord_webhook_url = edits.discord_webhook_url;
    }

    const nextSkills = edits.skills
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    const baseSkills = base.skills
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    if (!arraysEqual(nextSkills, baseSkills)) {
        payload.skills = nextSkills;
    }

    if (edits.location_preference !== base.location_preference) {
        payload.location_preference = edits.location_preference;
    }

    if (edits.experience_level !== base.experience_level) {
        payload.experience_level = edits.experience_level;
    }

    if (edits.remote_preference !== base.remote_preference) {
        payload.remote_preference = edits.remote_preference;
    }

    if (edits.about !== base.about) {
        payload.about = edits.about;
    }

    if (edits.profile_photo_url !== base.profile_photo_url) {
        payload.profile_photo_url = edits.profile_photo_url;
    }

    return payload;
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
            setEdits(profileToEdits(data));
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

        if (!profile || !edits) return;

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
                remote_preference?: boolean;
                about?: string;
            } | null;
            if (!res.ok)
                throw new Error(json?.error || "Failed to parse resume");

            // Create updated edits with parsed data
            const updatedEdits: EditableFields = {
                ...edits,
                skills: Array.isArray(json?.skills)
                    ? json.skills.join(", ")
                    : edits.skills,
                location_preference:
                    json?.location_preference || edits.location_preference,
                experience_level:
                    json?.experience_level || edits.experience_level,
                remote_preference:
                    typeof json?.remote_preference === "boolean"
                        ? json.remote_preference
                        : edits.remote_preference,
                about:
                    typeof json?.about === "string" ? json.about : edits.about,
            };

            setEdits(updatedEdits);

            // Auto-save the parsed data
            const base = profileToEdits(profile);
            const payload = buildUpdatePayload(updatedEdits, base);

            if (Object.keys(payload).length > 0) {
                setError(null);
                const saveRes = await fetch("/api/profiles/me", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });
                const saveJson = (await parseApiResponse(saveRes)) as {
                    error?: string;
                    data?: Profile;
                } | null;
                if (!saveRes.ok)
                    throw new Error(
                        saveJson?.error || "Failed to save parsed resume data",
                    );

                if (saveJson?.data) {
                    setProfile(saveJson.data);
                    setEdits(profileToEdits(saveJson.data));
                }
                setSuccess("Resume data added and profile updated.");
            }
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
        if (!update || !profile) return;

        const base = profileToEdits(profile);
        const payload = buildUpdatePayload(update, base);

        if (Object.keys(payload).length === 0) {
            setSuccess("No changes to save.");
            setError(null);
            return;
        }

        if (typeof payload.name === "string" && !payload.name.trim()) {
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
                body: JSON.stringify(payload),
            });
            const json = (await parseApiResponse(res)) as {
                error?: string;
                data?: Profile;
            } | null;
            if (!res.ok)
                throw new Error(json?.error || "Failed to update profile");

            if (json?.data) {
                setProfile(json.data);
                setEdits(profileToEdits(json.data));
            }
            setSuccess("Profile settings updated.");
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
            <div className="rounded-2xl bg-white p-6 shadow-md3-1 dark:bg-[#0f1115]">
                <h2 className="text-xl font-semibold text-md-on-surface dark:text-white mb-3">
                    Import from Resume
                </h2>
                <p className="text-sm text-md-subtitle dark:text-gray-400 mb-3">
                    Upload your PDF resume to automatically fill in your skills,
                    location preference, and experience level.
                </p>
                {resumeError && (
                    <p className="text-sm text-red-600 dark:text-red-400 mb-3">
                        {resumeError}
                    </p>
                )}
                <label className="flex items-center gap-3 cursor-pointer">
                    <span className="btn-ripple px-5 py-2 rounded-2xl bg-primary text-white text-sm font-medium hover:bg-primary-dark disabled:opacity-60 transition-colors">
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
                        <span className="text-sm text-md-subtitle dark:text-gray-400">
                            Extracting data from your resume…
                        </span>
                    )}
                </label>
            </div>
            <div className="rounded-2xl bg-white p-6 shadow-md3-1 dark:bg-[#0f1115]">
                <h2 className="text-xl font-semibold text-md-on-surface dark:text-white mb-4">
                    Profile Settings
                </h2>
                {error && (
                    <p className="text-sm text-red-600 dark:text-red-400 mb-3">
                        {error}
                    </p>
                )}
                {success && (
                    <p className="text-sm text-emerald-600 dark:text-emerald-400 mb-3">
                        {success}
                    </p>
                )}
                {!profile || !edits ? (
                    <p className="text-md-subtitle dark:text-gray-400">
                        No profile found yet. Sign up first to create your
                        account profile.
                    </p>
                ) : (
                    <div className="p-4 rounded-2xl bg-md-surface dark:bg-[#171a20]">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-md-subtitle dark:text-gray-400">
                                    Created:{" "}
                                    {new Date(
                                        profile.created_at,
                                    ).toLocaleString()}
                                </p>
                                <p className="text-sm text-md-on-surface dark:text-gray-300 font-medium">
                                    {(edits.name || "").trim() || "Unnamed"}
                                </p>
                                <p className="text-sm text-md-subtitle dark:text-gray-400">
                                    {edits.email || "No email"}
                                </p>
                            </div>
                            <div />
                        </div>
                        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-md-on-surface dark:text-gray-300">
                                    Name
                                </label>
                                <input
                                    className="mt-1 w-full rounded-2xl border border-gray-200 dark:border-[#2b313c] dark:bg-[#171a20] dark:text-gray-100 shadow-sm text-sm px-3 py-2"
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
                                <label className="block text-sm font-medium text-md-on-surface dark:text-gray-300">
                                    Email
                                </label>
                                <input
                                    className="mt-1 w-full rounded-2xl border border-gray-200 dark:border-[#2b313c] bg-gray-100 dark:bg-[#1e232c] shadow-sm text-sm px-3 py-2 text-md-subtitle dark:text-gray-300"
                                    type="email"
                                    value={edits.email}
                                    readOnly
                                />
                                <p className="mt-1 text-xs text-md-subtitle dark:text-gray-400">
                                    Email is managed by your account login.
                                </p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-md-on-surface dark:text-gray-300">
                                    Webhook URL
                                </label>
                                <input
                                    className="mt-1 w-full rounded-2xl border border-gray-200 dark:border-[#2b313c] dark:bg-[#171a20] dark:text-gray-100 shadow-sm text-sm px-3 py-2"
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
                                <label className="block text-sm font-medium text-md-on-surface dark:text-gray-300">
                                    Skills
                                </label>
                                <input
                                    className="mt-1 w-full rounded-2xl border border-gray-200 dark:border-[#2b313c] dark:bg-[#171a20] dark:text-gray-100 shadow-sm text-sm px-3 py-2"
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
                                <label className="block text-sm font-medium text-md-on-surface dark:text-gray-300">
                                    Location
                                </label>
                                <input
                                    className="mt-1 w-full rounded-2xl border border-gray-200 dark:border-[#2b313c] dark:bg-[#171a20] dark:text-gray-100 shadow-sm text-sm px-3 py-2"
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
                                <label className="block text-sm font-medium text-md-on-surface dark:text-gray-300">
                                    Experience Level
                                </label>
                                <input
                                    className="mt-1 w-full rounded-2xl border border-gray-200 dark:border-[#2b313c] dark:bg-[#171a20] dark:text-gray-100 shadow-sm text-sm px-3 py-2"
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
                            <div className="flex items-end">
                                <label className="inline-flex items-center gap-2 text-sm font-medium text-md-on-surface dark:text-gray-300">
                                    <input
                                        type="checkbox"
                                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                        checked={edits.remote_preference}
                                        onChange={(e) =>
                                            setEdits((prev) =>
                                                prev
                                                    ? {
                                                          ...prev,
                                                          remote_preference:
                                                              e.target.checked,
                                                      }
                                                    : prev,
                                            )
                                        }
                                    />
                                    Remote?
                                </label>
                            </div>
                            <div className="md:col-span-2 lg:col-span-3">
                                <label className="block text-sm font-medium text-md-on-surface dark:text-gray-300">
                                    About
                                </label>
                                <textarea
                                    className="mt-1 w-full rounded-2xl border border-gray-200 dark:border-[#2b313c] dark:bg-[#171a20] dark:text-gray-100 shadow-sm text-sm px-3 py-2"
                                    rows={4}
                                    value={edits.about}
                                    onChange={(e) =>
                                        setEdits((prev) =>
                                            prev
                                                ? {
                                                      ...prev,
                                                      about: e.target.value,
                                                  }
                                                : prev,
                                        )
                                    }
                                    placeholder="Short professional summary"
                                />
                            </div>
                        </div>
                        <div className="mt-3 flex justify-end">
                            <button
                                onClick={handleUpdate}
                                className="btn-ripple px-5 py-2 rounded-2xl bg-primary text-white text-sm font-medium hover:bg-primary-dark disabled:opacity-60 transition-colors"
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
