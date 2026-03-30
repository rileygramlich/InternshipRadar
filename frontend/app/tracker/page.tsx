import ApplicationManager from "@/components/ApplicationManager";

export default function TrackerPage() {
    return (
        <div className="w-full space-y-6">
            <div>
                <h1 className="text-4xl font-bold text-gray-900 mb-2">
                    Kanban
                </h1>
                <p className="text-gray-600 text-lg">
                    Manage applications with CRUD controllers hitting Supabase.
                </p>
            </div>
            <ApplicationManager />
        </div>
    );
}
