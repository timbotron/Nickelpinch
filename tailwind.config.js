/** @type {import('tailwindcss').Config} */
// Nickelpinch styling. Semantic colors are CSS variables (see tailwind/input.css),
// so one set of component rules themes light/dark by flipping the variables. Dark
// is the default (:root); light applies under [data-theme="light"]. Built with the
// standalone CLI (no JS build step): see README / bin/tailwindcss.
module.exports = {
  darkMode: ['selector', '[data-theme="dark"]'],
  content: [
    './templates/**/*.php',
    './public/js/**/*.js',
  ],
  theme: {
    extend: {
      colors: {
        accent: 'var(--accent)',
        'accent-fg': 'var(--accent-fg)',
        'accent-soft': 'var(--accent-soft)',
        app: 'var(--bg)',
        surface: 'var(--surface)',
        elev: 'var(--elev)',
        fg: 'var(--fg)',
        muted: 'var(--muted)',
        line: 'var(--border)',
      },
      fontFamily: {
        sans: ['"Hanken Grotesk"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
}
