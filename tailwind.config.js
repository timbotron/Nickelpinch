/** @type {import('tailwindcss').Config} */
// Nickelpinch styling: Hangar draws the components; Tailwind is layout utilities plus
// colour names aliased onto Hangar's --hud-* tokens (see tailwind/input.css). Dark is
// the default; light applies under [data-theme="light"]. Built with the standalone CLI
// (no JS build step): see README / bin/tailwindcss.
module.exports = {
  darkMode: ['selector', '[data-theme="dark"]'],
  content: [
    './templates/**/*.php',
    './public/js/**/*.js',
  ],
  theme: {
    extend: {
      // Colour utilities alias Hangar's tokens (CODE-394), so text-muted, border-line
      // etc. theme with Hangar; --np-canvas is the page behind the panels.
      colors: {
        accent: 'var(--hud-accent)',
        app: 'var(--np-canvas)',
        fg: 'var(--hud-text-1)',
        muted: 'var(--hud-text-2)',
        line: 'var(--hud-line-1)',
      },
      fontFamily: {
        sans: ['"Hanken Grotesk"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
}
