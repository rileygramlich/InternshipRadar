"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
    location?: string | null;
    experience_level?: string | null;
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

function normalizeText(value: string | null | undefined) {
    return (value ?? "").trim().toLowerCase();
}

function includesAny(haystack: string, needles: string[]) {
    return needles.some((needle) => haystack.includes(needle));
}

function getSkillScore(jobSkills: string[] | null, profileSkills: string[]) {
    const normalizedJobSkills = (jobSkills ?? [])
        .map((skill) => normalizeText(skill))
        .filter(Boolean);

    if (normalizedJobSkills.length === 0) {
        return 0;
    }

    const profileSkillSet = new Set(
        profileSkills.map((skill) => normalizeText(skill)).filter(Boolean),
    );

    const matchedCount = normalizedJobSkills.filter((skill) =>
        profileSkillSet.has(skill),
    ).length;

    return matchedCount / normalizedJobSkills.length;
}

function getLocationScore(job: JobPosting, profileLocationPreference: string) {
    const preferredLocation = normalizeText(profileLocationPreference);
    if (!preferredLocation) {
        return 0;
    }

    const jobLocationText = normalizeText(
        [job.location, job.title, job.description].filter(Boolean).join(" "),
    );

    if (!jobLocationText) {
        return 0;
    }

    if (preferredLocation.includes("remote")) {
        return includesAny(jobLocationText, ["remote", "work from home"])
            ? 1
            : 0;
    }

    const locationTokens = preferredLocation
        .split(/[\s,/|-]+/)
        .map((token) => token.trim())
        .filter((token) => token.length >= 3);

    if (jobLocationText.includes(preferredLocation)) {
        return 1;
    }

    return locationTokens.length > 0 &&
        includesAny(jobLocationText, locationTokens)
        ? 1
        : 0;
}

function normalizeExperienceLevel(value: string) {
    const normalized = normalizeText(value);

    if (includesAny(normalized, ["intern", "internship", "co-op", "coop"])) {
        return "internship";
    }

    if (
        includesAny(normalized, [
            "entry",
            "junior",
            "new grad",
            "graduate",
            "associate",
        ])
    ) {
        return "entry";
    }

    if (includesAny(normalized, ["mid", "intermediate", "ii", "2+"])) {
        return "mid";
    }

    if (includesAny(normalized, ["senior", "lead", "staff", "principal"])) {
        return "senior";
    }

    return normalized;
}

