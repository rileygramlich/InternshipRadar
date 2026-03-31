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

        const shouldDelete = window.confirm(
            "Are you sure you want to delete this job posting?",
        );

        if (!shouldDelete) {
            return;
        }

        setError(null);
        setDeletingJobId(application.job_id);

        try {
            const res = await fetch(`/api/job-postings/${jobPostingId}`, {
                method: "DELETE",
            });

            const json = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(json.error || "Failed to delete job posting");
            }

            // Remove all cards referencing the deleted posting.
            setApplications((prev) =>
                prev.filter((item) => item.job_id !== application.job_id),
            );
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Failed to delete job posting",
            );
        } finally {
            setDeletingJobId(null);
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
                    <h2 className="text-2xl font-semibold text-gray-900">
                        Applications
                    </h2>
                    <p className="text-sm text-gray-600 mt-1">
                        Drag cards between columns to change status. Changes
                        sync instantly to Supabase.
                    </p>
                </div>
                <button
                    onClick={refresh}
                    className="text-sm text-indigo-600 hover:text-indigo-700"
                    disabled={loading}
                >
                    {loading ? "Refreshing..." : "Refresh"}
                </button>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
                {columns.map((column) => (
                    <div
                        key={column.key}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={onDropToColumn(column.key)}
                        className="bg-gray-50 border border-gray-200 rounded-lg p-3 min-h-52"
                    >
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-semibold text-gray-800">
                                {column.label}
                            </h3>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 text-gray-700">
                                {column.items.length}
                            </span>
                        </div>

                        <div className="space-y-3">
                            {column.items.length === 0 ? (
                                <p className="text-xs text-gray-400">
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
                                            "rounded-md border bg-white p-3 shadow-sm cursor-grab active:cursor-grabbing",
                                            column.accentClass,
                                            updatingIds[application.id]
                                                ? "opacity-60"
                                                : "opacity-100",
                                        ].join(" ")}
                                    >
                                        <p className="text-xs text-gray-500 break-all">
                                            {application.id}
                                        </p>
                                        <p className="text-sm font-semibold text-gray-900 mt-1 break-words">
                                            {application.job_postings
                                                ?.company || "Unknown Company"}
                                        </p>
                                        <p className="text-xs text-gray-700 break-words">
                                            {application.job_postings?.title ||
                                                "Unknown Job Title"}
                                        </p>
                                        {application.job_postings
                                            ?.description && (
                                            <p className="text-xs text-gray-600 mt-1 line-clamp-3">
                                                {
                                                    application.job_postings
                                                        .description
                                                }
                                            </p>
                                        )}
                                        {(application.job_postings?.url ||
                                            application.job_postings?.id) && (
                                            <div className="mt-1 flex items-center gap-3">
                                                {application.job_postings
                                                    ?.url && (
                                                    <a
                                                        href={
                                                            application
                                                                .job_postings
                                                                .url
                                                        }
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="text-xs text-indigo-600 hover:text-indigo-700 break-all"
                                                    >
                                                        View Posting
                                                    </a>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        handleDeleteJobPosting(
                                                            application,
                                                        )
                                                    }
                                                    disabled={
                                                        deletingJobId ===
                                                        application.job_id
                                                    }
                                                    className="text-xs text-red-600 hover:text-red-700 disabled:opacity-50"
                                                >
                                                    {deletingJobId ===
                                                    application.job_id
                                                        ? "Deleting..."
                                                        : "Delete Posting"}
                                                </button>
                                            </div>
                                        )}
                                        <p className="text-xs text-gray-600 mt-1 break-all">
                                            Profile: {application.profile_id}
                                        </p>
                                        <p className="text-xs text-gray-600 break-all">
                                            Job ID: {application.job_id}
                                        </p>
                                        <p className="text-xs text-gray-600 mt-1">
                                            Match: {application.match_score}
                                        </p>
                                        <p className="text-xs text-gray-500 mt-1">
                                            {new Date(
                                                application.created_at,
                                            ).toLocaleDateString()}
                                        </p>

                                        <div className="mt-2">
                                            <select
                                                className="w-full rounded border-gray-300 text-xs"
                                                value={application.status}
                                                onChange={(event) =>
                                                    updateStatus(
                                                        application.id,
                                                        event.target
                                                            .value as ApplicationStatus,
                                                    )
                                                }
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
                                            </select>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
