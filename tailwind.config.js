/** Konfigurace Tailwindu — shodná s dřívějším inline nastavením pro CDN.
 *  Build:  npx tailwindcss -i tailwind.src.css -o tailwind.css --minify
 *  Díky předkompilovanému CSS odpadá ~120 kB blokujícího JS z cdn.tailwindcss.com. */
module.exports = {
  content: ['./index.html', './app.js'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: { sans: ['Inter', 'Segoe UI', 'system-ui', 'sans-serif'] },
      colors: {
        ink: { 900: '#0b1020', 800: '#111830', 700: '#1a2340', 600: '#243055' },
        brand: { 400: '#ffb43a', 500: '#ff9500', 600: '#e07b00' },
      },
      keyframes: {
        pop: { '0%': { transform: 'scale(.6)', opacity: 0 }, '70%': { transform: 'scale(1.15)' }, '100%': { transform: 'scale(1)', opacity: 1 } },
        slideup: { '0%': { transform: 'translateY(16px)', opacity: 0 }, '100%': { transform: 'translateY(0)', opacity: 1 } },
      },
      animation: { pop: 'pop .28s ease-out', slideup: 'slideup .22s ease-out' },
    },
  },
};
