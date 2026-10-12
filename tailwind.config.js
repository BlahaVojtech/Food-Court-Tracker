/** Tailwind — barvy jsou design tokeny (viz :root ve styles.css).
 *  Build:  npm run build:css */
module.exports = {
  content: ['./index.html', './app.js'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Figtree', 'system-ui', 'Segoe UI', 'sans-serif'],
        display: ['"Barlow Condensed"', 'Figtree', 'system-ui', 'sans-serif'],
      },
      colors: {
        paper: '#faf8f5',
        canvas: '#f1eee9',
        ink: '#26231f',
        ink2: '#6b655d',
        ink3: '#9a948b',
        line: '#e4dfd7',
        line2: '#cfc8bc',
        accent: '#a28d76',
        accentink: '#6f5d49',
        yes: '#3b8559',
        no: '#c0453a',
      },
      keyframes: {
        slideup: { '0%': { transform: 'translateY(8px)', opacity: 0 }, '100%': { transform: 'translateY(0)', opacity: 1 } },
      },
      animation: { slideup: 'slideup .16s ease-out' },
    },
  },
};
