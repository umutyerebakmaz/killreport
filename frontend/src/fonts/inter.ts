import localFont from 'next/font/local';

/**
 * Tailwind Plus'ın self-host ettiği InterVariable (rsms.me, v4.66).
 *
 * İki yüz gerekiyor: uygulama altı yerde `italic` kullanıyor ve tek yüzle
 * tarayıcı sahte eğik üretir. Variable font 100-900 aralığının tamamını
 * taşıdığı için ağırlık başına ayrı dosya yok — Shentox'ta 56 dosya vardı.
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
