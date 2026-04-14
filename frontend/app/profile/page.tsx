import type { Metadata } from "next";
import ProfileManager from "@/components/ProfileManager";

export const metadata: Metadata = {
    title: "Settings",
};

export default function ProfilePage() {
    return (
        <div className="w-full space-y-6">
            <div>
                <h1 className="text-4xl font-bold text-md-on-surface dark:text-white mb-2">
                    Settings
                </h1>
                <p className="text-md-subtitle dark:text-gray-400 text-lg">
                    Edit profile settings and preferences.
                </p>
            </div>
            <ProfileManager />
        </div>
    );
}
