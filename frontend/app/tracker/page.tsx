import ApplicationKanban from "@/components/ApplicationKanban";

export default function TrackerPage() {
    return (
        <div className="w-full space-y-6">
            <div>
                <h1 className="text-4xl font-bold text-md-on-surface dark:text-white mb-2">
                    Applications
                </h1>
                <p className="text-md-subtitle dark:text-gray-400 text-lg">
                    Keep every application organized from saved to offer with
                    quick stage updates.
                </p>
            </div>
            <ApplicationKanban />
        </div>
    );
}
