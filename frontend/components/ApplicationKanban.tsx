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

export default function ApplicationKanban() {
    const [applications, setApplications] = useState<Application[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [profileSkills, setProfileSkills] = useState<string[]>([]);

    const [draggingId, setDraggingId] = useState<string | null>(null);
    const [updatingIds, setUpdatingIds] = useState<Record<string, boolean>>({});
    const [deletingJobId, setDeletingJobId] = useState<string | null>(null);
    const [confirmDialog, setConfirmDialog] = useState<Application | null>(
        null,
    );

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
                } else {
                    setProfileSkills([]);
                }
            } catch {
                setProfileSkills([]);
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
        <div className="space-y-4 overflow-x-hidden lg:space-y-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                    <h2 className="text-xl font-semibold text-md-on-surface dark:text-white md:text-2xl lg:text-3xl">
                        Applications
                    </h2>
                    <p className="mt-1 text-sm text-md-subtitle dark:text-gray-400 md:text-base">
                        Drag cards between columns to change status. Changes
                        sync instantly to Supabase.
                    </p>
                </div>
                <button
                    onClick={refresh}
                    className="btn-ripple min-h-[44px] self-start rounded-2xl px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary-light dark:text-blue-400 dark:hover:bg-blue-900/30 md:self-auto"
                    disabled={loading}
                >
                    {loading ? "Refreshing..." : "Refresh"}
                </button>
            </div>

            {/* Analytics summary bar */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl bg-primary-light px-4 py-3 text-sm text-md-on-surface shadow-md3-1 dark:bg-blue-900 dark:text-gray-200">
                {COLUMNS.map((col, index) => (
                    <span key={col.key} className="flex items-center gap-1">
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
            </div>

            {error && (
                <p className="text-sm text-red-600 dark:text-red-400">
                    {error}
                </p>
            )}

            <div className="-mx-4 flex snap-x snap-mandatory flex-nowrap gap-4 overflow-x-auto px-4 pb-2 hide-scrollbar lg:mx-0 lg:grid lg:grid-cols-5 lg:gap-4 lg:overflow-visible lg:px-0">
                {columns.map((column) => (
                    <div
                        key={column.key}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={onDropToColumn(column.key)}
                        className="w-[85vw] shrink-0 snap-center rounded-2xl bg-md-surface p-3 min-h-52 shadow-md3-1 dark:bg-[#132244] lg:w-auto lg:shrink lg:snap-none"
                    >
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <span
                                    className={`h-2.5 w-2.5 rounded-full ${column.dotClass}`}
                                    aria-hidden="true"
                                />
                                <h3 className="text-sm font-semibold text-md-on-surface dark:text-gray-200">
                                    {column.label}
                                </h3>
                            </div>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-white dark:bg-gray-700 text-md-subtitle dark:text-gray-300 shadow-sm">
                                {column.items.length}
                            </span>
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
                                        onDragEnd={() => setDraggingId(null)}
                                        className={[
                                            "cursor-grab rounded-2xl border bg-white p-3 shadow-md3-1 transition-shadow hover:shadow-md3-2 active:cursor-grabbing dark:bg-[#0d1730]",
                                            column.accentClass,
                                            updatingIds[application.id]
                                                ? "opacity-60"
                                                : "opacity-100",
                                        ].join(" ")}
                                    >
                                        <p className="truncate text-xs text-md-subtitle dark:text-gray-400">
                                            {application.id}
                                        </p>
                                        <p className="mt-1 truncate text-sm font-semibold text-md-on-surface dark:text-white">
                                            {application.job_postings
                                                ?.company || "Unknown Company"}
                                        </p>
                                        <p className="line-clamp-2 text-xs text-md-subtitle dark:text-gray-300">
                                            {application.job_postings?.title ||
                                                "Unknown Job Title"}
                                        </p>
                                        {application.job_postings
                                            ?.description && (
                                            <p className="text-xs text-md-subtitle dark:text-gray-400 mt-1 line-clamp-3">
                                                {
                                                    application.job_postings
                                                        .description
                                                }
                                            </p>
                                        )}
                                        {application.job_postings?.tech_tags &&
                                            application.job_postings.tech_tags
                                                .length > 0 && (
                                                <SkillGapIndicator
                                                    techTags={
                                                        application.job_postings
                                                            .tech_tags
                                                    }
                                                    profileSkills={
                                                        profileSkills
                                                    }
                                                />
                                            )}
                                        {application.job_postings?.url && (
                                            <a
                                                href={
                                                    application.job_postings.url
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
                                        <p className="mt-1 truncate text-xs text-md-subtitle dark:text-gray-400">
                                            Profile: {application.profile_id}
                                        </p>
                                        <p className="truncate text-xs text-md-subtitle dark:text-gray-400">
                                            Job ID: {application.job_id}
                                        </p>
                                        <p className="text-xs text-md-subtitle dark:text-gray-400 mt-1">
                                            Match: {application.match_score}
                                        </p>
                                        <p className="text-xs text-md-subtitle dark:text-gray-500 mt-1">
                                            {new Date(
                                                application.created_at,
                                            ).toLocaleDateString()}
                                        </p>

                                        <div className="mt-2">
                                            <select
                                                className="min-h-[44px] w-full rounded-2xl border border-gray-200 px-2 text-xs dark:border-[#2d4068] dark:bg-[#132244] dark:text-gray-100"
                                                value={application.status}
                                                onChange={(event) => {
                                                    if (
                                                        event.target.value ===
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
                                                    updatingIds[application.id],
                                                )}
                                            >
                                                {COLUMNS.map((statusOption) => (
                                                    <option
                                                        key={statusOption.key}
                                                        value={statusOption.key}
                                                    >
                                                        {statusOption.label}
                                                    </option>
                                                ))}
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
                    <div className="mx-4 w-full max-w-sm rounded-2xl bg-white shadow-md3-2 dark:bg-[#0d1730]">
                        <div className="border-b border-gray-100 dark:border-[#22335a] px-6 py-4">
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
                        <div className="flex items-center justify-end gap-3 border-t border-gray-100 px-6 py-4 dark:border-[#22335a]">
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
                                className="btn-ripple min-h-[44px] rounded-2xl border border-gray-200 px-4 py-2 text-sm font-medium text-md-on-surface hover:bg-md-surface dark:border-[#2d4068] dark:text-gray-100 dark:hover:bg-[#132244]"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
