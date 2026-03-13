/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        "atomic-tangerine": {
          50: "#feede7",
          100: "#fcdccf",
          200: "#f9b89f",
          300: "#f7956e",
          400: "#f4723e",
          500: "#f14e0e",
          600: "#c13f0b",
          700: "#912f08",
          800: "#601f06",
          900: "#301003",
          950: "#220b02",
        },
        "fresh-sky": {
          50: "#e8f6fc",
          100: "#d2ecf9",
          200: "#a5d9f3",
          300: "#78c6ed",
          400: "#4ab3e8",
          500: "#1da0e2",
          600: "#1780b5",
          700: "#126087",
          800: "#0c405a",
          900: "#06202d",
          950: "#041620",
        },
        "muted-olive": {
          50: "#f5f8ed",
          100: "#ebf0db",
          200: "#d6e2b6",
          300: "#c2d392",
          400: "#adc56d",
          500: "#99b649",
          600: "#7a923a",
          700: "#5c6d2c",
          800: "#3d491d",
          900: "#1f240f",
          950: "#151a0a",
        },
      },
    },
  },
  plugins: [],
};
