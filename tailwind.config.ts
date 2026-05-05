import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // ── Electric brand palette ─────────────────────────────
        brand: {
          DEFAULT: "#06B6D4",   // cyan-500
          light:   "rgba(6,182,212,0.12)",
          dark:    "#0891B2",   // cyan-600
          glow:    "rgba(6,182,212,0.25)",
        },
        electric: {
          cyan:  "#22D3EE",    // cyan-400
          blue:  "#3B82F6",    // blue-500
          indigo:"#6366F1",    // indigo-500
        },
        // ── Dark surface stack ────────────────────────────────
        void:    "#05050A",    // deepest background
        surface: {
          DEFAULT: "#0D0D18",
          raised:  "#12121F",
          overlay: "#181828",
        },
        // ── shadcn tokens (HSL, dark-first) ──────────────────
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        border:     "hsl(var(--border))",
        input:      "hsl(var(--input))",
        ring:       "hsl(var(--ring))",
        card: {
          DEFAULT:    "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT:    "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT:    "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT:    "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT:    "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT:    "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT:    "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans:    ["var(--font-sans)", "system-ui", "sans-serif"],
        heading: ["var(--font-heading)", "Georgia", "serif"],
      },
      backgroundImage: {
        "electric-gradient": "linear-gradient(135deg, #22D3EE 0%, #3B82F6 100%)",
        "electric-gradient-subtle": "linear-gradient(135deg, rgba(34,211,238,0.15) 0%, rgba(59,130,246,0.15) 100%)",
        "radial-glow-cyan": "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(6,182,212,0.25) 0%, transparent 60%)",
        "radial-glow-blue": "radial-gradient(ellipse 60% 40% at 80% 80%, rgba(59,130,246,0.2) 0%, transparent 60%)",
      },
      boxShadow: {
        "glow-cyan":  "0 0 20px rgba(6,182,212,0.35), 0 0 60px rgba(6,182,212,0.1)",
        "glow-blue":  "0 0 20px rgba(59,130,246,0.35), 0 0 60px rgba(59,130,246,0.1)",
        "glow-sm":    "0 0 12px rgba(6,182,212,0.25)",
        "glass":      "0 4px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)",
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4,0,0.6,1) infinite",
        "glow":       "glow 2s ease-in-out infinite alternate",
      },
      keyframes: {
        glow: {
          from: { boxShadow: "0 0 10px rgba(6,182,212,0.2)" },
          to:   { boxShadow: "0 0 25px rgba(6,182,212,0.5), 0 0 50px rgba(6,182,212,0.2)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
