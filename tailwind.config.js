/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Palette derived from the NOVA SEVERI logo
        night: {
          950: "#040A18", // deepest background
          900: "#071022",
          800: "#0B1730",
          700: "#0F2040",
        },
        azure: {
          600: "#1E4FD6",
          500: "#2C63F2",
          400: "#4F7CFF",
          300: "#8FACFF",
        },
        gold: {
          500: "#C6A23C", // logo star gold
          400: "#D8B65A",
          300: "#EAD494",
        },
        mist: "#F4F5F7",
      },
      fontFamily: {
        display: ["'Fraunces'", "serif"],
        sans: ["'Inter'", "system-ui", "sans-serif"],
      },
      boxShadow: {
        gold: "0 0 40px -10px rgba(198, 162, 60, 0.45)",
        azure: "0 0 60px -15px rgba(44, 99, 242, 0.55)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(14px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "check-pop": {
          "0%": { transform: "scale(0.6)", opacity: "0" },
          "60%": { transform: "scale(1.08)", opacity: "1" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        drift: {
          "0%, 100%": { transform: "translate3d(0,0,0)" },
          "50%": { transform: "translate3d(2%, -3%, 0)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.7s cubic-bezier(0.16,1,0.3,1) both",
        "check-pop": "check-pop 0.5s cubic-bezier(0.16,1,0.3,1) both",
        drift: "drift 22s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
