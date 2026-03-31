"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

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

export default function JobManager() {
    const router = useRouter();
    const supabase = useMemo(() => createClient(), []);

    const [jobs, setJobs] = useState<JobPosting[]>([]);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [profileId, setProfileId] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [actionMessage, setActionMessage] = useState<string | null>(null);

    const [quickApplyStatus, setQuickApplyStatus] =
        useState<ApplicationStatus>("saved");
    const [addingForJobId, setAddingForJobId] = useState<string | null>(null);
    const [savedJobIds, setSavedJobIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        refresh();
    }, []);

    async function refresh() {
        setLoading(true);
        setError(null);
        setActionMessage(null);

        try {
            const jobsRes = await fetch("/api/job-postings", {
                cache: "no-store",
            });
            const jobsJson = await jobsRes.json();

            if (!jobsRes.ok) {
                throw new Error(jobsJson.error || "Failed to load jobs");
            }

            const jobsArray: JobPosting[] = Array.isArray(jobsJson.data)
                ? jobsJson.data
                : [];

            const {
                data: { session },
            } = await supabase.auth.getSession();

            const loggedIn = Boolean(session);
            setIsAuthenticated(loggedIn);

            if (!loggedIn) {
                setProfileId("");
                setJobs(jobsArray);
                setSavedJobIds(new Set());
                return;
            }

            const profileRes = await fetch("/api/profiles/me", {
                cache: "no-store",
            });
            const profileJson = await profileRes.json().catch(() => ({}));

            let pId = "";
            if (profileRes.ok) {
                pId = profileJson.data?.id ?? "";
                setProfileId(pId);
            } else {
                setProfileId("");
            }

            // Fetch user's applications to filter out saved jobs
            if (pId) {
                const applicationsRes = await fetch("/api/applications", {
                    cache: "no-store",
                });
                const applicationsJson = await applicationsRes.json();
                if (applicationsRes.ok) {
                    const applications = Array.isArray(applicationsJson.data)
                        ? applicationsJson.data
                        : [];
                    const jobIds = new Set(
                        applications.map(
                            (app: { job_id: string }) => app.job_id,
                        ),
                    );
                    setSavedJobIds(jobIds);
                }
            }

            setJobs(jobsArray);
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "Failed to load jobs",
            );
        } finally {
            setLoading(false);
        }
    }

    async function handleAddToApplications(job: JobPosting) {
        setError(null);
        setActionMessage(null);

        if (!isAuthenticated) {
            router.push("/login?mode=signup&redirect=/radar");
            return;
        }

        if (!profileId) {
            setError("Complete your profile settings before saving jobs.");
            return;
        }

        setAddingForJobId(job.id);
        try {
            const res = await fetch("/api/applications", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    profileId,
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

                {!isAuthenticated && (
                    <p className="text-sm text-gray-600 mb-3">
                        You can browse all jobs. Saving an application will
                        redirect you to sign up.
                    </p>
                )}

                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700">
                        Default Application Status
                    </label>
                    <select
                        className="mt-1 w-full md:w-72 rounded border-gray-300 shadow-sm text-sm"
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

                {jobs.length === 0 ? (
                    <p className="text-gray-500">No job postings yet.</p>
                ) : (
                    <div className="space-y-4">
                        {jobs
                            .filter((job) => !savedJobIds.has(job.id))
                            .map((job) => (
                                <div
                                    key={job.id}
                                    className="p-4 border border-gray-200 rounded-md"
                                >
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-base text-gray-900 font-semibold">
                                                {job.company}
                                            </p>
                                            <p className="text-sm text-gray-700">
                                                {job.title}
                                            </p>
                                            <p className="text-sm text-gray-500">
                                                Created:{" "}
                                                {new Date(
                                                    job.created_at,
                                                ).toLocaleString()}
                                            </p>
                                        </div>
                                        {job.url && (
                                            <a
                                                href={job.url}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="text-sm text-indigo-600 hover:text-indigo-700"
                                            >
                                                View Job
                                            </a>
                                        )}
                                    </div>
                                    {job.description && (
                                        <p className="mt-3 text-sm text-gray-700 whitespace-pre-line">
                                            {job.description}
                                        </p>
                                    )}
                                    <div className="mt-3 flex justify-end">
                                        <button
                                            onClick={() =>
                                                handleAddToApplications(job)
                                            }
                                            className="mr-2 px-3 py-1.5 rounded bg-emerald-600 text-white text-sm hover:bg-emerald-700 disabled:opacity-50"
                                            disabled={addingForJobId === job.id}
                                        >
                                            {addingForJobId === job.id
                                                ? "Adding..."
                                                : "Save Application"}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        {jobs.filter((job) => !savedJobIds.has(job.id))
                            .length === 0 && (
                            <p className="text-gray-500">
                                You have already saved all available job
                                postings.
                            </p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
