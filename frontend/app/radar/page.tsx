import JobManager from "@/components/JobManager";

export default function RadarPage() {
    return (
        <div className="w-full space-y-6">
            <div>
                <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
                    Discovery
                </h1>
                <p className="text-gray-600 dark:text-gray-400 text-lg">
                    Create and manage job postings via Supabase-backed
                    controllers.
                </p>
            </div>
            <JobManager />
        </div>
    );
}
