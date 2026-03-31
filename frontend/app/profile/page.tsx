import ProfileManager from "@/components/ProfileManager";

export default function ProfilePage() {
    return (
        <div className="w-full space-y-6">
            <div>
                <h1 className="text-4xl font-bold text-gray-900 mb-2">
                    Settings
                </h1>
                <p className="text-gray-600 text-lg">
                    Edit profile settings and preferences.
                </p>
            </div>
            <ProfileManager />
        </div>
    );
}
