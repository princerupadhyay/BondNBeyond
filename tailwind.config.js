/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Dark mode
        ink: {
          950: '#0B0B0B',
          900: '#111111',
          800: '#171717',
          700: '#1F1F1F',
          600: '#262626',
        },
        // Brand
        primary: {
          50: '#FFF7ED',
          100: '#FFEDD5',
          200: '#FED7AA',
          300: '#FDBA74',
          400: '#FB923C',
          500: '#F97316',
          600: '#EA580C',
          700: '#C2410C',
          800: '#9A3412',
          900: '#7C2D12',
        },
        accent: {
          400: '#F43F5E',
          500: '#E11D48',
          600: '#BE123C',
          700: '#9F1239',
        },
        success: {
          400: '#34D399',
          500: '#10B981',
          600: '#059669',
        },
        warning: {
          400: '#FBBF24',
          500: '#F59E0B',
          600: '#D97706',
        },
        danger: {
          400: '#F87171',
          500: '#EF4444',
          600: '#DC2626',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', 'Inter', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      backgroundImage: {
        'gradient-warm': 'linear-gradient(135deg, #F97316 0%, #E11D48 100%)',
        'gradient-warm-soft': 'linear-gradient(135deg, rgba(249,115,22,0.15) 0%, rgba(225,29,72,0.15) 100%)',
        'glass-dark': 'linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)',
      },
      boxShadow: {
        'glow-orange': '0 0 40px -10px rgba(249,115,22,0.45)',
        'glow-crimson': '0 0 40px -10px rgba(225,29,72,0.45)',
        'glow-emerald': '0 0 40px -10px rgba(16,185,129,0.45)',
        'card-dark': '0 4px 24px -4px rgba(0,0,0,0.5), 0 0 1px rgba(255,255,255,0.06) inset',
        'card-light': '0 4px 24px -8px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
        '4xl': '2rem',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-12px)' },
        },
        'pulse-glow': {
          '0%, 100%': { opacity: '0.6' },
          '50%': { opacity: '1' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.5s ease-out',
        'slide-up': 'slide-up 0.5s ease-out',
        'float': 'float 6s ease-in-out infinite',
        'pulse-glow': 'pulse-glow 3s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
      },
    },
  },
  plugins: [],
};
