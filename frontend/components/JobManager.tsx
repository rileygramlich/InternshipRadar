"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

type PendingApplicationSave = {
    jobId: string;
    status: ApplicationStatus;
};

const pendingApplicationSaveKey = "internshipRadar.pendingApplicationSave";

function readPendingApplicationSave() {
    if (typeof window === "undefined") {
        return null;
    }

    const rawValue = window.sessionStorage.getItem(pendingApplicationSaveKey);

    if (!rawValue) {
        return null;
    }

    try {
        const parsed = JSON.parse(rawValue) as Partial<PendingApplicationSave>;
        if (
            typeof parsed.jobId === "string" &&
            typeof parsed.status === "string"
        ) {
            return {
                jobId: parsed.jobId,
                status: parsed.status as ApplicationStatus,
            };
        }
    } catch {
        window.sessionStorage.removeItem(pendingApplicationSaveKey);
    }

    return null;
}

function writePendingApplicationSave(value: PendingApplicationSave) {
    if (typeof window === "undefined") {
        return;
    }

    window.sessionStorage.setItem(
        pendingApplicationSaveKey,
        JSON.stringify(value),
    );
}

function clearPendingApplicationSave() {
    if (typeof window === "undefined") {
        return;
    }

    window.sessionStorage.removeItem(pendingApplicationSaveKey);
}

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
    const [pendingSave, setPendingSave] =
        useState<PendingApplicationSave | null>(null);
    const autoSaveAttemptedRef = useRef(false);

    useEffect(() => {
        refresh();
    }, []);

    useEffect(() => {
        setPendingSave(readPendingApplicationSave());
    }, []);

    useEffect(() => {
        if (
            !isAuthenticated ||
            !profileId ||
            !pendingSave ||
            autoSaveAttemptedRef.current
        ) {
            return;
        }

        const job = jobs.find(
            (candidate) => candidate.id === pendingSave.jobId,
        );
        if (!job) {
            return;
        }

        autoSaveAttemptedRef.current = true;

        void (async () => {
            const saved = await saveApplication(job, pendingSave.status);
            if (saved) {
                clearPendingApplicationSave();
                setPendingSave(null);
            } else {
                autoSaveAttemptedRef.current = false;
            }
        })();
    }, [isAuthenticated, jobs, pendingSave, profileId]);

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

    async function saveApplication(job: JobPosting, status: ApplicationStatus) {
        setError(null);
        setActionMessage(null);

        setAddingForJobId(job.id);
        try {
            const res = await fetch("/api/applications", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    profileId,
                    jobId: job.id,
                    status,
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
            return true;
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Failed to add job to applications",
            );
            return false;
        } finally {
            setAddingForJobId(null);
        }
    }

    async function handleAddToApplications(job: JobPosting) {
        if (!isAuthenticated) {
            writePendingApplicationSave({
                jobId: job.id,
                status: quickApplyStatus,
            });
            router.push("/login?redirect=/radar");
            return;
        }

        if (!profileId) {
            setError("Complete your profile settings before saving jobs.");
            return;
        }

        await saveApplication(job, quickApplyStatus);
    }

    return (
        <div className="space-y-4 md:space-y-6">
            <div className="rounded-2xl border border-gray-200 bg-white p-4 md:p-6 dark:border-[#2d4068] dark:bg-[#0d1730]">
                <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <h2 className="text-xl font-semibold text-md-on-surface dark:text-white md:text-2xl lg:text-3xl">
                        Jobs
                    </h2>
                    <button
                        onClick={refresh}
                        className="btn-ripple min-h-[44px] self-start rounded-2xl px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary-light dark:text-blue-400 dark:hover:bg-blue-900/30 md:self-auto"
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
                    <p className="text-sm text-md-subtitle dark:text-gray-400 mb-3">
                        You can browse all jobs. Saving an application will
                        redirect you to log in, then resume the save.
                    </p>
                )}

                <div className="mb-4">
                    <label className="block text-sm font-medium text-md-on-surface dark:text-gray-300">
                        Default Application Status
                    </label>
                    <select
                        className="mt-1 min-h-[44px] w-full rounded-2xl border border-gray-200 px-3 text-sm shadow-sm dark:border-[#2d4068] dark:bg-[#132244] dark:text-gray-100 md:w-72"
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
                    <p className="text-md-subtitle dark:text-gray-400">
                        No job postings yet.
                    </p>
                ) : (
                    <div className="space-y-4">
                        {jobs
                            .filter((job) => !savedJobIds.has(job.id))
                            .map((job) => (
                                <div
                                    key={job.id}
                                    className="rounded-2xl border border-primary/20 bg-white p-4 transition-colors hover:border-primary/40 hover:bg-gray-50 dark:border-blue-400/30 dark:bg-[#132244] dark:hover:border-blue-300/50 dark:hover:bg-[#172849]"
                                >
                                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                        <div className="min-w-0">
                                            <p className="truncate text-base font-semibold text-md-on-surface dark:text-white md:text-lg">
                                                {job.company}
                                            </p>
                                            <p className="line-clamp-2 text-sm text-md-subtitle dark:text-gray-300 md:text-base">
                                                {job.title}
                                            </p>
                                            <p className="text-xs text-md-subtitle dark:text-gray-400 md:text-sm">
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
                                                className="btn-ripple inline-flex min-h-[44px] items-center rounded-2xl px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary-light dark:text-blue-400 dark:hover:bg-blue-900/30"
                                            >
                                                View Job
                                            </a>
                                        )}
                                    </div>
                                    {job.description && (
                                        <p className="mt-3 line-clamp-3 whitespace-pre-line text-sm text-md-subtitle dark:text-gray-300">
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
                                            className="btn-ripple min-h-[44px] rounded-2xl bg-primary px-5 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
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
                            <p className="text-md-subtitle dark:text-gray-400">
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
