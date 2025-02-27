import sharedConfig from "@repo/tailwind-config/tailwind.config";
import { Config } from "tailwindcss";
import { nextui } from "@nextui-org/react";
import colors from "tailwindcss/colors";

const config: Pick<Config, "darkMode" | "plugins" | "presets"> = {
  darkMode: "class",
  plugins: [nextui()],
  presets: [sharedConfig],
  theme: {
    transparent: "transparent",
    current: "currentColor",
    extend: {
      fontFamily: {
        main: ["Montserrat", "sans-serif"],
        header: ["Ubuntu", "sans-serif"],
      },
      colors: {
        // light mode
        tremor: {
          brand: {
            faint: colors.blue[50],
            muted: colors.blue[200],
            subtle: colors.blue[400],
            DEFAULT: colors.blue[500],
            emphasis: colors.blue[700],
            inverted: colors.white,
          },
          background: {
            muted: colors.neutral[50],
            subtle: colors.neutral[100],
            DEFAULT: colors.white,
            emphasis: colors.neutral[700],
          },
          border: {
            DEFAULT: colors.neutral[200],
          },
          ring: {
            DEFAULT: colors.neutral[200],
          },
          content: {
            subtle: colors.neutral[400],
            DEFAULT: colors.neutral[500],
            emphasis: colors.neutral[700],
            strong: colors.neutral[900],
            inverted: colors.white,
          },
        },
        "dark-tremor": {
          brand: {
            faint: "#000000",
            muted: colors.neutral[950],
            subtle: colors.neutral[800],
            DEFAULT: colors.neutral[500],
            emphasis: colors.neutral[400],
            inverted: colors.neutral[950],
          },
          background: {
            muted: "#000000",
            subtle: colors.neutral[800],
            DEFAULT: colors.neutral[900],
            emphasis: colors.neutral[300],
          },
          border: {
            DEFAULT: colors.neutral[800],
          },
          ring: {
            DEFAULT: colors.neutral[800],
          },
          content: {
            subtle: colors.neutral[600],
            DEFAULT: colors.neutral[500],
            emphasis: colors.neutral[200],
            strong: colors.neutral[50],
            inverted: colors.neutral[950],
          },
        },
      },
      boxShadow: {
        // light
        "tremor-input": "0 1px 2px 0 rgb(0 0 0 / 0.05)",
        "tremor-card":
          "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
        "tremor-dropdown":
          "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
        // dark
        "dark-tremor-input": "0 1px 2px 0 rgb(0 0 0 / 0.05)",
        "dark-tremor-card":
          "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
        "dark-tremor-dropdown":
          "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
      },
      borderRadius: {
        "tremor-sm": "0.375rem",
        "tremor-default": "0.5rem",
        "tremor-full": "9999px",
      },
      fontSize: {
        "tremor-label": ["0.75rem", { lineHeight: "1rem" }],
        "tremor-default": ["0.875rem", { lineHeight: "1.25rem" }],
        "tremor-title": ["1.125rem", { lineHeight: "1.75rem" }],
        "tremor-metric": ["1.875rem", { lineHeight: "2.25rem" }],
      },
    },
  },
};

export default config;
