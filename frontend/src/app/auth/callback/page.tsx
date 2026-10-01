'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect } from 'react';

/**
 * EVE SSO Callback Handler
 *
 * Catches the callback from EVE SSO and forwards it to the backend.
 * It only comes into play when the EVE Developer Application's callback URL
 * points at this page (the frontend domain); when `EVE_CALLBACK_URL` points
 * straight at the backend, this page is never reached.
 *
 * It renders nothing. A redirect should have no visible pause: the user
 * leaves EVE and appears back on the page they were on, without a card or a
 * spinner in between.
 */
function AuthCallbackContent() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');

    if (code && state) {
      // Hand off to the backend - it does the token exchange and sends the user
      // back to the page they pressed login on.
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
