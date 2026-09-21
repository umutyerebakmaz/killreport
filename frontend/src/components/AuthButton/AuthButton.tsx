'use client';

import { useAuth } from '@/hooks/useAuth';
import { useLoginMutation } from '@/generated/graphql';
import Loader from '@/components/Loader';

export default function AuthButton() {
  const { user, isLoading, loginError, reportLoginError, logout } = useAuth();
  const [loginMutation, { loading: loginLoading }] = useLoginMutation();

  const handleLogin = async () => {
    try {
      const { data } = await loginMutation({
        variables: {
          // Where to come back to. The server keeps this against the SSO
          // `state` and redirects here at the end, so the round trip lands on
          // the page the user was reading rather than dumping them on the home
          // page via an interstitial.
          returnTo: window.location.pathname + window.location.search,
        },
      });
      if (data?.login?.url) {
        // Kullanıcıyı Eve SSO'ya yönlendir
        window.location.href = data.login.url;
      }
    } catch (error) {
      console.error('Login error:', error);
      reportLoginError();
    }
  };

  if (isLoading) {
    return (
      <div className="px-3 py-2">
        <Loader size="sm" text="Loading..." />
      </div>
    );
  }

  if (user) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-white">
          {user.characterName}
        </span>
        <button onClick={logout} className="button button-danger">
          LOGOUT
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      {loginError && (
        <span className="text-sm text-danger" role="status">
          {loginError}
        </span>
      )}
      <button
        onClick={handleLogin}
        disabled={loginLoading}
        className="button button-primary"
      >
        {loginLoading ? <Loader size="sm" /> : 'LOGIN'}
      </button>
    </div>
  );
}
