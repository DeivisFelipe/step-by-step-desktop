/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ide: {
          bg: '#1e1e1e',
          panel: '#252526',
          tab: '#2d2d2d',
          input: '#3c3c3c',
          border: '#3e3e42',
          hover: '#2a2d2e',
          active: '#37373d',
          select: '#094771',
          accent: '#007acc',
          text: '#cccccc',
          muted: '#858585'
        }
      }
    }
  },
  plugins: []
}