function getLevelScore(job: JobPosting, profileExperienceLevel: string) {
    const preferredLevel = normalizeExperienceLevel(profileExperienceLevel);
    if (!preferredLevel) {
        return 0;
    }

    const jobLevelText = normalizeText(
        [job.experience_level, job.title, job.description]
            .filter(Boolean)
            .join(" "),
    );

    if (!jobLevelText) {
        return 0;
    }

    if (preferredLevel === "internship") {
        return includesAny(jobLevelText, [
            "intern",
            "internship",
            "co-op",
            "coop",
        ])
            ? 1
            : 0;
    }

    if (preferredLevel === "entry") {
        return includesAny(jobLevelText, [
            "entry",
            "junior",
            "new grad",
            "graduate",
            "associate",
        ])
            ? 1
            : 0;
    }

    if (preferredLevel === "mid") {
        return includesAny(jobLevelText, ["mid", "intermediate", "ii", "2+"])
            ? 1
            : 0;
    }

    if (preferredLevel === "senior") {
        return includesAny(jobLevelText, [
            "senior",
            "lead",
            "staff",
            "principal",
        ])
            ? 1
            : 0;
    }

    return jobLevelText.includes(preferredLevel) ? 1 : 0;
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
    const [profileLocationPreference, setProfileLocationPreference] =
        useState("");
    const [profileExperienceLevel, setProfileExperienceLevel] = useState("");
    const [pendingSave, setPendingSave] =
        useState<PendingApplicationSave | null>(null);
    const autoSaveAttemptedRef = useRef(false);

    const getJobMatchScore = useCallback(
        (job: JobPosting) => {
            const locationScore = getLocationScore(
                job,
                profileLocationPreference,
            );
            const levelScore = getLevelScore(job, profileExperienceLevel);
            const skillScore = getSkillScore(job.tech_tags, profileSkills);

            return Math.round(
                (locationScore * 0.5 + levelScore * 0.25 + skillScore * 0.25) *
                    100,
            );
        },
        [profileExperienceLevel, profileLocationPreference, profileSkills],
    );

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
            const saved = await saveApplication(
                job,
                pendingSave.status,
                getJobMatchScore(job),
            );
            if (saved) {
                clearPendingApplicationSave();
                setPendingSave(null);
            } else {
                autoSaveAttemptedRef.current = false;
            }
        })();
    }, [getJobMatchScore, isAuthenticated, jobs, pendingSave, profileId]);

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
                setProfileLocationPreference("");
                setProfileExperienceLevel("");
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
                setProfileLocationPreference(
                    typeof profileJson.data?.location_preference === "string"
                        ? profileJson.data.location_preference
                        : "",
                );
                setProfileExperienceLevel(
                    typeof profileJson.data?.experience_level === "string"
                        ? profileJson.data.experience_level
                        : "",
                );
            } else {
                setProfileId("");
                setProfileSkills([]);
                setProfileLocationPreference("");
                setProfileExperienceLevel("");
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

    async function saveApplication(
        job: JobPosting,
        status: ApplicationStatus,
        matchScore: number,
    ) {
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
                    matchScore,
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

        await saveApplication(job, quickApplyStatus, getJobMatchScore(job));
    }

    const visibleJobs = jobs.filter((job) => !savedJobIds.has(job.id));

    return (
        <div className="space-y-4 md:space-y-6">
            <div className="rounded-2xl border border-gray-200 bg-white p-4 md:p-6 dark:border-[#344051] dark:bg-[#11161d]">
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
                        className="mt-1 min-h-[44px] w-full rounded-2xl border border-gray-200 px-3 text-sm shadow-sm dark:border-[#344051] dark:bg-[#1b2430] dark:text-gray-100 md:w-72"
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

                {loading && visibleJobs.length === 0 ? (
                    <div className="space-y-4">
                        {Array.from({ length: 3 }).map((_, idx) => (
                            <div
                                key={`job-loading-${idx}`}
                                className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-[#344051] dark:bg-[#1b2430]"
                            >
                                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                    <div className="min-w-0 flex-1 space-y-2">
                                        <div className="loading-shimmer h-5 w-40 rounded-lg" />
                                        <div className="loading-shimmer h-4 w-56 rounded-lg" />
                                        <div className="loading-shimmer h-4 w-24 rounded-lg" />
                                        <div className="loading-shimmer h-3 w-36 rounded-lg" />
                                    </div>
                                    <div className="loading-shimmer h-10 w-24 rounded-2xl" />
                                </div>
                                <div className="mt-3 space-y-2">
                                    <div className="loading-shimmer h-3 w-full rounded-lg" />
                                    <div className="loading-shimmer h-3 w-11/12 rounded-lg" />
                                    <div className="loading-shimmer h-3 w-3/4 rounded-lg" />
                                </div>
                                <div className="mt-3 flex justify-end">
                                    <div className="loading-shimmer h-10 w-36 rounded-2xl" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : jobs.length === 0 ? (
                    <p className="text-md-subtitle dark:text-gray-400">
                        No job postings yet.
                    </p>
                ) : (
                    <div className="space-y-4">
                        {visibleJobs.map((job) => (
                            <div
                                key={job.id}
                                className="rounded-2xl border border-gray-200 bg-white p-4 transition-colors hover:bg-gray-50 dark:border-[#344051] dark:bg-[#1b2430] dark:hover:bg-[#202938]"
                            >
                                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                    <div className="min-w-0">
                                        <p className="truncate text-base font-semibold text-md-on-surface dark:text-white md:text-lg">
                                            {job.company}
                                        </p>
                                        <p className="line-clamp-2 text-sm text-md-subtitle dark:text-gray-300 md:text-base">
                                            {job.title}
                                        </p>
                                        <p className="mt-1 text-xs font-medium text-primary dark:text-blue-300 md:text-sm">
                                            Match: {getJobMatchScore(job)}%
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
                        {visibleJobs.length === 0 && (
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
