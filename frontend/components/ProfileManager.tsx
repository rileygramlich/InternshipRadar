"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";

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
};

export default function ProfileManager() {
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [loading, setLoading] = useState(false);
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [newName, setNewName] = useState("");
    const [newEmail, setNewEmail] = useState("");
    const [newWebhook, setNewWebhook] = useState("");
    const [newSkills, setNewSkills] = useState("");
    const [newLocation, setNewLocation] = useState("");

    const [edits, setEdits] = useState<Record<string, EditableFields>>({});

    const skillsArray = useMemo(
        () =>
            newSkills
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
        [newSkills],
    );

    useEffect(() => {
        refresh();
    }, []);

    async function refresh() {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch("/api/profiles");
            const json = await res.json();
            if (!res.ok)
                throw new Error(json.error || "Failed to load profiles");
            const data: Profile[] = json.data ?? [];
            setProfiles(data);
            setEdits(
                data.reduce(
                    (acc, profile) => {
                        acc[profile.id] = {
                            name: profile.name ?? "",
                            email: profile.email ?? "",
                            discord_webhook_url:
                                profile.discord_webhook_url ?? "",
                            skills: (profile.skills || []).join(", "),
                            location_preference:
                                profile.location_preference ?? "",
                        };
                        return acc;
                    },
                    {} as Record<string, EditableFields>,
                ),
            );
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "Failed to load profiles",
            );
        } finally {
            setLoading(false);
        }
    }

    async function handleCreate(e: FormEvent) {
        e.preventDefault();
        setCreating(true);
        setError(null);
        try {
            const res = await fetch("/api/profiles", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: newName,
                    email: newEmail,
                    discord_webhook_url: newWebhook,
                    skills: skillsArray,
                    location_preference: newLocation,
                }),
            });
            const json = await res.json();
            if (!res.ok)
                throw new Error(json.error || "Failed to create profile");
            setNewName("");
            setNewEmail("");
            setNewWebhook("");
            setNewSkills("");
            setNewLocation("");
            await refresh();
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "Failed to create profile",
            );
        } finally {
            setCreating(false);
        }
    }

    async function handleUpdate(id: string) {
        const update = edits[id];
        if (!update) return;
        setError(null);
        try {
            const res = await fetch(`/api/profiles/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: update.name,
                    email: update.email,
                    discord_webhook_url: update.discord_webhook_url,
                    skills: update.skills
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    location_preference: update.location_preference,
                }),
            });
            const json = await res.json();
            if (!res.ok)
                throw new Error(json.error || "Failed to update profile");
            await refresh();
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "Failed to update profile",
            );
        }
    }

    async function handleDelete(id: string) {
        setError(null);
        try {
            const res = await fetch(`/api/profiles/${id}`, {
                method: "DELETE",
            });
            if (!res.ok) {
                const json = await res.json();
                throw new Error(json.error || "Failed to delete profile");
            }
            await refresh();
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "Failed to delete profile",
            );
        }
    }

    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                    Create Profile
                </h2>
                <form onSubmit={handleCreate} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">
                                Name
                            </label>
                            <input
                                className="mt-1 w-full rounded border-gray-300 shadow-sm"
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                placeholder="Ada Lovelace"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">
                                Email
                            </label>
                            <input
                                className="mt-1 w-full rounded border-gray-300 shadow-sm"
                                type="email"
                                value={newEmail}
                                onChange={(e) => setNewEmail(e.target.value)}
                                placeholder="ada@example.com"
                                required
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">
                            Discord Webhook URL
                        </label>
                        <input
                            className="mt-1 w-full rounded border-gray-300 shadow-sm"
                            value={newWebhook}
                            onChange={(e) => setNewWebhook(e.target.value)}
                            placeholder="https://discord.com/api/webhooks/..."
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">
                            Skills (comma separated)
                        </label>
                        <input
                            className="mt-1 w-full rounded border-gray-300 shadow-sm"
                            value={newSkills}
                            onChange={(e) => setNewSkills(e.target.value)}
                            placeholder="React, TypeScript, SQL"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">
                            Location Preference
                        </label>
                        <input
                            className="mt-1 w-full rounded border-gray-300 shadow-sm"
                            value={newLocation}
                            onChange={(e) => setNewLocation(e.target.value)}
                            placeholder="Calgary, AB"
                        />
                    </div>
                    <button
                        type="submit"
                        className="px-4 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60"
                        disabled={creating}
                    >
                        {creating ? "Creating..." : "Create Profile"}
                    </button>
                </form>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold text-gray-900">
                        Profiles
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
                {profiles.length === 0 ? (
                    <p className="text-gray-500">No profiles yet.</p>
                ) : (
                    <div className="space-y-4">
                        {profiles.map((profile) => (
                            <div
                                key={profile.id}
                                className="p-4 border border-gray-200 rounded-md"
                            >
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-gray-500">
                                            ID: {profile.id}
                                        </p>
                                        <p className="text-sm text-gray-500">
                                            Created:{" "}
                                            {new Date(
                                                profile.created_at,
                                            ).toLocaleString()}
                                        </p>
                                        <p className="text-sm text-gray-700 font-medium">
                                            {(edits[profile.id]?.name || "").trim() || "Unnamed"}
                                        </p>
                                        <p className="text-sm text-gray-500">
                                            {edits[profile.id]?.email || "No email"}
                                        </p>
                                    </div>
                                    <div className="space-x-2">
                                        <button
                                            onClick={() =>
                                                handleDelete(profile.id)
                                            }
                                            className="text-sm text-red-600 hover:text-red-700"
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </div>
                                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">
                                            Name
                                        </label>
                                        <input
                                            className="mt-1 w-full rounded border-gray-300 shadow-sm text-sm"
                                            value={
                                                edits[profile.id]?.name ?? ""
                                            }
                                            onChange={(e) =>
                                                setEdits((prev) => ({
                                                    ...prev,
                                                    [profile.id]: {
                                                        ...(prev[
                                                            profile.id
                                                        ] || {
                                                            name: "",
                                                            email: "",
                                                            discord_webhook_url:
                                                                "",
                                                            skills: "",
                                                            location_preference:
                                                                "",
                                                        }),
                                                        name: e.target.value,
                                                    },
                                                }))
                                            }
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">
                                            Email
                                        </label>
                                        <input
                                            className="mt-1 w-full rounded border-gray-300 shadow-sm text-sm"
                                            type="email"
                                            value={
                                                edits[profile.id]?.email ??
                                                ""
                                            }
                                            onChange={(e) =>
                                                setEdits((prev) => ({
                                                    ...prev,
                                                    [profile.id]: {
                                                        ...(prev[
                                                            profile.id
                                                        ] || {
                                                            name: "",
                                                            email: "",
                                                            discord_webhook_url:
                                                                "",
                                                            skills: "",
                                                            location_preference:
                                                                "",
                                                        }),
                                                        email: e.target.value,
                                                    },
                                                }))
                                            }
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">
                                            Webhook URL
                                        </label>
                                        <input
                                            className="mt-1 w-full rounded border-gray-300 shadow-sm text-sm"
                                            value={
                                                edits[profile.id]
                                                    ?.discord_webhook_url ?? ""
                                            }
                                            onChange={(e) =>
                                                setEdits((prev) => ({
                                                    ...prev,
                                                    [profile.id]: {
                                                        ...(prev[
                                                            profile.id
                                                        ] || {
                                                            name: "",
                                                            email: "",
                                                            discord_webhook_url:
                                                                "",
                                                            skills: "",
                                                            location_preference:
                                                                "",
                                                        }),
                                                        discord_webhook_url:
                                                            e.target.value,
                                                    },
                                                }))
                                            }
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">
                                            Skills
                                        </label>
                                        <input
                                            className="mt-1 w-full rounded border-gray-300 shadow-sm text-sm"
                                            value={
                                                edits[profile.id]?.skills ?? ""
                                            }
                                            onChange={(e) =>
                                                setEdits((prev) => ({
                                                    ...prev,
                                                    [profile.id]: {
                                                        ...(prev[
                                                            profile.id
                                                        ] || {
                                                            name: "",
                                                            email: "",
                                                            discord_webhook_url:
                                                                "",
                                                            skills: "",
                                                            location_preference:
                                                                "",
                                                        }),
                                                        skills: e.target.value,
                                                    },
                                                }))
                                            }
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">
                                            Location
                                        </label>
                                        <input
                                            className="mt-1 w-full rounded border-gray-300 shadow-sm text-sm"
                                            value={
                                                edits[profile.id]
                                                    ?.location_preference ?? ""
                                            }
                                            onChange={(e) =>
                                                setEdits((prev) => ({
                                                    ...prev,
                                                    [profile.id]: {
                                                        ...(prev[
                                                            profile.id
                                                        ] || {
                                                            name: "",
                                                            email: "",
                                                            discord_webhook_url:
                                                                "",
                                                            skills: "",
                                                            location_preference:
                                                                "",
                                                        }),
                                                        location_preference:
                                                            e.target.value,
                                                    },
                                                }))
                                            }
                                        />
                                    </div>
                                </div>
                                <div className="mt-3 flex justify-end">
                                    <button
                                        onClick={() => handleUpdate(profile.id)}
                                        className="px-3 py-1.5 rounded bg-indigo-600 text-white text-sm hover:bg-indigo-700"
                                    >
                                        Save Changes
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
