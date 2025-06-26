/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'bunganut': {
          'coral': '#F2A2A1',
          'sage': '#769575',
          'burgundy': '#AA4D4F',
        }
      },
      fontFamily: {
        'heading': ['Roboto Slab', 'serif'],
        'subheading': ['Exo', 'sans-serif'],
        'body': ['Martel', 'serif'],
      },
      spacing: {
        '18': '4.5rem', // 72px
        '88': '22rem',  // 352px
        '128': '32rem', // 512px
      },
      borderRadius: {
        'xl': '1rem',
        '2xl': '1.5rem',
      },
      boxShadow: {
        'soft': '0 2px 15px -3px rgba(0, 0, 0, 0.07), 0 10px 20px -2px rgba(0, 0, 0, 0.04)',
        'medium': '0 4px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
      }
    },
  },
  plugins: [],
} 