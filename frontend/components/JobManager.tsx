"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { SkillGapIndicator } from "@/components/SkillPill";

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
    tech_tags: string[] | null;
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
    const [profileSkills, setProfileSkills] = useState<string[]>([]);

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
                setProfileSkills(
                    Array.isArray(profileJson.data?.skills)
                        ? profileJson.data.skills
                        : [],
                );
            } else {
                setProfileId("");
                setProfileSkills([]);
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
                    const jobIds = new Set<string>(
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
        <div className="space-y-4 md:space-y-6">
            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900 md:p-6">
                <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white md:text-2xl lg:text-3xl">
                        Jobs
                    </h2>
                    <button
                        onClick={refresh}
                        className="min-h-[44px] self-start rounded-md px-3 py-2 text-sm font-medium text-indigo-600 transition-colors hover:bg-indigo-50 hover:text-indigo-700 dark:text-indigo-400 dark:hover:bg-indigo-900/30 dark:hover:text-indigo-300 md:self-auto"
                        disabled={loading}
                    >
                        {loading ? "Refreshing..." : "Refresh"}
                    </button>
                </div>
                {error && (
                    <p className="text-sm text-red-600 dark:text-red-400 mb-3">
                        {error}
                    </p>
                )}
                {actionMessage && (
                    <p className="text-sm text-emerald-600 dark:text-emerald-400 mb-3">
                        {actionMessage}
                    </p>
                )}

                {!isAuthenticated && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                        You can browse all jobs. Saving an application will
                        redirect you to sign up.
                    </p>
                )}

                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Default Application Status
                    </label>
                    <select
                        className="mt-1 min-h-[44px] w-full rounded border-gray-300 px-3 text-sm shadow-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 md:w-72"
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
                    <p className="text-gray-500 dark:text-gray-400">
                        No job postings yet.
                    </p>
                ) : (
                    <div className="space-y-4">
                        {jobs
                            .filter((job) => !savedJobIds.has(job.id))
                            .map((job) => (
                                <div
                                    key={job.id}
                                    className="rounded-md border border-gray-200 p-4 dark:border-gray-700"
                                >
                                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                        <div className="min-w-0">
                                            <p className="truncate text-base font-semibold text-gray-900 dark:text-white md:text-lg">
                                                {job.company}
                                            </p>
                                            <p className="line-clamp-2 text-sm text-gray-700 dark:text-gray-300 md:text-base">
                                                {job.title}
                                            </p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 md:text-sm">
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
                                                className="inline-flex min-h-[44px] items-center rounded-md px-3 py-2 text-sm font-medium text-indigo-600 transition-colors hover:bg-indigo-50 hover:text-indigo-700 dark:text-indigo-400 dark:hover:bg-indigo-900/30 dark:hover:text-indigo-300"
                                            >
                                                View Job
                                            </a>
                                        )}
                                    </div>
                                    {job.description && (
                                        <p className="mt-3 line-clamp-3 whitespace-pre-line text-sm text-gray-700 dark:text-gray-300">
                                            {job.description}
                                        </p>
                                    )}
                                    {Array.isArray(job.tech_tags) &&
                                        job.tech_tags.length > 0 && (
                                            <SkillGapIndicator
                                                techTags={job.tech_tags}
                                                profileSkills={profileSkills}
                                            />
                                        )}
                                    <div className="mt-3 flex justify-end">
                                        <button
                                            onClick={() =>
                                                handleAddToApplications(job)
                                            }
                                            className="min-h-[44px] rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
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
                            <p className="text-gray-500 dark:text-gray-400">
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
