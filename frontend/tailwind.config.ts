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
                    DEFAULT: "#2F6BFF",
                    dark: "#1749C7",
                    light: "#E3ECFF",
                },
                "md-surface": "#F7F2EA",
                "md-on-surface": "#1F2937",
                "md-subtitle": "#667085",
            },
            fontFamily: {
                sans: ["var(--font-sans)", "ui-sans-serif", "system-ui"],
            },
            boxShadow: {
                "md3-1":
                    "0 1px 2px rgba(15, 23, 42, 0.06), 0 10px 24px rgba(15, 23, 42, 0.05)",
                "md3-2":
                    "0 4px 10px rgba(15, 23, 42, 0.08), 0 18px 36px rgba(15, 23, 42, 0.10)",
            },
        },
    },
    plugins: [],
};
export default config;
