import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      colors: {
        violet: {
          950: '#1a0a3d',
        },
      },
      animation: {
        'spin-slow': 'spin 2s linear infinite',
        'fade-in-up': 'fade-in-up 0.4s ease-out forwards',
        'pulse-ring': 'pulse-ring 1.5s ease-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
