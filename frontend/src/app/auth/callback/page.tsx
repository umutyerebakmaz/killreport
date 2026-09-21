'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect } from 'react';

/**
 * EVE SSO Callback Handler
 *
 * Bu sayfa EVE SSO'dan gelen callback'i yakalayıp backend'e yönlendirir.
 * Production'da EVE Developer Application callback URL'i bu sayfaya işaret
 * ediyorsa (frontend domain'i) devreye girer; `EVE_CALLBACK_URL` doğrudan
 * backend'i gösterdiğinde buraya hiç uğranmaz.
 *
 * Hiçbir şey çizmez. Bir yönlendirmenin görünür bir duraklaması olmamalı:
 * kullanıcı EVE'den çıkıp basmış olduğu sayfada belirir, arada bir kart ya da
 * spinner görmez.
 */
function AuthCallbackContent() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');

    if (code && state) {
      // Backend'e yönlendir - backend token exchange yapıp kullanıcıyı login'e
      // basılan sayfaya geri gönderecek.
      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';
      window.location.href = `${backendUrl}/auth/callback?code=${code}&state=${state}`;
    }
  }, [searchParams]);

  return null;
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={null}>
      <AuthCallbackContent />
    </Suspense>
  );
}
