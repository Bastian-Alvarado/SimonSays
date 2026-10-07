/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Ported verbatim from the `tailwind.config = {...}` block that used to sit
 * inline in index.html alongside the cdn.tailwindcss.com script tag.
 *
 * Why this file exists: the CDN build compiles CSS in the browser on every
 * page load by watching the DOM. That made the whole app — including the OBS
 * chat dock and alert overlay — depend on reaching a third-party host at
 * render time. A CDN hiccup meant an unstyled overlay on-air.
 *
 * `content` deliberately includes constants.ts: the theme definitions there
 * hold complete class strings (`bg-zinc-900/40`, `border-amber-900/30`) that
 * never appear in any JSX, so the scanner has to read that file to emit them.
 */

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  // Top-level glob only (`./*`), so node_modules and dist are never walked.
  content: [
    './index.html',
    './*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './hooks/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Montserrat', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
        creep: ['Creepster', 'cursive'],
        minecraft: ['"VT323"', 'monospace'],
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.5s ease-out',
        'glitch': 'glitch 4s infinite',
        'drip': 'drip 3s infinite',
        'float': 'float 6s ease-in-out infinite',
        'float-delayed': 'float 6s ease-in-out 3s infinite',
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        // Alert entrances and exits. Every stored alert config already names
        // one of these — `animate-pop-in` and `animate-fade-out` were the
        // defaults — but none of them existed, so no alert has ever animated.
        // `forwards` on the exits so a finished alert stays gone rather than
        // snapping back to full opacity for its last frame.
        'pop-in': 'popIn 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)',
        'zoom-in': 'zoomIn 0.4s ease-out',
        'slide-down': 'slideDown 0.45s ease-out',
        'fade-out': 'fadeOut 0.4s ease-in forwards',
        'pop-out': 'popOut 0.35s ease-in forwards',
        'slide-out-up': 'slideOutUp 0.4s ease-in forwards',
        // A value too long for the omnibar, walked past and brought back.
        // The duration is set on the element, because the pace has to be the
        // same whether there are ten pixels too many or three hundred.
        'bar-drift': 'barDrift 12s ease-in-out infinite',
        // The same for a question too tall for its card, upwards: see QuestionOverlay.
        'question-drift': 'questionDrift 12s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        glitch: {
          '0%': { textShadow: '0 0 0 transparent', transform: 'translate(0)' },
          '2%': { textShadow: '-2px 0 #ff0000, 2px 0 #00ffff', transform: 'translate(-2px, 1px)' },
          '4%': { textShadow: '2px 0 #ff0000, -2px 0 #00ffff', transform: 'translate(2px, -1px)' },
          '6%': { textShadow: '0 0 0 transparent', transform: 'translate(0)' },
          '100%': { textShadow: '0 0 0 transparent', transform: 'translate(0)' },
        },
        drip: {
          '0%, 100%': { textShadow: '0 0 2px #7f1d1d' },
          '50%': { textShadow: '0 4px 8px #ef4444' },
        },
        popIn: {
          '0%': { transform: 'scale(0.6)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        zoomIn: {
          '0%': { transform: 'scale(1.35)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-28px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        fadeOut: {
          '0%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
        popOut: {
          '0%': { transform: 'scale(1)', opacity: '1' },
          '100%': { transform: 'scale(0.7)', opacity: '0' },
        },
        slideOutUp: {
          '0%': { transform: 'translateY(0)', opacity: '1' },
          '100%': { transform: 'translateY(-28px)', opacity: '0' },
        },
        // How far to walk is the element's own business, so it says: the
        // distance is a property set on it and read back here.
        barDrift: {
          '0%, 10%': { transform: 'translateX(0)' },
          '45%, 55%': { transform: 'translateX(var(--bar-drift, 0px))' },
          '90%, 100%': { transform: 'translateX(0)' },
        },
        questionDrift: {
          '0%, 10%': { transform: 'translateY(0)' },
          '45%, 55%': { transform: 'translateY(var(--question-drift, 0px))' },
          '90%, 100%': { transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
