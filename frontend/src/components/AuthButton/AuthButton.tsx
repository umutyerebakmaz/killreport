"use client";

import { useAuth } from "@/hooks/useAuth";
import { gql, useMutation } from "@apollo/client";

const LOGIN_MUTATION = gql`
  mutation Login {
    login {
      url
      state
    }
  }
`;

export default function AuthButton() {
  const { user, isLoading, logout } = useAuth();
  const [loginMutation, { loading: loginLoading }] =
    useMutation(LOGIN_MUTATION);

  const handleLogin = async () => {
    try {
      const { data } = await loginMutation();
      if (data?.login?.url) {
        // Kullanıcıyı Eve SSO'ya yönlendir
        window.location.href = data.login.url;
      }
    } catch (error) {
      console.error("Login error:", error);
      alert("Login failed. Please try again.");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-sm font-semibold text-gray-400">
        <div className="w-4 h-4 border-2 border-gray-400 rounded-full animate-spin border-t-transparent"></div>
        Loading...
      </div>
    );
  }

  if (user) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold text-white">
          {user.characterName}
        </span>
        <button
          onClick={logout}
          className="px-3 py-2 text-sm font-semibold text-white transition-colors rounded-lg cursor-pointer bg-red-600/80 hover:bg-red-600"
        >
          LOGOUT
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleLogin}
      disabled={loginLoading}
      className="px-3 py-2 text-sm font-semibold text-white transition-colors rounded-lg cursor-pointer bg-amber-600/80 hover:bg-amber-600 disabled:opacity-50"
    >
      {loginLoading ? "Loading..." : "LOGIN"}
    </button>
  );
}
