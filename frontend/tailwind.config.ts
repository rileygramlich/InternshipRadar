import type { Config } from "tailwindcss";

const config: Config = {
    content: [
        "./app/**/*.{js,ts,jsx,tsx,mdx}",
        "./components/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    darkMode: "class",
    theme: {
        extend: {
            colors: {
                primary: {
                    DEFAULT: "#1A73E8",
                    dark: "#1557B0",
                    light: "#E8F0FE",
                },
                "md-surface": "#F8F9FA",
                "md-on-surface": "#202124",
                "md-subtitle": "#5F6368",
            },
            fontFamily: {
                sans: [
                    "Inter",
                    "Roboto",
                    "-apple-system",
                    "BlinkMacSystemFont",
                    "Segoe UI",
                    "sans-serif",
                ],
            },
            boxShadow: {
                "md3-1": "0 1px 2px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.10)",
                "md3-2": "0 2px 6px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.08)",
            },
        },
    },
    plugins: [],
};
export default config;
