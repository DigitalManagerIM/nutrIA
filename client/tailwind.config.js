/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#00B4D8',
        'primary-dark': '#0096B7',
        secondary: '#58CC02',
        'secondary-dark': '#45A300',
        accent: '#FF9600',
        alert: '#FF4B4B',
        gold: '#FFC800',
        'nuri-brown': '#8B6914',
        'bg-light': '#F0F9FF',
      },
      fontFamily: {
        nunito: ['Nunito', 'sans-serif'],
      },
      borderRadius: {
        card: '16px',
      },
      maxWidth: {
        app: '480px',
      },
      boxShadow: {
        card: '0 4px 16px rgba(0,0,0,0.08)',
        'card-hover': '0 8px 24px rgba(0,0,0,0.12)',
      },
    },
  },
  plugins: [],
};
