"use client";

import Loader from "@/components/Loader";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";

/**
 * EVE SSO Callback Handler
 * 
 * Bu sayfa EVE SSO'dan gelen callback'i yakalayıp backend'e yönlendirir.
 * Production'da EVE Developer Application callback URL'i bu sayfaya işaret etmelidir:
 * https://yourdomain.com/auth/callback
 */
function AuthCallbackContent() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const code = searchParams.get("code");
    const state = searchParams.get("state");

    if (code && state) {
      // Backend'e yönlendir - backend token exchange yapıp /auth/success'e redirect edecek
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";
      window.location.href = `${backendUrl}/auth/callback?code=${code}&state=${state}`;
    }
  }, [searchParams]);

  return (
    <div className="flex items-center justify-center h-screen bg-black">
      <div className="text-center">
        <Loader className="w-12 h-12 mx-auto mb-4 text-amber-500" />
        <p className="text-gray-400">Processing authentication...</p>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-screen bg-black">
          <Loader className="w-12 h-12 text-amber-500" />
        </div>
      }
    >
      <AuthCallbackContent />
    </Suspense>
  );
}
