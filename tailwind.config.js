/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // token tema (mengikuti data-theme): gunakan text-fg, bg-bg, bg-card, border-fg/10, dst.
        bg: 'rgb(var(--bg-rgb) / <alpha-value>)',
        fg: 'rgb(var(--fg-rgb) / <alpha-value>)',
        card: 'rgb(var(--card-rgb) / <alpha-value>)',
        raised: 'rgb(var(--raised-rgb) / <alpha-value>)',
        flame: '#ff7a1a',
        'nm-bg': '#1a1b22',
        'nm-card': '#20222c',
        'nm-dock': '#1c1e26',
      },
      fontFamily: {
        sans: ['"Figtree Variable"', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['"Unbounded Variable"', '"Figtree Variable"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
