/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#1565c0",
          50: "#e8f1fb",
          100: "#c5dcf5",
          500: "#1976d2",
          600: "#1565c0",
          700: "#0d47a1",
          900: "#082a5e",
        },
        secondary: {
          DEFAULT: "#00897b",
          50: "#e3f2f0",
          100: "#b2dfdb",
          500: "#009688",
          600: "#00897b",
          700: "#00695c",
          900: "#004d40",
        },
        surface: {
          DEFAULT: "#ffffff",
          50: "#fafafa",
          100: "#f5f5f5",
          500: "#9e9e9e",
          700: "#424242",
          900: "#212121",
        },
        success: {
          DEFAULT: "#2e7d32",
          50: "#e8f5e9",
          100: "#c8e6c9",
          500: "#4caf50",
          600: "#2e7d32",
          700: "#1b5e20",
        },
        error: {
          DEFAULT: "#c62828",
          50: "#fdecea",
          100: "#f9c6c2",
          500: "#e53935",
          600: "#c62828",
          700: "#b71c1c",
        },
        warning: {
          DEFAULT: "#ef6c00",
          50: "#fff3e0",
          100: "#ffe0b2",
          500: "#ff9800",
          600: "#ef6c00",
          700: "#e65100",
        },
      },
      borderRadius: {
        DEFAULT: "0.375rem",
      },
    },
  },
  plugins: [],
};
