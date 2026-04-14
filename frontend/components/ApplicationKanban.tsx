"use client";

import type { DragEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { SkillGapIndicator } from "@/components/SkillPill";

type ApplicationStatus =
    | "saved"
    | "applied"
    | "interview"
    | "offer"
    | "rejected";

const TRACKER_PRIVATE_MARKER = "TRACKER_PRIVATE::";
const LEGACY_PRIVATE_MARKER = "__TRACKER_PRIVATE__";

type Application = {
    id: string;
    profile_id: string;
    job_id: string;
    match_score: number;
    status: ApplicationStatus;
    created_at: string;
    job_postings?: {
        id: string;
        company: string;
        title: string;
        url: string | null;
        description: string | null;
        tech_tags: string[] | null;
        location?: string | null;
        experience_level?: string | null;
        created_at?: string;
    } | null;
};

type Column = {
    key: ApplicationStatus;
    label: string;
    accentClass: string;
    dotClass: string;
};

const COLUMNS: Column[] = [
    {
        key: "saved",
        label: "Saved",
        accentClass: "border-slate-400 dark:border-slate-500",
        dotClass: "bg-slate-400",
    },
    {
        key: "applied",
        label: "Applied",
        accentClass: "border-blue-400 dark:border-blue-500",
        dotClass: "bg-blue-400",
    },
    {
        key: "interview",
        label: "Interview",
        accentClass: "border-amber-400 dark:border-amber-500",
        dotClass: "bg-amber-400",
    },
    {
        key: "offer",
        label: "Offer",
        accentClass: "border-emerald-400 dark:border-emerald-500",
        dotClass: "bg-emerald-400",
    },
    {
        key: "rejected",
        label: "Rejected",
        accentClass: "border-rose-400 dark:border-rose-500",
        dotClass: "bg-rose-400",
    },
];

function normalizeText(value: string | null | undefined) {
    return (value ?? "").trim().toLowerCase();
}

function stripPrivateMarker(value: string | null | undefined) {
    const raw = value ?? "";
    if (raw.startsWith(LEGACY_PRIVATE_MARKER)) {
        return raw.replace(LEGACY_PRIVATE_MARKER, "").trim();
    }

    if (!raw.startsWith(TRACKER_PRIVATE_MARKER)) {
        return raw;
    }

    return raw.replace(TRACKER_PRIVATE_MARKER, "").trim();
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

function getLocationScore(
    application: Application,
    profileLocationPreference: string,
    remoteOnly: boolean,
) {
    const job = application.job_postings;
    if (!job) {
        return 0;
    }

    const jobLocationText = normalizeText(
        [job.location, job.title, stripPrivateMarker(job.description)]
            .filter(Boolean)
            .join(" "),
    );

    if (!jobLocationText) {
        return 0.65;
    }

    if (remoteOnly) {
        return includesAny(jobLocationText, ["remote", "work from home"])
            ? 1
            : 0;
    }

    const preferredLocation = normalizeText(profileLocationPreference);
    if (!preferredLocation) {
        return 0.75;
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

function applyScoreBoost(weightedScore: number) {
    const boosted = 0.3 + weightedScore * 0.7;
    return Math.min(1, Math.max(0, boosted));
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

function getLevelScore(
    application: Application,
    profileExperienceLevel: string,
) {
    const preferredLevel = normalizeExperienceLevel(profileExperienceLevel);
    const job = application.job_postings;
    if (!preferredLevel || !job) {
        return 0;
    }

    const jobLevelText = normalizeText(
        [job.experience_level, job.title, stripPrivateMarker(job.description)]
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

export default function ApplicationKanban() {
    const [applications, setApplications] = useState<Application[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showMatchScore, setShowMatchScore] = useState(true);
    const [profileSkills, setProfileSkills] = useState<string[]>([]);
    const [profileLocationPreference, setProfileLocationPreference] =
        useState("");
    const [profileExperienceLevel, setProfileExperienceLevel] = useState("");
    const [profileRemoteOnly, setProfileRemoteOnly] = useState(false);

    const [draggingId, setDraggingId] = useState<string | null>(null);
    const [updatingIds, setUpdatingIds] = useState<Record<string, boolean>>({});
    const [deletingJobId, setDeletingJobId] = useState<string | null>(null);
    const [confirmDialog, setConfirmDialog] = useState<Application | null>(
        null,
    );
    const [showAddModal, setShowAddModal] = useState(false);
    const [submittingAdd, setSubmittingAdd] = useState(false);
    const [parsingLink, setParsingLink] = useState(false);
    const [addForm, setAddForm] = useState({
        company: "",
        title: "",
        location: "",
        url: "",
        description: "",
        tech_tags: "",
    });

    const refresh = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch("/api/applications", { cache: "no-store" });
            const json = await res.json();

            if (!res.ok) {
                throw new Error(json.error || "Failed to load applications");
            }
            const apps: Application[] = Array.isArray(json.data)
                ? json.data
                : [];
            setApplications(apps);

            // Fetch user's profile to get their skills
            try {
                const profileRes = await fetch("/api/profiles/me", {
                    cache: "no-store",
                });
                const profileJson = await profileRes.json().catch(() => ({}));

                if (profileRes.ok && profileJson.data?.skills) {
                    setProfileSkills(
                        Array.isArray(profileJson.data.skills)
                            ? profileJson.data.skills
                            : [],
                    );
                    setProfileLocationPreference(
                        typeof profileJson.data.location_preference === "string"
                            ? profileJson.data.location_preference
                            : "",
                    );
                    setProfileExperienceLevel(
                        typeof profileJson.data.experience_level === "string"
                            ? profileJson.data.experience_level
                            : "",
                    );
                    setProfileRemoteOnly(
                        profileJson.data.remote_preference !== false,
                    );
                } else {
                    setProfileSkills([]);
                    setProfileLocationPreference("");
                    setProfileExperienceLevel("");
                    setProfileRemoteOnly(false);
                }
            } catch {
                setProfileSkills([]);
                setProfileLocationPreference("");
                setProfileExperienceLevel("");
                setProfileRemoteOnly(false);
            }
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Failed to load applications",
            );
        } finally {
            setLoading(false);
        }
    }, []);

    const getApplicationMatchScore = useCallback(
        (application: Application) => {
            const locationScore = getLocationScore(
                application,
                profileLocationPreference,
                profileRemoteOnly,
            );
            const levelScore = getLevelScore(
                application,
                profileExperienceLevel,
            );
            const skillScore = getSkillScore(
                application.job_postings?.tech_tags ?? null,
                profileSkills,
            );

            return Math.round(
                applyScoreBoost(
                    locationScore * 0.5 + levelScore * 0.25 + skillScore * 0.25,
                ) * 100,
            );
        },
        [
            profileExperienceLevel,
            profileLocationPreference,
            profileRemoteOnly,
            profileSkills,
        ],
    );

    useEffect(() => {
        refresh();

        const onFocus = () => {
            refresh();
        };

        window.addEventListener("focus", onFocus);
        const intervalId = window.setInterval(refresh, 15000);

        return () => {
            window.removeEventListener("focus", onFocus);
            window.clearInterval(intervalId);
        };
    }, [refresh]);

    const columns = useMemo(() => {
        return COLUMNS.map((column) => ({
            ...column,
            items: applications.filter((app) => app.status === column.key),
        }));
    }, [applications]);

    const analytics = useMemo(() => {
        const counts = Object.fromEntries(
            columns.map((col) => [col.key, col.items.length]),
        ) as Record<ApplicationStatus, number>;

        // Any stage to the right of Applied still counts as applied.
        const appliedBase =
            counts.applied + counts.interview + counts.offer + counts.rejected;
        const interviews = counts.interview;
        const conversionRate =
            appliedBase > 0 ? Math.round((interviews / appliedBase) * 100) : 0;
        const rejectionRate =
            appliedBase > 0
                ? Math.round((counts.rejected / appliedBase) * 100)
                : 0;

        return { counts, conversionRate, rejectionRate };
    }, [columns]);

    async function updateStatus(
        applicationId: string,
        nextStatus: ApplicationStatus,
    ) {
        const current = applications.find((app) => app.id === applicationId);
        if (!current || current.status === nextStatus) {
            return;
        }

        setError(null);

        setApplications((prev) =>
            prev.map((item) =>
                item.id === applicationId
                    ? { ...item, status: nextStatus }
                    : item,
            ),
        );

        setUpdatingIds((prev) => ({ ...prev, [applicationId]: true }));

        try {
            const res = await fetch(`/api/applications/${applicationId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: nextStatus }),
            });

            const json = await res.json().catch(() => ({}));

            if (!res.ok) {
                throw new Error(
                    json.error || "Failed to update application status",
                );
            }
        } catch (err) {
            setApplications((prev) =>
                prev.map((item) =>
                    item.id === applicationId
                        ? { ...item, status: current.status }
                        : item,
                ),
            );
            setError(
                err instanceof Error
                    ? err.message
                    : "Failed to update application status",
            );
        } finally {
            setUpdatingIds((prev) => {
                const next = { ...prev };
                delete next[applicationId];
                return next;
            });
        }
    }

    async function handleDeleteJobPosting(application: Application) {
        const jobPostingId = application.job_postings?.id;

        if (!jobPostingId) {
            setError("This card has no linked job posting to delete.");
            return;
        }

        // Open confirmation dialog
        setConfirmDialog(application);
    }

    async function confirmDelete() {
        if (!confirmDialog) return;

        const applicationId = confirmDialog.id;
        if (!applicationId) {
            setError("Failed to delete application.");
            setConfirmDialog(null);
            return;
        }

        setError(null);
        setDeletingJobId(confirmDialog.job_id);

        try {
            const res = await fetch(`/api/applications/${applicationId}`, {
                method: "DELETE",
            });

            const json = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(json.error || "Failed to delete application");
            }

            // Remove only this application from the board.
            setApplications((prev) =>
                prev.filter((item) => item.id !== applicationId),
            );
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Failed to delete application",
            );
        } finally {
            setDeletingJobId(null);
            setConfirmDialog(null);
        }
    }

    async function handleParseFromLink() {
        if (!addForm.url.trim()) {
            setError("Add a job posting URL first.");
            return;
        }

        setParsingLink(true);
        setError(null);
        try {
            const res = await fetch("/api/parse-job-link", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url: addForm.url.trim() }),
            });
            const json = await res.json().catch(() => ({}));

            if (!res.ok) {
                throw new Error(json.error || "Failed to parse job posting");
            }

            setAddForm((prev) => ({
                ...prev,
                company:
                    typeof json.company === "string" && json.company.trim()
                        ? json.company.trim()
                        : prev.company,
                title:
                    typeof json.title === "string" && json.title.trim()
                        ? json.title.trim()
                        : prev.title,
                location:
                    typeof json.location === "string" && json.location.trim()
                        ? json.location.trim()
                        : prev.location,
                description:
                    typeof json.description === "string" &&
                    json.description.trim()
                        ? json.description.trim()
                        : prev.description,
                tech_tags: Array.isArray(json.tech_tags)
                    ? json.tech_tags.join(", ")
                    : prev.tech_tags,
            }));
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "Failed to parse job URL",
            );
        } finally {
            setParsingLink(false);
        }
    }

    async function handleCreateManualApplication() {
        if (!addForm.company.trim() || !addForm.title.trim()) {
            setError("Company and title are required.");
            return;
        }

        setSubmittingAdd(true);
        setError(null);
        try {
            const techTags = addForm.tech_tags
                .split(",")
                .map((tag) => tag.trim())
                .filter(Boolean);

            const locationScore = getLocationScore(
                {
                    id: "temp",
                    profile_id: "temp",
                    job_id: "temp",
                    match_score: 0,
                    status: "applied",
                    created_at: new Date().toISOString(),
                    job_postings: {
                        id: "temp",
                        company: addForm.company,
                        title: addForm.title,
                        location: addForm.location,
                        url: addForm.url,
                        description: addForm.description,
                        tech_tags: techTags,
                    },
                },
                profileLocationPreference,
                profileRemoteOnly,
            );
            const levelScore = getLevelScore(
                {
                    id: "temp",
                    profile_id: "temp",
                    job_id: "temp",
                    match_score: 0,
                    status: "applied",
                    created_at: new Date().toISOString(),
                    job_postings: {
                        id: "temp",
                        company: addForm.company,
                        title: addForm.title,
                        location: addForm.location,
                        url: addForm.url,
                        description: addForm.description,
                        tech_tags: techTags,
                    },
                },
                profileExperienceLevel,
            );
            const skillScore = getSkillScore(techTags, profileSkills);
            const matchScore = Math.round(
                (locationScore * 0.5 + levelScore * 0.25 + skillScore * 0.25) *
                    100,
            );

            const res = await fetch("/api/applications/manual", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    company: addForm.company.trim(),
                    title: addForm.title.trim(),
                    location: addForm.location.trim(),
                    url: addForm.url.trim(),
                    description: addForm.description.trim(),
                    tech_tags: techTags,
                    match_score: matchScore,
                }),
            });

            const json = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(json.error || "Failed to add application");
            }

            setShowAddModal(false);
            setAddForm({
                company: "",
                title: "",
                location: "",
                url: "",
                description: "",
                tech_tags: "",
            });
            await refresh();
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Failed to add application",
            );
        } finally {
            setSubmittingAdd(false);
        }
    }

    function onDropToColumn(status: ApplicationStatus) {
        return async (event: DragEvent<HTMLDivElement>) => {
            event.preventDefault();
            const fromDataTransfer = event.dataTransfer.getData("text/plain");
            const draggedId = draggingId || fromDataTransfer;

            if (!draggedId) {
                return;
            }

            setDraggingId(null);
            await updateStatus(draggedId, status);
        };
    }

    return (
        <div className="space-y-4 lg:space-y-6">
            {/* Analytics summary bar */}
            <div className="flex flex-col gap-3 rounded-2xl bg-primary-light px-4 py-3 text-sm text-md-on-surface dark:bg-blue-900 dark:text-gray-200 md:flex-row md:items-center md:justify-between md:gap-x-4 md:gap-y-2">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    {loading && applications.length === 0 ? (
                        <>
                            <div className="loading-shimmer h-4 w-28 rounded-lg" />
                            <div className="loading-shimmer h-4 w-24 rounded-lg" />
                            <div className="loading-shimmer h-4 w-28 rounded-lg" />
                            <div className="loading-shimmer h-4 w-24 rounded-lg" />
                        </>
                    ) : (
                        <>
                            {COLUMNS.map((col, index) => (
                                <span
                                    key={col.key}
                                    className="flex items-center gap-1"
                                >
                                    {index !== 0 && (
                                        <span className="text-gray-300 dark:text-gray-600 select-none">
                                            |
                                        </span>
                                    )}
                                    <span className="font-semibold text-md-on-surface dark:text-white">
                                        {analytics.counts[col.key]}
                                    </span>{" "}
                                    {col.label}
                                </span>
                            ))}
                            <span className="text-gray-300 dark:text-gray-600 select-none">
                                |
                            </span>
                            <span className="flex items-center gap-1">
                                <span className="font-semibold text-primary dark:text-blue-400">
                                    {analytics.conversionRate}%
                                </span>{" "}
                                Applied → Interview
                            </span>
                            <span className="text-gray-300 dark:text-gray-600 select-none">
                                |
                            </span>
                            <span className="flex items-center gap-1">
                                <span className="font-semibold text-rose-700 dark:text-rose-400">
                                    {analytics.rejectionRate}%
                                </span>{" "}
                                Rejection Rate
                            </span>
                        </>
                    )}
                </div>
                <button
                    type="button"
                    onClick={() => setShowMatchScore((prev) => !prev)}
                    className="btn-ripple inline-flex min-h-[40px] self-start items-center rounded-full border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-md-on-surface hover:bg-gray-100 dark:border-[#344051] dark:bg-[#1b2430] dark:text-gray-100 dark:hover:bg-[#202938] md:self-auto"
                    aria-pressed={showMatchScore}
                >
                    {showMatchScore ? "Hide Match Score" : "Show Match Score"}
                </button>
            </div>

            {error && (
                <p className="text-sm text-red-600 dark:text-red-400">
                    {error}
                </p>
            )}

            <div className="flex snap-x snap-mandatory flex-nowrap gap-4 overflow-x-auto pb-2 hide-scrollbar xl:grid xl:grid-cols-5 xl:gap-4 xl:overflow-visible">
                {loading && applications.length === 0
                    ? COLUMNS.map((column) => (
                          <div
                              key={`loading-${column.key}`}
                              className="w-[88vw] shrink-0 snap-start rounded-2xl bg-md-surface p-3 min-h-52 dark:bg-[#1b2430] md:w-[calc((100%-1rem)/2)] xl:w-auto xl:shrink xl:snap-none"
                          >
                              <div className="mb-3 flex items-center justify-between">
                                  <div className="loading-shimmer h-4 w-20 rounded-lg" />
                                  <div className="loading-shimmer h-5 w-8 rounded-full" />
                              </div>
                              <div className="space-y-3">
                                  {Array.from({ length: 2 }).map((_, idx) => (
                                      <div
                                          key={`${column.key}-loading-card-${idx}`}
                                          className="rounded-2xl border border-gray-200 bg-white p-3 dark:border-[#344051] dark:bg-[#11161d]"
                                      >
                                          <div className="space-y-2">
                                              <div className="loading-shimmer h-4 w-32 rounded-lg" />
                                              <div className="loading-shimmer h-3 w-40 rounded-lg" />
                                              <div className="loading-shimmer h-3 w-full rounded-lg" />
                                              <div className="loading-shimmer h-3 w-5/6 rounded-lg" />
                                              <div className="loading-shimmer h-9 w-full rounded-2xl" />
                                          </div>
                                      </div>
                                  ))}
                              </div>
                          </div>
                      ))
                    : columns.map((column) => (
                          <div
                              key={column.key}
                              onDragOver={(event) => event.preventDefault()}
                              onDrop={onDropToColumn(column.key)}
                              className="w-[88vw] shrink-0 snap-start rounded-2xl bg-md-surface p-3 min-h-52 dark:bg-[#1b2430] md:w-[calc((100%-1rem)/2)] xl:w-auto xl:shrink xl:snap-none"
                          >
                              <div className="mb-3 flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                      <span
                                          className={`h-2.5 w-2.5 rounded-full ${column.dotClass}`}
                                          aria-hidden="true"
                                      />
                                      <h3 className="text-sm font-semibold text-md-on-surface dark:text-gray-200">
                                          {column.label}
                                      </h3>
                                  </div>
                                  <div className="flex items-center gap-2">
                                      {column.key === "applied" && (
                                          <button
                                              type="button"
                                              onClick={() => {
                                                  setError(null);
                                                  setShowAddModal(true);
                                              }}
                                              className="btn-ripple inline-flex h-8 w-8 items-center justify-center rounded-full border border-gray-300 bg-white text-base font-semibold text-md-on-surface hover:bg-gray-100 dark:border-[#344051] dark:bg-[#1b2430] dark:text-white dark:hover:bg-[#202938]"
                                              aria-label="Add your own application"
                                          >
                                              +
                                          </button>
                                      )}
                                      <span className="rounded-full bg-white px-2 py-0.5 text-xs text-md-subtitle shadow-sm dark:bg-gray-700 dark:text-gray-300">
                                          {column.items.length}
                                      </span>
                                  </div>
                              </div>

                              <div className="space-y-3">
                                  {column.items.length === 0 ? (
                                      <p className="text-xs text-md-subtitle dark:text-gray-500">
                                          Drop applications here
                                      </p>
                                  ) : (
                                      column.items.map((application) => (
                                          <div
                                              key={application.id}
                                              draggable
                                              onDragStart={(event) => {
                                                  setDraggingId(application.id);
                                                  event.dataTransfer.setData(
                                                      "text/plain",
                                                      application.id,
                                                  );
                                                  event.dataTransfer.effectAllowed =
                                                      "move";
                                              }}
                                              onDragEnd={() =>
                                                  setDraggingId(null)
                                              }
                                              className={[
                                                  "cursor-grab rounded-2xl border bg-white p-3 shadow-md3-1 transition-shadow hover:shadow-md3-2 active:cursor-grabbing dark:bg-[#11161d]",
                                                  column.accentClass,
                                                  updatingIds[application.id]
                                                      ? "opacity-60"
                                                      : "opacity-100",
                                              ].join(" ")}
                                          >
                                              <p className="mt-1 truncate text-sm font-semibold text-md-on-surface dark:text-white">
                                                  {application.job_postings
                                                      ?.company ||
                                                      "Unknown Company"}
                                              </p>
                                              <p className="line-clamp-2 text-xs text-md-subtitle dark:text-gray-300">
                                                  {application.job_postings
                                                      ?.title ||
                                                      "Unknown Job Title"}
                                              </p>
                                              {application.job_postings?.location && (
                                                  <p className="mt-1 text-xs font-medium text-primary dark:text-blue-300">
                                                      {application.job_postings.location}
                                                  </p>
                                              )}
                                              {application.job_postings
                                                  ?.description && (
                                                  <p className="text-xs text-md-subtitle dark:text-gray-400 mt-1 line-clamp-3">
                                                      {stripPrivateMarker(
                                                          application
                                                              .job_postings
                                                              .description,
                                                      )}
                                                  </p>
                                              )}
                                              {application.job_postings
                                                  ?.tech_tags &&
                                                  application.job_postings
                                                      .tech_tags.length > 0 && (
                                                      <SkillGapIndicator
                                                          techTags={
                                                              application
                                                                  .job_postings
                                                                  .tech_tags
                                                          }
                                                          profileSkills={
                                                              profileSkills
                                                          }
                                                      />
                                                  )}
                                              {application.job_postings
                                                  ?.url && (
                                                  <a
                                                      href={
                                                          application
                                                              .job_postings.url
                                                      }
                                                      target="_blank"
                                                      rel="noreferrer"
                                                      className="btn-ripple mt-2 inline-flex min-h-[44px] max-w-full items-center rounded-2xl px-3 py-2 text-xs font-medium text-primary transition-colors hover:bg-primary-light dark:text-blue-400 dark:hover:bg-blue-900/30"
                                                  >
                                                      <span className="truncate">
                                                          View Posting
                                                      </span>
                                                  </a>
                                              )}
                                              {showMatchScore && (
                                                  <p className="mt-1 text-xs text-md-subtitle dark:text-gray-400">
                                                      Match:{" "}
                                                      {getApplicationMatchScore(
                                                          application,
                                                      )}
                                                      %
                                                  </p>
                                              )}
                                              <p className="text-xs text-md-subtitle dark:text-gray-500 mt-1">
                                                  {new Date(
                                                      application.created_at,
                                                  ).toLocaleDateString()}
                                              </p>

                                              <div className="mt-2">
                                                  <select
                                                      className="min-h-[44px] w-full rounded-2xl border border-gray-200 px-2 text-xs dark:border-[#344051] dark:bg-[#1b2430] dark:text-gray-100"
                                                      value={application.status}
                                                      onChange={(event) => {
                                                          if (
                                                              event.target
                                                                  .value ===
                                                              "delete"
                                                          ) {
                                                              handleDeleteJobPosting(
                                                                  application,
                                                              );
                                                              // Reset the select to its original status
                                                              event.target.value =
                                                                  application.status;
                                                          } else {
                                                              updateStatus(
                                                                  application.id,
                                                                  event.target
                                                                      .value as ApplicationStatus,
                                                              );
                                                          }
                                                      }}
                                                      disabled={Boolean(
                                                          updatingIds[
                                                              application.id
                                                          ],
                                                      )}
                                                  >
                                                      {COLUMNS.map(
                                                          (statusOption) => (
                                                              <option
                                                                  key={
                                                                      statusOption.key
                                                                  }
                                                                  value={
                                                                      statusOption.key
                                                                  }
                                                              >
                                                                  {
                                                                      statusOption.label
                                                                  }
                                                              </option>
                                                          ),
                                                      )}
                                                      <option
                                                          value="delete"
                                                          className="text-red-600"
                                                      >
                                                          Remove Posting
                                                      </option>
                                                  </select>
                                              </div>
                                          </div>
                                      ))
                                  )}
                              </div>
                          </div>
                      ))}
            </div>

            {/* Confirmation Dialog */}
            {confirmDialog && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
                    <div className="mx-4 w-full max-w-sm rounded-2xl bg-white shadow-md3-2 dark:bg-[#11161d]">
                        <div className="border-b border-gray-100 dark:border-[#313c4d] px-6 py-4">
                            <h3 className="text-lg font-semibold text-md-on-surface dark:text-white">
                                Remove Job Posting
                            </h3>
                        </div>
                        <div className="px-6 py-4 space-y-4">
                            <p className="text-md-on-surface dark:text-gray-300">
                                Are you sure you want to delete this job
                                posting?
                            </p>
                            <p className="text-sm text-md-subtitle dark:text-gray-400">
                                <span className="font-medium">
                                    {confirmDialog.job_postings?.company}
                                </span>
                                {" - "}
                                <span>{confirmDialog.job_postings?.title}</span>
                            </p>
                            <p className="text-xs text-red-600 dark:text-red-400">
                                This action cannot be undone.
                            </p>
                        </div>
                        <div className="flex items-center justify-end gap-3 border-t border-gray-100 px-6 py-4 dark:border-[#313c4d]">
                            <button
                                onClick={confirmDelete}
                                disabled={
                                    deletingJobId === confirmDialog.job_id
                                }
                                className="btn-ripple min-h-[44px] rounded-2xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                            >
                                {deletingJobId === confirmDialog.job_id
                                    ? "Removing..."
                                    : "Remove"}
                            </button>
                            <button
                                onClick={() => setConfirmDialog(null)}
                                className="btn-ripple min-h-[44px] rounded-2xl border border-gray-200 px-4 py-2 text-sm font-medium text-md-on-surface hover:bg-md-surface dark:border-[#344051] dark:text-gray-100 dark:hover:bg-[#1b2430]"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showAddModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
                    <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-md3-2 dark:bg-[#11161d]">
                        <div className="mb-4 flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-md-on-surface dark:text-white">
                                Add Your Own Job Application
                            </h3>
                            <button
                                type="button"
                                onClick={() => setShowAddModal(false)}
                                className="btn-ripple rounded-lg px-2 py-1 text-sm text-md-subtitle hover:bg-gray-100 dark:hover:bg-[#1b2430]"
                            >
                                Close
                            </button>
                        </div>

                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                            <label className="text-sm text-md-on-surface dark:text-gray-200">
                                Company
                                <input
                                    className="mt-1 min-h-[44px] w-full rounded-2xl border border-gray-200 px-3 text-sm shadow-sm dark:border-[#344051] dark:bg-[#1b2430] dark:text-gray-100"
                                    value={addForm.company}
                                    onChange={(event) =>
                                        setAddForm((prev) => ({
                                            ...prev,
                                            company: event.target.value,
                                        }))
                                    }
                                />
                            </label>
                            <label className="text-sm text-md-on-surface dark:text-gray-200">
                                Job Title
                                <input
                                    className="mt-1 min-h-[44px] w-full rounded-2xl border border-gray-200 px-3 text-sm shadow-sm dark:border-[#344051] dark:bg-[#1b2430] dark:text-gray-100"
                                    value={addForm.title}
                                    onChange={(event) =>
                                        setAddForm((prev) => ({
                                            ...prev,
                                            title: event.target.value,
                                        }))
                                    }
                                />
                            </label>
                        </div>

                        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto]">
                            <label className="text-sm text-md-on-surface dark:text-gray-200">
                                Job Posting URL
                                <input
                                    className="mt-1 min-h-[44px] w-full rounded-2xl border border-gray-200 px-3 text-sm shadow-sm dark:border-[#344051] dark:bg-[#1b2430] dark:text-gray-100"
                                    value={addForm.url}
                                    onChange={(event) =>
                                        setAddForm((prev) => ({
                                            ...prev,
                                            url: event.target.value,
                                        }))
                                    }
                                    placeholder="https://..."
                                />
                            </label>
                            <button
                                type="button"
                                onClick={handleParseFromLink}
                                disabled={parsingLink}
                                className="btn-ripple mt-6 min-h-[44px] rounded-2xl border border-gray-200 px-4 text-sm font-medium text-md-on-surface hover:bg-md-surface disabled:opacity-60 dark:border-[#344051] dark:text-gray-100 dark:hover:bg-[#1b2430]"
                            >
                                {parsingLink ? "Parsing..." : "Parse Link"}
                            </button>
                        </div>

                        <div className="mt-3 grid grid-cols-1 gap-3">
                            <label className="text-sm text-md-on-surface dark:text-gray-200">
                                Skills (comma-separated)
                                <input
                                    className="mt-1 min-h-[44px] w-full rounded-2xl border border-gray-200 px-3 text-sm shadow-sm dark:border-[#344051] dark:bg-[#1b2430] dark:text-gray-100"
                                    value={addForm.tech_tags}
                                    onChange={(event) =>
                                        setAddForm((prev) => ({
                                            ...prev,
                                            tech_tags: event.target.value,
                                        }))
                                    }
                                />
                            </label>
                        </div>
                        <p className="mt-2 text-xs text-md-subtitle dark:text-gray-400">
                            This will be added directly to the Applied column.
                        </p>

                        <label className="mt-3 block text-sm text-md-on-surface dark:text-gray-200">
                            Description
                            <textarea
                                rows={5}
                                className="mt-1 w-full rounded-2xl border border-gray-200 px-3 py-2 text-sm shadow-sm dark:border-[#344051] dark:bg-[#1b2430] dark:text-gray-100"
                                value={addForm.description}
                                onChange={(event) =>
                                    setAddForm((prev) => ({
                                        ...prev,
                                        description: event.target.value,
                                    }))
                                }
                            />
                        </label>

                        <div className="mt-5 flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setShowAddModal(false)}
                                className="btn-ripple min-h-[44px] rounded-2xl border border-gray-200 px-4 py-2 text-sm font-medium text-md-on-surface hover:bg-md-surface dark:border-[#344051] dark:text-gray-100 dark:hover:bg-[#1b2430]"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleCreateManualApplication}
                                disabled={submittingAdd}
                                className="btn-ripple min-h-[44px] rounded-2xl bg-primary px-5 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-60"
                            >
                                {submittingAdd ? "Adding..." : "Add to Tracker"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
