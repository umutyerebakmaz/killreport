/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx}",
    "./app/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          400: '#5CCBCB',
          500: '#36b3b3',
          600: '#249393',
        },
        'custom-dark': '#101010',
        'custom-dark-90': 'rgba(16, 16, 16, 0.9)',
      },
      fontFamily: {
        sans: ['Shentox', 'Mona Sans', 'Arial', 'Helvetica', 'sans-serif'],
        shentox: ['Shentox', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
