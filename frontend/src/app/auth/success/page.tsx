"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function AuthSuccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = searchParams.get("token");
    const refreshToken = searchParams.get("refresh_token");
    const expiresIn = searchParams.get("expires_in");
    const characterName = searchParams.get("character_name");
    const characterId = searchParams.get("character_id");

    if (!token) {
      setError("No token received from authentication");
      setIsLoading(false);
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
        setIsLoading(false);
        //router.push("/killmails");
      }, 1500);
    } catch (err) {
      console.error("Error saving auth data:", err);
      setError("Failed to save authentication data");
      setIsLoading(false);
    }
  }, [searchParams, router]);

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen p-4 bg-black">
        <div className="w-full max-w-md">
          {/* Animated background glow */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="rounded-full w-96 h-96 bg-red-500/10 blur-3xl animate-pulse"></div>
          </div>

          <div className="relative p-8 border shadow-2xl bg-gray-800/90 backdrop-blur-xl rounded-2xl border-red-500/20">
            <div className="text-center">
              {/* Error icon with animation */}
              <div className="relative inline-flex items-center justify-center w-20 h-20 mb-6">
                <div className="absolute inset-0 rounded-full bg-red-500/20 animate-ping"></div>
                <div className="relative flex items-center justify-center w-20 h-20 border-2 border-red-500 rounded-full shadow-lg bg-linear-to-br from-red-500/20 to-red-600/20 shadow-red-500/50">
                  <svg
                    className="w-10 h-10 text-red-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2.5}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </div>
              </div>

              <h1 className="mb-3 text-3xl font-bold text-white">
                Authentication Failed
              </h1>
              <p className="mb-8 text-base leading-relaxed text-gray-300">
                {error}
              </p>
              <button
                onClick={() => router.push("/killmails")}
                className="relative inline-flex items-center justify-center px-8 py-3 font-semibold text-white transition-all duration-300 shadow-lg group bg-linear-to-r from-amber-500 to-amber-600 rounded-xl hover:from-amber-600 hover:to-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 focus:ring-offset-gray-800 hover:shadow-amber-500/50 hover:scale-105"
              >
                <svg
                  className="w-5 h-5 mr-2 transition-transform group-hover:-translate-x-1"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 19l-7-7m0 0l7-7m-7 7h18"
                  />
                </svg>
                Return to Killmails
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center h-screen p-4 bg-black">
      <div className="w-full max-w-md">
        {/* Animated background glow */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="rounded-full w-96 h-96 bg-green-500/10 blur-3xl animate-pulse"></div>
        </div>

        <div className="relative p-8 border shadow-2xl bg-gray-800/90 backdrop-blur-xl rounded-2xl border-green-500/20">
          <div className="text-center">
            {/* Success icon with animation */}
            <div className="relative inline-flex items-center justify-center w-20 h-20 mb-6">
              <div className="absolute inset-0 rounded-full bg-green-500/20 animate-ping"></div>
              <div className="relative flex items-center justify-center w-20 h-20 border-2 border-green-500 rounded-full shadow-lg bg-linear-to-br from-green-500/20 to-emerald-600/20 shadow-green-500/50">
                <svg
                  className="w-10 h-10 text-green-400 animate-[scale-in_0.5s_ease-out]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.5}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
            </div>

            <h1 className="mb-4 text-3xl font-bold text-white">
              Authentication Successful!
            </h1>

            {/* Character info card with enhanced design */}
            <div className="p-5 mb-6 border shadow-inner bg-linear-to-br from-gray-900/60 to-gray-900/40 rounded-xl border-gray-700/50">
              <p className="mb-2 text-sm font-medium text-gray-400">
                Welcome back,
              </p>
              <p className="mb-2 text-2xl font-bold text-transparent bg-clip-text bg-linear-to-r from-amber-400 via-amber-500 to-amber-600">
                {searchParams.get("character_name")}
              </p>
              <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
                <svg
                  className="w-3 h-3"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>ID: {searchParams.get("character_id")}</span>
              </div>
            </div>

            {isLoading ? (
              <div className="space-y-4">
                <p className="text-sm font-medium text-gray-400">
                  Redirecting to killmails...
                </p>
                <div className="flex items-center justify-center space-x-2">
                  <div
                    className="w-2.5 h-2.5 bg-linear-to-r from-amber-400 to-amber-500 rounded-full animate-bounce shadow-lg shadow-amber-500/50"
                    style={{ animationDelay: "0ms" }}
                  ></div>
                  <div
                    className="w-2.5 h-2.5 bg-linear-to-r from-amber-400 to-amber-500 rounded-full animate-bounce shadow-lg shadow-amber-500/50"
                    style={{ animationDelay: "150ms" }}
                  ></div>
                  <div
                    className="w-2.5 h-2.5 bg-linear-to-r from-amber-400 to-amber-500 rounded-full animate-bounce shadow-lg shadow-amber-500/50"
                    style={{ animationDelay: "300ms" }}
                  ></div>
                </div>
              </div>
            ) : (
              <button
                onClick={() => router.push("/killmails")}
                className="relative inline-flex items-center justify-center px-8 py-3 font-semibold text-white transition-all duration-300 shadow-lg cursor-pointer group bg-linear-to-r from-amber-500 to-amber-600 rounded-xl hover:from-amber-600 hover:to-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 focus:ring-offset-gray-800 hover:shadow-amber-500/50 hover:scale-105"
              >
                Continue to Killmails
                <svg
                  className="w-5 h-5 ml-2 transition-transform group-hover:translate-x-1"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M14 5l7 7m0 0l-7 7m7-7H3"
                  />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Additional security info */}
        <div className="mt-6 text-center">
          <div className="inline-flex items-center gap-2 text-xs text-gray-500">
            <svg
              className="w-3.5 h-3.5 text-green-500"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                clipRule="evenodd"
              />
            </svg>
            <span>Your session is secure and encrypted</span>
          </div>
        </div>
      </div>
    </div>
  );
}
