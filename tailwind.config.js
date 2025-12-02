/** @type {import('tailwindcss').Config} */
import tailwindAnimate from "tailwindcss-animate";

export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#010333",
          foreground: "#e5e7ff"
        },
        accent: {
          DEFAULT: "#3b82f6",
          foreground: "#031228"
        }
      },
      borderRadius: {
        xl: "1rem",
        '2xl': "1.25rem"
      },
      backgroundImage: {
        'grid': "radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)",
        'glass': "linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02))"
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out'
      },
      keyframes: {
        'accordion-down': {
          from: { height: 0 },
          to: { height: 'var(--radix-accordion-content-height)' }
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: 0 }
        }
      }
    },
  },
  plugins: [tailwindAnimate],
}

