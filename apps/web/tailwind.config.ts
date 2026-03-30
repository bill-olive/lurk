import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Warm editorial palette
        ivory: {
          DEFAULT: "#FEFBF6",
          50: "#FFFDF9",
          100: "#FEFBF6",
          200: "#FBF5EC",
          300: "#F5EBD9",
          400: "#EDE0C8",
          500: "#E2D1B0",
        },
        ink: {
          DEFAULT: "#1A1A1A",
          50: "#F7F7F7",
          100: "#E8E8E8",
          200: "#D4D4D4",
          300: "#A3A3A3",
          400: "#737373",
          500: "#525252",
          600: "#3D3D3D",
          700: "#2E2E2E",
          800: "#1A1A1A",
          900: "#0F0F0F",
        },
        clay: {
          DEFAULT: "#C46849",
          50: "#FDF5F2",
          100: "#FAE8E1",
          200: "#F4CFC2",
          300: "#ECAE98",
          400: "#D98A6E",
          500: "#C46849",
          600: "#A8533A",
          700: "#8A4331",
          800: "#6D372A",
          900: "#4A2720",
        },
        olive: {
          DEFAULT: "#6B7C5E",
          50: "#F4F6F2",
          100: "#E6EBE2",
          200: "#CDD7C5",
          300: "#ADBDA0",
          400: "#8E9F7F",
          500: "#6B7C5E",
          600: "#56644B",
          700: "#434E3B",
          800: "#353D2F",
          900: "#272D23",
        },
        heather: {
          DEFAULT: "#8B7EC8",
          50: "#F5F3FB",
          100: "#EBE7F7",
          200: "#D5CEF0",
          300: "#B8ACE3",
          400: "#9E90D4",
          500: "#8B7EC8",
          600: "#6F60B0",
          700: "#594D8E",
          800: "#463D6F",
          900: "#332D50",
        },
        // Keep functional colors
        accent: {
          green: "#4A9E6B",
          red: "#C75450",
          yellow: "#C4982A",
          blue: "#4A7FB5",
        },
      },
      fontFamily: {
        serif: ["Playfair Display", "Georgia", "Times New Roman", "serif"],
        sans: ["DM Sans", "system-ui", "-apple-system", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
      fontSize: {
        "2xs": ["0.625rem", { lineHeight: "0.875rem" }],
        "display-1": ["3.5rem", { lineHeight: "1.1", letterSpacing: "-0.02em" }],
        "display-2": ["2.5rem", { lineHeight: "1.15", letterSpacing: "-0.015em" }],
        "heading-1": ["2rem", { lineHeight: "1.2", letterSpacing: "-0.01em" }],
        "heading-2": ["1.5rem", { lineHeight: "1.3", letterSpacing: "-0.005em" }],
        "heading-3": ["1.25rem", { lineHeight: "1.4" }],
        "body-lg": ["1.125rem", { lineHeight: "1.7" }],
        "body": ["1rem", { lineHeight: "1.7" }],
        "body-sm": ["0.875rem", { lineHeight: "1.6" }],
        "caption": ["0.8125rem", { lineHeight: "1.5" }],
      },
      maxWidth: {
        "reading": "65ch",
        "content": "72rem",
      },
      animation: {
        "fade-in": "fadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
        "fade-up": "fadeUp 0.5s cubic-bezier(0.16, 1, 0.3, 1)",
        "slide-in": "slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
        "scale-in": "scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideIn: {
          "0%": { opacity: "0", transform: "translateY(-4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        scaleIn: {
          "0%": { opacity: "0", transform: "scale(0.97)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
      },
      boxShadow: {
        "warm-sm": "0 1px 3px rgba(26, 26, 26, 0.04), 0 1px 2px rgba(26, 26, 26, 0.03)",
        "warm": "0 4px 12px rgba(26, 26, 26, 0.05), 0 1px 3px rgba(26, 26, 26, 0.04)",
        "warm-lg": "0 12px 32px rgba(26, 26, 26, 0.08), 0 4px 8px rgba(26, 26, 26, 0.04)",
        "warm-xl": "0 24px 48px rgba(26, 26, 26, 0.1), 0 8px 16px rgba(26, 26, 26, 0.05)",
        "editorial": "0 1px 0 rgba(26, 26, 26, 0.05)",
      },
      borderRadius: {
        "editorial": "0.625rem",
        "subtle": "0.25rem",
      },
      borderWidth: {
        "hairline": "0.5px",
      },
      spacing: {
        "18": "4.5rem",
        "88": "22rem",
      },
    },
  },
  plugins: [],
};

export default config;
