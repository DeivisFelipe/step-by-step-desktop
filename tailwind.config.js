/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/renderer/index.html",
    "./src/renderer/src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#3794ff',
        'primary-hover': '#1e80f0',
        surface: '#252526',
        'border-custom': '#3c3c3c',
      }
    },
  },
  plugins: [],
}
