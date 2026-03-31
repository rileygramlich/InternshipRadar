"use client";

import { useEffect, useState } from "react";

type ApplicationStatus =
    | "saved"
    | "applied"
    | "interview"
    | "rejected"
    | "offer";

type JobPosting = {
    id: string;
    company: string;
    title: string;
    url: string | null;
    description: string | null;
    created_at: string;
};

type EditableJob = {
    company: string;
    title: string;
    url: string;
    description: string;
};

type Profile = {
    id: string;
    name: string | null;
    email: string | null;
};

export default function JobManager() {
    const [jobs, setJobs] = useState<JobPosting[]>([]);
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [actionMessage, setActionMessage] = useState<string | null>(null);

    const [edits, setEdits] = useState<Record<string, EditableJob>>({});
    const [selectedProfileId, setSelectedProfileId] = useState("");
    const [quickApplyStatus, setQuickApplyStatus] =
        useState<ApplicationStatus>("saved");
    const [addingForJobId, setAddingForJobId] = useState<string | null>(null);

    useEffect(() => {
        refresh();
    }, []);

    async function refresh() {
        setLoading(true);
        setError(null);
        setActionMessage(null);
        try {
            const [jobsRes, profilesRes] = await Promise.all([
                fetch("/api/job-postings"),
                fetch("/api/profiles"),
            ]);

            const jobsJson = await jobsRes.json();
            const profilesJson = await profilesRes.json();

            if (!jobsRes.ok) {
                throw new Error(jobsJson.error || "Failed to load jobs");
            }

            if (!profilesRes.ok) {
                throw new Error(
                    profilesJson.error || "Failed to load profiles",
                );
            }

            const jobsArray: JobPosting[] = Array.isArray(jobsJson.data)
                ? jobsJson.data
                : [];
            const profilesArray: Profile[] = Array.isArray(profilesJson.data)
                ? profilesJson.data
                : [];

            setJobs(jobsArray);
            setProfiles(profilesArray);
            setEdits(
                jobsArray.reduce(
                    (acc, job) => {
                        acc[job.id] = {
                            company: job.company,
                            title: job.title,
                            url: job.url ?? "",
                            description: job.description ?? "",
                        };
                        return acc;
                    },
                    {} as Record<string, EditableJob>,
                ),
            );

            setSelectedProfileId((current) => {
                if (
                    current &&
                    profilesArray.some((profile) => profile.id === current)
                ) {
                    return current;
                }

                return profilesArray[0]?.id ?? "";
            });
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "Failed to load jobs",
            );
        } finally {
            setLoading(false);
        }
    }

    async function handleUpdate(id: string) {
        const update = edits[id];
        if (!update) return;
        setError(null);
        try {
            const res = await fetch(`/api/job-postings/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(update),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || "Failed to update job");
            await refresh();
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "Failed to update job",
            );
        }
    }

    async function handleDelete(id: string) {
        setError(null);
        setActionMessage(null);
        try {
            const res = await fetch(`/api/job-postings/${id}`, {
                method: "DELETE",
            });
            if (!res.ok) {
                const json = await res.json();
                throw new Error(json.error || "Failed to delete job");
            }
            await refresh();
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "Failed to delete job",
            );
        }
    }

    async function handleAddToApplications(job: JobPosting) {
        setError(null);
        setActionMessage(null);

        if (!selectedProfileId) {
            setError("Select a profile before adding a job to applications.");
            return;
        }

        setAddingForJobId(job.id);
        try {
            const res = await fetch("/api/applications", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    profileId: selectedProfileId,
                    jobId: job.id,
                    status: quickApplyStatus,
                    matchScore: 0,
                }),
            });

            const json = await res.json();
            if (!res.ok) {
                throw new Error(
                    json.error || "Failed to add job to applications",
                );
            }

            setActionMessage(
                `Added ${job.company} - ${job.title} to Applications.`,
            );
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Failed to add job to applications",
            );
        } finally {
            setAddingForJobId(null);
        }
    }

    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold text-gray-900">
                        Jobs
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
                {actionMessage && (
                    <p className="text-sm text-emerald-600 mb-3">
                        {actionMessage}
                    </p>
                )}

                <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">
                            Add To Applications: Profile
                        </label>
                        <select
                            className="mt-1 w-full rounded border-gray-300 shadow-sm text-sm"
                            value={selectedProfileId}
                            onChange={(e) =>
                                setSelectedProfileId(e.target.value)
                            }
                            disabled={profiles.length === 0}
                        >
                            {profiles.length === 0 ? (
                                <option value="">No profiles available</option>
                            ) : (
                                profiles.map((profile) => (
                                    <option key={profile.id} value={profile.id}>
                                        {(profile.name || "Unnamed profile") +
                                            (profile.email
                                                ? ` (${profile.email})`
                                                : "")}
                                    </option>
                                ))
                            )}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">
                            Default Application Status
                        </label>
                        <select
                            className="mt-1 w-full rounded border-gray-300 shadow-sm text-sm"
                            value={quickApplyStatus}
                            onChange={(e) =>
                                setQuickApplyStatus(
                                    e.target.value as ApplicationStatus,
                                )
                            }
                        >
                            <option value="saved">Saved</option>
                            <option value="applied">Applied</option>
                            <option value="interview">Interview</option>
                            <option value="offer">Offer</option>
                            <option value="rejected">Rejected</option>
                        </select>
                    </div>
                </div>

                {jobs.length === 0 ? (
                    <p className="text-gray-500">No job postings yet.</p>
                ) : (
                    <div className="space-y-4">
                        {jobs.map((job) => (
                            <div
                                key={job.id}
                                className="p-4 border border-gray-200 rounded-md"
                            >
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-gray-500">
                                            ID: {job.id}
                                        </p>
                                        <p className="text-sm text-gray-500">
                                            Created:{" "}
                                            {new Date(
                                                job.created_at,
                                            ).toLocaleString()}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => handleDelete(job.id)}
                                        className="text-sm text-red-600 hover:text-red-700"
                                    >
                                        Delete
                                    </button>
                                </div>
                                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">
                                            Company
                                        </label>
                                        <input
                                            className="mt-1 w-full rounded border-gray-300 shadow-sm text-sm"
                                            value={edits[job.id]?.company ?? ""}
                                            onChange={(e) =>
                                                setEdits((prev) => ({
                                                    ...prev,
                                                    [job.id]: {
                                                        ...(prev[job.id] || {
                                                            company: "",
                                                            title: "",
                                                            url: "",
                                                            description: "",
                                                        }),
                                                        company: e.target.value,
                                                    },
                                                }))
                                            }
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">
                                            Title
                                        </label>
                                        <input
                                            className="mt-1 w-full rounded border-gray-300 shadow-sm text-sm"
                                            value={edits[job.id]?.title ?? ""}
                                            onChange={(e) =>
                                                setEdits((prev) => ({
                                                    ...prev,
                                                    [job.id]: {
                                                        ...(prev[job.id] || {
                                                            company: "",
                                                            title: "",
                                                            url: "",
                                                            description: "",
                                                        }),
                                                        title: e.target.value,
                                                    },
                                                }))
                                            }
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">
                                            URL
                                        </label>
                                        <input
                                            className="mt-1 w-full rounded border-gray-300 shadow-sm text-sm"
                                            value={edits[job.id]?.url ?? ""}
                                            onChange={(e) =>
                                                setEdits((prev) => ({
                                                    ...prev,
                                                    [job.id]: {
                                                        ...(prev[job.id] || {
                                                            company: "",
                                                            title: "",
                                                            url: "",
                                                            description: "",
                                                        }),
                                                        url: e.target.value,
                                                    },
                                                }))
                                            }
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">
                                            Description
                                        </label>
                                        <textarea
                                            className="mt-1 w-full rounded border-gray-300 shadow-sm text-sm"
                                            value={
                                                edits[job.id]?.description ?? ""
                                            }
                                            onChange={(e) =>
                                                setEdits((prev) => ({
                                                    ...prev,
                                                    [job.id]: {
                                                        ...(prev[job.id] || {
                                                            company: "",
                                                            title: "",
                                                            url: "",
                                                            description: "",
                                                        }),
                                                        description:
                                                            e.target.value,
                                                    },
                                                }))
                                            }
                                            rows={3}
                                        />
                                    </div>
                                </div>
                                <div className="mt-3 flex justify-end">
                                    <button
                                        onClick={() =>
                                            handleAddToApplications(job)
                                        }
                                        className="mr-2 px-3 py-1.5 rounded bg-emerald-600 text-white text-sm hover:bg-emerald-700 disabled:opacity-50"
                                        disabled={
                                            !selectedProfileId ||
                                            addingForJobId === job.id
                                        }
                                    >
                                        {addingForJobId === job.id
                                            ? "Adding..."
                                            : "Add To Applications"}
                                    </button>
                                    <button
                                        onClick={() => handleUpdate(job.id)}
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
