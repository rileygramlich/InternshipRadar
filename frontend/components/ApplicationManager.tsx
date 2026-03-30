"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";

type Application = {
    id: string;
    profile_id: string;
    job_id: string;
    match_score: number;
    status: "saved" | "applied" | "interview" | "rejected" | "offer";
    created_at: string;
};

type UpdateFields = {
    status?: Application["status"];
    match_score?: number;
};

export default function ApplicationManager() {
    const [applications, setApplications] = useState<Application[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [profileId, setProfileId] = useState("");
    const [jobId, setJobId] = useState("");
    const [matchScore, setMatchScore] = useState("");
    const [status, setStatus] = useState<Application["status"]>("saved");

    const [updates, setUpdates] = useState<Record<string, UpdateFields>>({});

    useEffect(() => {
        refresh();
    }, []);

    async function refresh() {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch("/api/applications");
            const json = await res.json();
            if (!res.ok)
                throw new Error(json.error || "Failed to load applications");
            const apps: Application[] = Array.isArray(json.data)
                ? json.data
                : [];
            setApplications(apps);
            setUpdates(
                apps.reduce(
                    (acc, app) => {
                        acc[app.id] = {
                            status: app.status,
                            match_score: app.match_score,
                        };
                        return acc;
                    },
                    {} as Record<string, UpdateFields>,
                ),
            );
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Failed to load applications",
            );
        } finally {
            setLoading(false);
        }
    }

    async function handleCreate(e: FormEvent) {
        e.preventDefault();
        setError(null);
        try {
            const res = await fetch("/api/applications", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    profileId,
                    jobId,
                    matchScore: matchScore ? Number(matchScore) : undefined,
                    status,
                }),
            });
            const json = await res.json();
            if (!res.ok)
                throw new Error(json.error || "Failed to create application");
            setProfileId("");
            setJobId("");
            setMatchScore("");
            setStatus("saved");
            await refresh();
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Failed to create application",
            );
        }
    }

    async function handleUpdate(id: string) {
        const update = updates[id];
        if (!update) return;
        setError(null);
        try {
            const res = await fetch(`/api/applications/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(update),
            });
            const json = await res.json();
            if (!res.ok)
                throw new Error(json.error || "Failed to update application");
            await refresh();
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Failed to update application",
            );
        }
    }

    async function handleDelete(id: string) {
        setError(null);
        try {
            const res = await fetch(`/api/applications/${id}`, {
                method: "DELETE",
            });
            if (!res.ok) {
                const json = await res.json();
                throw new Error(json.error || "Failed to delete application");
            }
            await refresh();
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Failed to delete application",
            );
        }
    }

    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                    Create Application
                </h2>
                <form onSubmit={handleCreate} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">
                                Profile ID
                            </label>
                            <input
                                className="mt-1 w-full rounded border-gray-300 shadow-sm"
                                value={profileId}
                                onChange={(e) => setProfileId(e.target.value)}
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">
                                Job ID
                            </label>
                            <input
                                className="mt-1 w-full rounded border-gray-300 shadow-sm"
                                value={jobId}
                                onChange={(e) => setJobId(e.target.value)}
                                required
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">
                                Match Score (0-100)
                            </label>
                            <input
                                type="number"
                                min={0}
                                max={100}
                                step={0.01}
                                className="mt-1 w-full rounded border-gray-300 shadow-sm"
                                value={matchScore}
                                onChange={(e) => setMatchScore(e.target.value)}
                                placeholder="85"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">
                                Status
                            </label>
                            <select
                                className="mt-1 w-full rounded border-gray-300 shadow-sm"
                                value={status}
                                onChange={(e) =>
                                    setStatus(
                                        e.target.value as Application["status"],
                                    )
                                }
                            >
                                <option value="saved">Saved</option>
                                <option value="applied">Applied</option>
                                <option value="interview">Interview</option>
                                <option value="rejected">Rejected</option>
                                <option value="offer">Offer</option>
                            </select>
                        </div>
                    </div>
                    <button
                        type="submit"
                        className="px-4 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700"
                    >
                        Create Application
                    </button>
                </form>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold text-gray-900">
                        Applications
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
                {applications.length === 0 ? (
                    <p className="text-gray-500">No applications yet.</p>
                ) : (
                    <div className="space-y-4">
                        {applications.map((app) => (
                            <div
                                key={app.id}
                                className="p-4 border border-gray-200 rounded-md"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="space-y-1 text-sm text-gray-600">
                                        <p>ID: {app.id}</p>
                                        <p>Profile ID: {app.profile_id}</p>
                                        <p>Job ID: {app.job_id}</p>
                                        <p>
                                            Created:{" "}
                                            {new Date(
                                                app.created_at,
                                            ).toLocaleString()}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => handleDelete(app.id)}
                                        className="text-sm text-red-600 hover:text-red-700"
                                    >
                                        Delete
                                    </button>
                                </div>
                                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">
                                            Status
                                        </label>
                                        <select
                                            className="mt-1 w-full rounded border-gray-300 shadow-sm"
                                            value={
                                                updates[app.id]?.status ??
                                                app.status
                                            }
                                            onChange={(e) =>
                                                setUpdates((prev) => ({
                                                    ...prev,
                                                    [app.id]: {
                                                        ...(prev[app.id] || {}),
                                                        status: e.target
                                                            .value as Application["status"],
                                                    },
                                                }))
                                            }
                                        >
                                            <option value="saved">Saved</option>
                                            <option value="applied">
                                                Applied
                                            </option>
                                            <option value="interview">
                                                Interview
                                            </option>
                                            <option value="rejected">
                                                Rejected
                                            </option>
                                            <option value="offer">Offer</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">
                                            Match Score
                                        </label>
                                        <input
                                            type="number"
                                            min={0}
                                            max={100}
                                            step={0.01}
                                            className="mt-1 w-full rounded border-gray-300 shadow-sm"
                                            value={
                                                updates[app.id]?.match_score ??
                                                app.match_score
                                            }
                                            onChange={(e) =>
                                                setUpdates((prev) => ({
                                                    ...prev,
                                                    [app.id]: {
                                                        ...(prev[app.id] || {}),
                                                        match_score: Number(
                                                            e.target.value,
                                                        ),
                                                    },
                                                }))
                                            }
                                        />
                                    </div>
                                </div>
                                <div className="mt-3 flex justify-end">
                                    <button
                                        onClick={() => handleUpdate(app.id)}
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
