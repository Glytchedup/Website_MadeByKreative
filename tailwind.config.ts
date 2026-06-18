import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Warm, craft-forward palette. PLACEHOLDER brand colors — confirm with Kristol.
        cream: "#FBF7F0",
        linen: "#F3EBDD",
        clay: "#C8745A",
        terracotta: "#B85C38",
        sage: "#8A9A5B",
        charcoal: "#3A352F",
        muted: "#7A7268",
      },
      fontFamily: {
        sans: ["var(--font-body)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Georgia", "serif"],
      },
      borderRadius: {
        soft: "0.875rem",
      },
      boxShadow: {
        card: "0 4px 24px -8px rgba(58, 53, 47, 0.18)",
      },
    },
  },
  plugins: [],
};

export default config;
