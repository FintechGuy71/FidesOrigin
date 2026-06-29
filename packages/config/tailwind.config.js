/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './apps/web/app/**/*.{js,ts,jsx,tsx,mdx}',
    './apps/web/components/**/*.{js,ts,jsx,tsx,mdx}',
    './packages/ui/src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        gray: {
          50: '#f8f8f8',
          100: '#e5e5e5',
          200: '#d4d4d4',
          300: '#a3a3a3',
          400: '#737373',
          500: '#525252',
          600: '#404040',
          700: '#262626',
          800: '#171717',
          900: '#0a0a0a',
          950: '#030712',
        },
        indigo: {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
          950: '#1e1b4b',
        },
      },
      fontFamily: {
        inter: ['var(--font-inter)', 'sans-serif'],
        nacelle: ['var(--font-nacelle)', 'sans-serif'],
      },
      fontSize: {
        xs: ['0.8125rem', { lineHeight: '1.5384' }],
        sm: ['0.875rem', { lineHeight: '1.5715' }],
        base: ['0.9375rem', { lineHeight: '1.5333', letterSpacing: '-0.0125em' }],
        lg: ['1.125rem', { lineHeight: '1.5', letterSpacing: '-0.0125em' }],
        xl: ['1.25rem', { lineHeight: '1.5', letterSpacing: '-0.0125em' }],
        '2xl': ['1.5rem', { lineHeight: '1.415', letterSpacing: '-0.0268em' }],
        '3xl': ['1.75rem', { lineHeight: '1.3571', letterSpacing: '-0.0268em' }],
        '4xl': ['2.5rem', { lineHeight: '1.1', letterSpacing: '-0.0268em' }],
        '5xl': ['3.5rem', { lineHeight: '1', letterSpacing: '-0.0268em' }],
        '6xl': ['4rem', { lineHeight: '1', letterSpacing: '-0.0268em' }],
        '7xl': ['4.5rem', { lineHeight: '1', letterSpacing: '-0.0268em' }],
      },
      animation: {
        shine: 'shine 5s ease-in-out 500ms infinite',
        gradient: 'gradient 6s linear infinite',
      },
      keyframes: {
        shine: {
          '0%': { top: '0', transform: 'scaleY(5)', opacity: '0' },
          '10%': { opacity: '1' },
          '20%': { top: '100%', transform: 'scaleY(10)', opacity: '0' },
          '100%': { top: '100%', opacity: '0' },
        },
        gradient: {
          '0%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
          '100%': { backgroundPosition: '0% 50%' },
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
      },
    },
  },
  plugins: [],
};
