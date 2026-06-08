/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        roche: {
          DEFAULT: "#0066CC",
          dark: "#0052A3",
          light: "#E8F4FD",
          "user-bubble": "#E8F0FE",
        },
      },
    },
  },
  plugins: [],
};
