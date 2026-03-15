/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        // Music-inspired color palette
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
        // Custom music theme colors
        beat: {
          purple: "#8B5CF6",
          pink: "#EC4899",
          blue: "#3B82F6",
          cyan: "#06B6D4",
          orange: "#F97316",
          yellow: "#EAB308",
        },
        vinyl: {
          dark: "#0A0A0B",
          gray: "#1A1A1D",
          light: "#2A2A2D",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: 0 },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: 0 },
        },
        "pulse-glow": {
          "0%, 100%": {
            boxShadow: "0 0 20px rgba(139, 92, 246, 0.5)",
          },
          "50%": {
            boxShadow: "0 0 40px rgba(139, 92, 246, 0.8)",
          },
        },
        "waveform": {
          "0%, 100%": { height: "20%" },
          "50%": { height: "100%" },
        },
        "spin-slow": {
          from: { transform: "rotate(0deg)" },
          to: { transform: "rotate(360deg)" },
        },
        "bounce-subtle": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-5px)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "pulse-glow": "pulse-glow 2s ease-in-out infinite",
        "waveform": "waveform 0.5s ease-in-out infinite",
        "spin-slow": "spin-slow 3s linear infinite",
        "bounce-subtle": "bounce-subtle 1s ease-in-out infinite",
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "music-gradient": "linear-gradient(135deg, #8B5CF6 0%, #EC4899 50%, #F97316 100%)",
        "vinyl-gradient": "linear-gradient(135deg, #1A1A1D 0%, #0A0A0B 100%)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
