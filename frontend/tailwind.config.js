/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Roche brand-ish blue accent.
        roche: {
          DEFAULT: "#0b41cd",
          dark: "#082f93",
          light: "#e8eefc",
        },
      },
    },
  },
  plugins: [],
};
