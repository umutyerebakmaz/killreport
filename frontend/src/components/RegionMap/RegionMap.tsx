'use client';

import { regionMapUrl } from '@/utils/regionMapUrl';
import { useState } from 'react';

export interface RegionMapProps {
  regionId: number;
  regionName: string;
  /** Kenar uzunluğu, piksel. Görsel vektör: her boyutta net çıkar. */
  size: number;
  className?: string;
}

/**
 * Bir bölgenin yıldız haritası. Zemini şeffaftır, o yüzden altındaki yüzeyi
 * alır — kart, sayfa, ya da fareyle üstüne gelinmiş satır.
 *
 * Dosya yoksa bileşen kendini kaldırır. Bu ancak SDE güncellemesiyle yeni bir
 * bölge gelip script'in çalıştırılmamasıyla olur; kırık görsel ikonu
 * göstermektense hiçbir şey göstermemek doğru.
 */
export default function RegionMap({
  regionId,
  regionName,
  size,
  className,
}: RegionMapProps) {
  const [missing, setMissing] = useState(false);
  if (missing) return null;

  return (
    <img
      src={regionMapUrl(regionId)}
      alt={`${regionName} map`}
      width={size}
      height={size}
      className={className}
      onError={() => setMissing(true)}
    />
  );
}
