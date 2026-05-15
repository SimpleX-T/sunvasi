import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class", '[data-theme="dark"]'],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        "bg-elevated": "var(--bg-elevated)",
        "bg-subtle": "var(--bg-subtle)",
        border: "var(--border)",
        "border-strong": "var(--border-strong)",
        fg: "var(--fg)",
        "fg-muted": "var(--fg-muted)",
        "fg-subtle": "var(--fg-subtle)",
        accent: {
          DEFAULT: "var(--accent)",
          hover: "var(--accent-hover)",
          fg: "var(--accent-fg)",
        },
        success: "var(--success)",
        warning: "var(--warning)",
        danger: "var(--danger)",
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      fontSize: {
        "display-2xl": [
          "clamp(3.5rem, 8vw, 6rem)",
          { lineHeight: "0.95", letterSpacing: "-0.025em", fontWeight: "400" },
        ],
        "display-xl": [
          "clamp(2.5rem, 5vw, 4rem)",
          { lineHeight: "1", letterSpacing: "-0.02em", fontWeight: "400" },
        ],
        "display-lg": [
          "clamp(2rem, 3.5vw, 3rem)",
          { lineHeight: "1.05", letterSpacing: "-0.02em", fontWeight: "500" },
        ],
        "display-md": [
          "1.75rem",
          { lineHeight: "1.15", letterSpacing: "-0.015em", fontWeight: "500" },
        ],
        "display-sm": [
          "1.25rem",
          { lineHeight: "1.2", letterSpacing: "-0.01em", fontWeight: "500" },
        ],
        "body-lg": ["1.125rem", { lineHeight: "1.55", fontWeight: "400" }],
        body: ["1rem", { lineHeight: "1.55", fontWeight: "400" }],
        "body-sm": ["0.875rem", { lineHeight: "1.5", fontWeight: "400" }],
        caption: [
          "0.75rem",
          { lineHeight: "1.4", letterSpacing: "0.04em", fontWeight: "500" },
        ],
        "mono-lg": ["1.125rem", { lineHeight: "1.5", fontWeight: "500" }],
        mono: ["0.9375rem", { lineHeight: "1.5", fontWeight: "400" }],
        "mono-sm": ["0.8125rem", { lineHeight: "1.45", fontWeight: "400" }],
      },
      borderRadius: {
        sm: "2px",
        DEFAULT: "4px",
        md: "4px",
        lg: "8px",
        xl: "12px",
      },
      transitionTimingFunction: {
        sunvasi: "cubic-bezier(0.32, 0.72, 0, 1)",
      },
      transitionDuration: {
        sunvasi: "250ms",
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in-slow": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        // For elements already centered with `-translate-(x|y)-1/2`. Keeps
        // the centering translate in the keyframe so animation-fill-mode:both
        // doesn't override Tailwind's translate utilities.
        "dialog-in": {
          "0%": {
            opacity: "0",
            transform: "translate(-50%, calc(-50% + 6px)) scale(0.985)",
          },
          "100%": {
            opacity: "1",
            transform: "translate(-50%, -50%) scale(1)",
          },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "caret-blink": {
          "0%, 70%, 100%": { opacity: "1" },
          "20%, 50%": { opacity: "0" },
        },
      },
      animation: {
        "fade-in": "fade-in 400ms cubic-bezier(0.32, 0.72, 0, 1) both",
        "fade-in-slow": "fade-in-slow 600ms cubic-bezier(0.32, 0.72, 0, 1) both",
        "dialog-in": "dialog-in 280ms cubic-bezier(0.32, 0.72, 0, 1) both",
        shimmer: "shimmer 1.8s linear infinite",
        "caret-blink": "caret-blink 1.2s ease-in-out infinite",
      },
      boxShadow: {
        modal: "0 24px 48px -12px rgba(0,0,0,0.4)",
        popover: "0 12px 32px -8px rgba(0,0,0,0.35)",
      },
      maxWidth: {
        prose: "62ch",
        editorial: "72ch",
      },
    },
  },
  plugins: [],
};

export default config;
