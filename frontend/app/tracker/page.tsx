import type { Metadata } from "next";
import ApplicationKanban from "@/components/ApplicationKanban";

export const metadata: Metadata = {
    title: "Applications",
};

export default function TrackerPage() {
    return (
        <div className="w-full space-y-6">
            <div>
                <h1 className="mb-2 text-3xl font-bold text-md-on-surface dark:text-white md:text-4xl">
                    Applications
                </h1>
                <p className="text-base text-md-subtitle dark:text-gray-400 md:text-lg">
                    Keep every application organized from saved to offer with
                    quick stage updates.
                </p>
            </div>
            <ApplicationKanban />
        </div>
    );
}
