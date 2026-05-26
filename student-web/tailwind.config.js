/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Sora', 'ui-sans-serif', 'system-ui']
      },
      colors: {
        ink: '#0e1726',
        haze: '#f4f7ff',
        coral: '#ff7f50',
        teal: '#1f9d8b'
      },
      boxShadow: {
        soft: '0 10px 35px -12px rgba(14, 23, 38, 0.18)'
      }
    }
  },
  plugins: []
};
