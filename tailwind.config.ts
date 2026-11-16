import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        gmail: {
          blue: '#1a73e8',
          'blue-dark': '#1557b0',
          'blue-light': '#e8f0fe',
          red: '#d93025',
          green: '#1e8e3e',
          gray: '#5f6368',
          'gray-light': '#f1f3f4',
          'gray-border': '#dadce0',
          'gray-dark': '#202124',
        },
        rkd: {
          primary: '#c8102e',
          secondary: '#1a1a2e',
        },
      },
      animation: {
        'slide-up': 'slide-up 0.3s ease-out',
        'fade-in': 'fade-in 0.2s ease-out',
        'spin-slow': 'spin 2s linear infinite',
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
};

export default config;
