import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        cream: "#F7F3EC",
        ink: "#0E1A1A",
        eu: { DEFAULT: "#0A2A6B", accent: "#F5C518" },   // deep blue + gold
        usa: { DEFAULT: "#B31942", accent: "#0A3161" },  // red + navy
        fairway: "#0B3B2E",
      },
      fontFamily: {
        display: ["ui-serif", "Georgia", "Cambria", "serif"],
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(14,26,26,0.06), 0 4px 12px rgba(14,26,26,0.04)",
      },
    },
  },
  plugins: [],
};
export default config;

