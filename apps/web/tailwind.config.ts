import nextUIConfig from "@repo/ui/tailwind.config";

export default {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./node_modules/@repo/ui/components/**/*.{js,ts,jsx,tsx}",
    "./node_modules/@repo/ui/node_modules/@nextui-org/theme/dist/**/*.{js,ts,jsx,tsx}",
    "./node_modules/@repo/ui/node_modules/@tremor/**/*.{js,ts,jsx,tsx}",
  ],
  presets: [nextUIConfig],
  theme: {
    extend: {
      colors: {
        black: "#1e1e1e",
        accent: "#ffffff",
        muted: "#60596C",
        accent: "#fe58ba",
        dark: "#210d40",
        darkAccent: "#180733",
      },
      keyframes: {
        scrolling: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(calc(-100% - var(--gap)))" },
        },
        "scrolling-vertical": {
          "0%": { transform: "translateY(0)" },
          "100%": { transform: "translateY(calc(-100% - var(--gap)))" },
        },
      },
      animation: {
        scrolling: "scrolling var(--duration) linear infinite var(--direction)",
        "scrolling-vertical":
          "scrolling-vertical var(--duration) linear infinite var(--direction)",
      },
      fontFamily: {
        barlow: ["Barlow", "sans-serif"],
        bangers: ["Bangers", "cursive"],
      },
    },
  },
};
