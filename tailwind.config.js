/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Cobrizo PELGY — color principal de marca
        brand: {
          DEFAULT: "#A87E5A",
          light: "#C9A47E",
          dark: "#7A5A3D",
          darker: "#4F3A26",
        },
        // Crema/beige para fondos
        cream: {
          50: "#FBF7EE",
          100: "#F8F1E5",
          200: "#EFE3D0",
          300: "#E8DCC8",
          400: "#D9C7AC",
        },
        // Texto
        ink: {
          DEFAULT: "#3D2817",
          muted: "#8B7355",
          light: "#B8A28A",
        },
      },
      fontFamily: {
        serif: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "-apple-system", "sans-serif"],
      },
      minHeight: {
        touch: "60px",
      },
      minWidth: {
        touch: "60px",
      },
      letterSpacing: {
        wider: "0.08em",
        widest: "0.18em",
      },
    },
  },
  plugins: [],
};
