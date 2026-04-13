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
    location: string | null;
    term: string | null;
    is_open: boolean | null;
    match_percentage: number | null;
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

function MatchScoreBadge({ score }: { score: number | null | undefined }) {
    if (score === null || score === undefined) return null;

    let colorClasses: string;
    if (score >= 80) {
        colorClasses =
            "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
    } else if (score >= 50) {
        colorClasses =
            "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
    } else {
        colorClasses =
            "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400";
    }

    return (
        <div className="flex flex-col items-center gap-0.5">
            <span
                className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${colorClasses}`}
            >
                {Math.round(score)}% match
            </span>
            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                <div
                    className={`h-full rounded-full transition-all ${
                        score >= 80
                            ? "bg-green-500"
                            : score >= 50
                              ? "bg-yellow-500"
                              : "bg-gray-400"
                    }`}
                    style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
                />
            </div>
        </div>
    );
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

    // Filtering & sorting state
    const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
    const [selectedTerms, setSelectedTerms] = useState<string[]>([]);
    const [showOpenOnly, setShowOpenOnly] = useState(false);
    const [sortBy, setSortBy] = useState<"newest" | "match_score">("newest");

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

    // Derive unique locations from loaded jobs
    const availableLocations = useMemo(() => {
        const locs = jobs
            .map((j) => j.location)
            .filter((l): l is string => Boolean(l));
        return Array.from(new Set(locs)).sort();
    }, [jobs]);

    const ALL_TERMS = ["Summer", "Fall", "Winter"];

    function toggleLocation(loc: string) {
        setSelectedLocations((prev) =>
            prev.includes(loc) ? prev.filter((l) => l !== loc) : [...prev, loc],
        );
    }

    function toggleTerm(term: string) {
        setSelectedTerms((prev) =>
            prev.includes(term)
                ? prev.filter((t) => t !== term)
                : [...prev, term],
        );
    }

    const unsavedJobCount = useMemo(
        () => jobs.filter((job) => !savedJobIds.has(job.id)).length,
        [jobs, savedJobIds],
    );

    const visibleJobs = useMemo(() => {
        let list = jobs.filter((job) => !savedJobIds.has(job.id));

        if (selectedLocations.length > 0) {
            list = list.filter(
                (job) => job.location && selectedLocations.includes(job.location),
            );
        }

        if (selectedTerms.length > 0) {
            list = list.filter(
                (job) => job.term && selectedTerms.includes(job.term),
            );
        }

        if (showOpenOnly) {
            list = list.filter((job) => job.is_open !== false);
        }

        if (sortBy === "match_score") {
            list = [...list].sort(
                (a, b) => (b.match_percentage ?? 0) - (a.match_percentage ?? 0),
            );
        } else {
            list = [...list].sort(
                (a, b) =>
                    new Date(b.created_at).getTime() -
                    new Date(a.created_at).getTime(),
            );
        }

        return list;
    }, [jobs, savedJobIds, selectedLocations, selectedTerms, showOpenOnly, sortBy]);

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
                        redirect you to log in, then resume the save.
                    </p>
                )}

                {/* Filter & Sort Controls */}
                <div className="mb-4 flex flex-col gap-4 rounded-lg border border-gray-100 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50">
                    <div className="flex flex-wrap items-center gap-4">
                        {/* Sort By */}
                        <div className="flex items-center gap-2">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                                Sort by:
                            </label>
                            <select
                                className="min-h-[36px] rounded border-gray-300 px-2 text-sm shadow-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
                                value={sortBy}
                                onChange={(e) =>
                                    setSortBy(
                                        e.target.value as
                                            | "newest"
                                            | "match_score",
                                    )
                                }
                            >
                                <option value="newest">Newest Postings</option>
                                <option value="match_score">
                                    Highest Match Score
                                </option>
                            </select>
                        </div>

                        {/* Open/Closed Toggle */}
                        <label className="flex cursor-pointer items-center gap-2">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                Open only
                            </span>
                            <div className="relative">
                                <input
                                    type="checkbox"
                                    className="sr-only"
                                    checked={showOpenOnly}
                                    onChange={(e) =>
                                        setShowOpenOnly(e.target.checked)
                                    }
                                />
                                <div
                                    className={`h-5 w-9 rounded-full transition-colors ${showOpenOnly ? "bg-indigo-600" : "bg-gray-300 dark:bg-gray-600"}`}
                                >
                                    <div
                                        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${showOpenOnly ? "translate-x-4" : "translate-x-0.5"}`}
                                    />
                                </div>
                            </div>
                        </label>
                    </div>

                    {/* Term checkboxes */}
                    <div className="flex flex-wrap items-center gap-3">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Term:
                        </span>
                        {ALL_TERMS.map((term) => (
                            <label
                                key={term}
                                className="flex cursor-pointer items-center gap-1.5"
                            >
                                <input
                                    type="checkbox"
                                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                    checked={selectedTerms.includes(term)}
                                    onChange={() => toggleTerm(term)}
                                />
                                <span className="text-sm text-gray-700 dark:text-gray-300">
                                    {term}
                                </span>
                            </label>
                        ))}
                    </div>

                    {/* Location multi-select */}
                    {availableLocations.length > 0 && (
                        <div className="flex flex-wrap items-center gap-3">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                Location:
                            </span>
                            {availableLocations.map((loc) => (
                                <label
                                    key={loc}
                                    className="flex cursor-pointer items-center gap-1.5"
                                >
                                    <input
                                        type="checkbox"
                                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                        checked={selectedLocations.includes(loc)}
                                        onChange={() => toggleLocation(loc)}
                                    />
                                    <span className="text-sm text-gray-700 dark:text-gray-300">
                                        {loc}
                                    </span>
                                </label>
                            ))}
                        </div>
                    )}
                </div>

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
                        {visibleJobs.map((job) => (
                            <div
                                key={job.id}
                                className="rounded-md border border-gray-200 p-4 dark:border-gray-700"
                            >
                                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <p className="truncate text-base font-semibold text-gray-900 dark:text-white md:text-lg">
                                                {job.company}
                                            </p>
                                            {job.is_open === false && (
                                                <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
                                                    Closed
                                                </span>
                                            )}
                                            {job.is_open === true && (
                                                <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                                                    Open
                                                </span>
                                            )}
                                            {job.term && (
                                                <span className="inline-flex items-center rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                                                    {job.term}
                                                </span>
                                            )}
                                        </div>
                                        <p className="line-clamp-2 text-sm text-gray-700 dark:text-gray-300 md:text-base">
                                            {job.title}
                                        </p>
                                        {job.location && (
                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                                📍 {job.location}
                                            </p>
                                        )}
                                        <p className="text-xs text-gray-500 dark:text-gray-400 md:text-sm">
                                            Created:{" "}
                                            {new Date(
                                                job.created_at,
                                            ).toLocaleString()}
                                        </p>
                                    </div>
                                    <div className="flex flex-shrink-0 items-center gap-2">
                                        <MatchScoreBadge
                                            score={job.match_percentage}
                                        />
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
                        {visibleJobs.length === 0 && (
                            <p className="text-gray-500 dark:text-gray-400">
                                {unsavedJobCount === 0
                                    ? "You have already saved all available job postings."
                                    : "No jobs match the current filters."}
                            </p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
