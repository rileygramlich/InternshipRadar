"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";

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

export default function JobManager() {
    const [jobs, setJobs] = useState<JobPosting[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [company, setCompany] = useState("");
    const [title, setTitle] = useState("");
    const [url, setUrl] = useState("");
    const [description, setDescription] = useState("");

    const [edits, setEdits] = useState<Record<string, EditableJob>>({});

    useEffect(() => {
        refresh();
    }, []);

    async function refresh() {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch("/api/job-postings");
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || "Failed to load jobs");
            const jobsArray: JobPosting[] = Array.isArray(json.data)
                ? json.data
                : [];
            setJobs(jobsArray);
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
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "Failed to load jobs",
            );
        } finally {
            setLoading(false);
        }
    }

    async function handleCreate(e: FormEvent) {
        e.preventDefault();
        setError(null);
        try {
            const res = await fetch("/api/job-postings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ company, title, url, description }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || "Failed to create job");
            setCompany("");
            setTitle("");
            setUrl("");
            setDescription("");
            await refresh();
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "Failed to create job",
            );
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

    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                    Create Job Posting
                </h2>
                <form onSubmit={handleCreate} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">
                                Company
                            </label>
                            <input
                                className="mt-1 w-full rounded border-gray-300 shadow-sm"
                                value={company}
                                onChange={(e) => setCompany(e.target.value)}
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">
                                Title
                            </label>
                            <input
                                className="mt-1 w-full rounded border-gray-300 shadow-sm"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                required
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">
                            URL
                        </label>
                        <input
                            className="mt-1 w-full rounded border-gray-300 shadow-sm"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            placeholder="https://company.com/job/123"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">
                            Description
                        </label>
                        <textarea
                            className="mt-1 w-full rounded border-gray-300 shadow-sm"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={3}
                        />
                    </div>
                    <button
                        type="submit"
                        className="px-4 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700"
                    >
                        Create Job
                    </button>
                </form>
            </div>

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
