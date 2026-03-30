export default function Home() {
    return (
        <div className="w-full">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
                Welcome to InternshipRadar
            </h1>
            <p className="text-gray-600 text-lg">
                Navigate using the sidebar to explore the three main views of
                the application.
            </p>
            <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                    <h2 className="text-xl font-semibold text-gray-900 mb-2">
                        📡 Discovery
                    </h2>
                    <p className="text-gray-600">
                        Find and explore internship opportunities
                    </p>
                </div>
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                    <h2 className="text-xl font-semibold text-gray-900 mb-2">
                        📋 Kanban
                    </h2>
                    <p className="text-gray-600">
                        Track applications and manage your progress
                    </p>
                </div>
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                    <h2 className="text-xl font-semibold text-gray-900 mb-2">
                        ⚙️ Settings
                    </h2>
                    <p className="text-gray-600">
                        Customize your profile and preferences
                    </p>
                </div>
            </div>
        </div>
    );
}
