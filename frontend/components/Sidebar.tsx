"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Sidebar() {
    const pathname = usePathname();

    const navItems = [
        { href: "/radar", label: "Discovery", icon: "📡" },
        { href: "/tracker", label: "Kanban", icon: "📋" },
        { href: "/profile", label: "Settings", icon: "⚙️" },
    ];

    return (
        <aside className="w-64 bg-white border-r border-gray-200 shadow-sm h-screen fixed left-0 top-0">
            <div className="p-8">
                <h1 className="text-2xl font-bold text-gray-900">Radar</h1>
                <p className="text-sm text-gray-500 mt-1">InternshipRadar</p>
            </div>

            <nav className="mt-8">
                <ul className="space-y-2 px-4">
                    {navItems.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                            <li key={item.href}>
                                <Link
                                    href={item.href}
                                    className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                                        isActive
                                            ? "bg-blue-50 text-blue-600 font-medium"
                                            : "text-gray-700 hover:bg-gray-50"
                                    }`}
                                >
                                    <span className="text-xl">{item.icon}</span>
                                    <span>{item.label}</span>
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            </nav>

            <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200">
                <div className="px-4 py-3 rounded-lg bg-gray-50 text-center">
                    <p className="text-sm text-gray-600">v0.1.0</p>
                </div>
            </div>
        </aside>
    );
}
