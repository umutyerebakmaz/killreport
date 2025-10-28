"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function AuthSuccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams.get("token");
    const refreshToken = searchParams.get("refresh_token");
    const expiresIn = searchParams.get("expires_in");
    const characterName = searchParams.get("character_name");
    const characterId = searchParams.get("character_id");

    if (!token) {
      setError("No token received from authentication");
      return;
    }

    try {
      // Token'ları localStorage'a kaydet
      localStorage.setItem("eve_access_token", token);
      if (refreshToken) {
        localStorage.setItem("eve_refresh_token", refreshToken);
      }
      if (expiresIn) {
        const expiryTime = Date.now() + parseInt(expiresIn) * 1000;
        localStorage.setItem("eve_token_expiry", expiryTime.toString());
      }

      // Kullanıcı bilgilerini kaydet
      if (characterName && characterId) {
        const userData = {
          characterId,
          characterName,
        };
        localStorage.setItem("eve_user", JSON.stringify(userData));
      }

      // Dispatch custom event for auth state update
      window.dispatchEvent(new Event("auth-change"));

      // Ana sayfaya yönlendir
      setTimeout(() => {
        router.push("/");
      }, 2000);
    } catch (err) {
      console.error("Error saving auth data:", err);
      setError("Failed to save authentication data");
    }
  }, [searchParams, router]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="max-w-md w-full bg-gray-800 shadow-2xl rounded-lg p-8 border border-gray-700">
          <div className="text-center">
            <div className="text-red-500 text-6xl mb-6">✗</div>
            <h1 className="text-3xl font-bold text-white mb-4">
              Authentication Failed
            </h1>
            <p className="text-gray-300 mb-8 text-lg">{error}</p>
            <button
              onClick={() => router.push("/")}
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
            >
              Return to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="max-w-md w-full bg-gray-800 shadow-2xl rounded-lg p-8 border border-gray-700">
        <div className="text-center">
          <div className="text-green-400 text-6xl mb-6">✓</div>
          <h1 className="text-3xl font-bold text-white mb-4">
            Authentication Successful!
          </h1>
          <p className="text-gray-300 mb-2 text-lg">
            Welcome,{" "}
            <strong className="text-amber-400">
              {searchParams.get("character_name")}
            </strong>
            !
          </p>
          <p className="text-gray-400 text-sm mb-8">
            Redirecting to home page...
          </p>
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-500"></div>
          </div>
        </div>
      </div>
    </div>
  );
}
