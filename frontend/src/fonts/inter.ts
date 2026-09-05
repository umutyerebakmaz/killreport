import localFont from 'next/font/local';

/**
 * InterVariable, the face Tailwind Plus self-hosts (rsms.me, v4.66).
 *
 * Both faces are needed: the app sets `italic` in six places, and with the
 * roman alone the browser synthesises an oblique. One file covers every
 * weight because it is variable — Shentox needed 56.
 */
export const inter = localFont({
  src: [
    { path: './InterVariable.woff2', weight: '100 900', style: 'normal' },
    {
      path: './InterVariable-Italic.woff2',
      weight: '100 900',
      style: 'italic',
    },
  ],
  variable: '--font-inter',
  display: 'swap',
});
