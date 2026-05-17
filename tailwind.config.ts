import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        // "Keep it Cutre": tipografías funcionales, pixeladas cuando toque
        pixel: ['"Press Start 2P"', 'monospace'],
        zomboid: ['"VCR OSD Mono"', 'monospace'],
        cozy: ['system-ui', 'sans-serif'],
      },
      colors: {
        // Paleta base Cutre — se puede ampliar por habitación
        flat: {
          bg: '#0b0c10',
          ink: '#e8e6df',
          accent: '#ff5c8a', // rosa tipo Jinx
          secondary: '#5eead4',
          warning: '#fbbf24',
        },
      },
      imageRendering: {
        pixelated: 'pixelated',
      },
    },
  },
  plugins: [],
};

export default config;
