/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  theme: {
    extend: {
      screens: {
        'xs': '425px',
        '3xl': '1600px'
      }
    },
  },
  plugins: [],
}
