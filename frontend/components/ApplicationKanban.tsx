"use client";

import type { DragEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

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
        created_at?: string;
    } | null;
};

type Column = {
    key: ApplicationStatus;
    label: string;
    accentClass: string;
};

const COLUMNS: Column[] = [
    { key: "saved", label: "Saved", accentClass: "border-slate-300" },
    { key: "applied", label: "Applied", accentClass: "border-blue-300" },
    {
        key: "interview",
        label: "Interview",
        accentClass: "border-amber-300",
    },
    { key: "offer", label: "Offer", accentClass: "border-emerald-300" },
    { key: "rejected", label: "Rejected", accentClass: "border-rose-300" },
];

export default function ApplicationKanban() {
    const [applications, setApplications] = useState<Application[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

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

        const applied = counts.applied;
        const interviews = counts.interview;
        const conversionRate =
            applied > 0 ? Math.round((interviews / applied) * 100) : 0;

        return { counts, conversionRate };
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
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
                        Applications
                    </h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        Drag cards between columns to change status. Changes
                        sync instantly to Supabase.
                    </p>
                </div>
                <button
                    onClick={refresh}
                    className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300"
                    disabled={loading}
                >
                    {loading ? "Refreshing..." : "Refresh"}
                </button>
            </div>

            {/* Analytics summary bar */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg bg-indigo-50 border border-indigo-100 px-4 py-3 text-sm text-gray-700">
                {COLUMNS.map((col, index) => (
                    <span key={col.key} className="flex items-center gap-1">
                        {index !== 0 && (
                            <span className="text-gray-300 select-none">|</span>
                        )}
                        <span className="font-semibold text-gray-900">
                            {analytics.counts[col.key]}
                        </span>{" "}
                        {col.label}
                    </span>
                ))}
                <span className="text-gray-300 select-none">|</span>
                <span className="flex items-center gap-1">
                    <span className="font-semibold text-indigo-700">
                        {analytics.conversionRate}%
                    </span>{" "}
                    Applied → Interview
                </span>
            </div>

            {error && (
                <p className="text-sm text-red-600 dark:text-red-400">
                    {error}
                </p>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
                {columns.map((column) => (
                    <div
                        key={column.key}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={onDropToColumn(column.key)}
                        className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 min-h-52"
                    >
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                                {column.label}
                            </h3>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                                {column.items.length}
                            </span>
                        </div>

                        <div className="space-y-3">
                            {column.items.length === 0 ? (
                                <p className="text-xs text-gray-400 dark:text-gray-500">
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
                                            "rounded-md border bg-white dark:bg-gray-900 p-3 shadow-sm cursor-grab active:cursor-grabbing",
                                            column.accentClass,
                                            updatingIds[application.id]
                                                ? "opacity-60"
                                                : "opacity-100",
                                        ].join(" ")}
                                    >
                                        <p className="text-xs text-gray-500 dark:text-gray-400 break-all">
                                            {application.id}
                                        </p>
                                        <p className="text-sm font-semibold text-gray-900 dark:text-white mt-1 break-words">
                                            {application.job_postings
                                                ?.company || "Unknown Company"}
                                        </p>
                                        <p className="text-xs text-gray-700 dark:text-gray-300 break-words">
                                            {application.job_postings?.title ||
                                                "Unknown Job Title"}
                                        </p>
                                        {application.job_postings
                                            ?.description && (
                                            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 line-clamp-3">
                                                {
                                                    application.job_postings
                                                        .description
                                                }
                                            </p>
                                        )}
                                        {application.job_postings?.url && (
                                            <a
                                                href={
                                                    application.job_postings.url
                                                }
                                                target="_blank"
                                                rel="noreferrer"
                                                className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 break-all"
                                            >
                                                View Posting
                                            </a>
                                        )}
                                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 break-all">
                                            Profile: {application.profile_id}
                                        </p>
                                        <p className="text-xs text-gray-600 dark:text-gray-400 break-all">
                                            Job ID: {application.job_id}
                                        </p>
                                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                            Match: {application.match_score}
                                        </p>
                                        <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                                            {new Date(
                                                application.created_at,
                                            ).toLocaleDateString()}
                                        </p>

                                        <div className="mt-2">
                                            <select
                                                className="w-full rounded border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 text-xs"
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
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg max-w-sm w-full mx-4">
                        <div className="border-b border-gray-200 dark:border-gray-700 px-6 py-4">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                Remove Job Posting
                            </h3>
                        </div>
                        <div className="px-6 py-4 space-y-4">
                            <p className="text-gray-700 dark:text-gray-300">
                                Are you sure you want to delete this job
                                posting?
                            </p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
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
                        <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-end gap-3">
                            <button
                                onClick={confirmDelete}
                                disabled={
                                    deletingJobId === confirmDialog.job_id
                                }
                                className="px-4 py-2 rounded bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50"
                            >
                                {deletingJobId === confirmDialog.job_id
                                    ? "Removing..."
                                    : "Remove"}
                            </button>
                            <button
                                onClick={() => setConfirmDialog(null)}
                                className="px-4 py-2 rounded border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800"
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
