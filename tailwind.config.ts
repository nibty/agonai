import type { Config } from "tailwindcss";
import flowbite from "flowbite/plugin";

export default {
  content: [
    "./src/web/index.html",
    "./src/web/components/**/*.{ts,tsx}",
    "./src/web/hooks/**/*.{ts,tsx}",
    "./src/web/lib/**/*.{ts,tsx}",
    "./src/web/routes/**/*.{ts,tsx}",
    "./src/web/*.{ts,tsx}",
    "./node_modules/flowbite-react/lib/esm/**/*.js",
  ],
  theme: {
    extend: {
      colors: {
        // CSS variable-based colors (shadcn/ui style)
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // X1 brand colors
        x1: {
          50: "#f0f9ff",
          100: "#e0f2fe",
          200: "#bae6fd",
          300: "#7dd3fc",
          400: "#38bdf8",
          500: "#0ea5e9",
          600: "#0284c7",
          700: "#0369a1",
          800: "#075985",
          900: "#0c4a6e",
          950: "#082f49",
        },
        // Arena theme (CSS variable-based for theming)
        arena: {
          bg: "hsl(var(--arena-bg))",
          card: "hsl(var(--arena-card))",
          border: "hsl(var(--arena-border))",
          accent: "hsl(var(--arena-accent))",
          "accent-light": "hsl(var(--arena-accent-light))",
          pro: "hsl(var(--arena-pro))",
          con: "hsl(var(--arena-con))",
          text: "hsl(var(--arena-text))",
          "text-muted": "hsl(var(--arena-text-muted))",
          "text-dim": "hsl(var(--arena-text-dim))",
          voting: "hsl(var(--arena-voting))",
          gold: "hsl(var(--arena-gold))",
          silver: "hsl(var(--arena-silver))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "glow": "glow 2s ease-in-out infinite alternate",
      },
      keyframes: {
        glow: {
          "0%": { boxShadow: "0 0 5px rgba(99, 102, 241, 0.5)" },
          "100%": { boxShadow: "0 0 20px rgba(99, 102, 241, 0.8)" },
        },
      },
    },
  },
  plugins: [flowbite],
  darkMode: "class",
} satisfies Config;
