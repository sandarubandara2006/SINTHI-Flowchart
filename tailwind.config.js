/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Symbol palette colors (loosely echoing RAPTOR's conventions)
        sym: {
          io: '#dbeafe', // input/output parallelograms
          assign: '#dcfce7', // assignment rectangles
          call: '#fef9c3', // call rectangles
          select: '#fae8ff', // selection diamonds
          loop: '#ffedd5', // loop ovals
          terminal: '#e5e7eb', // start/end
        },
      },
    },
  },
  plugins: [],
};
