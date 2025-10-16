/************
 Note: Keep comments as-is per instructions not to alter comments unless asked.
*************/
/** @type {import('tailwindcss').Config} */
import forms from '@tailwindcss/forms'
export default {
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [forms],
}
