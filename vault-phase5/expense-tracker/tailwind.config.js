/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        vault: {
          bg: '#080C18',
          card: '#0F1629',
          surface: '#151E35',
          border: '#1E2D4F',
          muted: '#2A3A5C',
          text: '#8899BB',
          gold: '#F0A500',
          'gold-light': '#FFD166',
          mint: '#06D6A0',
          rose: '#FF6B6B',
          blue: '#4CC9F0',
          purple: '#9B5DE5',
        }
      },
      fontFamily: {
        display: ['"DM Serif Display"', 'Georgia', 'serif'],
        body: ['"DM Sans"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      animation: {
        'fade-up': 'fadeUp 0.4s ease-out',
        'slide-in': 'slideIn 0.3s ease-out',
        'pulse-gold': 'pulseGold 2s ease-in-out infinite',
      },
      keyframes: {
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideIn: {
          '0%': { opacity: '0', transform: 'translateX(-12px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        pulseGold: {
          '0%, 100%': { boxShadow: '0 0 10px rgba(240, 165, 0, 0.3)' },
          '50%': { boxShadow: '0 0 25px rgba(240, 165, 0, 0.6)' },
        },
      },
    },
  },
  plugins: [],
}

