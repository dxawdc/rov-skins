/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Orbitron', 'Noto Sans SC', 'sans-serif'],
        body: ['Rajdhani', 'Noto Sans SC', 'sans-serif'],
      },
      colors: {
        void: '#080b12',
        panel: '#101827',
        cyanfire: '#00d5ff',
        goldcore: '#f6c85f',
        rovpink: '#ff4d8d',
        arcane: '#7c5cff',
      },
      boxShadow: {
        neon: '0 0 24px rgba(0, 213, 255, 0.25)',
        gold: '0 0 24px rgba(246, 200, 95, 0.22)',
      },
    },
  },
  plugins: [],
};
