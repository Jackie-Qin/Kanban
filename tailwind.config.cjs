/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        dark: {
          bg: '#1a1a1a',
          card: '#242424',
          border: '#3a3a3a',
          hover: '#2d2d2d',
          text: '#e0e0e0',
          muted: '#888888',
        }
      }
    },
  },
  plugins: [],
}
