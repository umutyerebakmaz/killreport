'use client';

import { useAuth } from '@/hooks/useAuth';
import { useCharacterQuery, useLoginMutation } from '@/generated/graphql';
import Loader from '@/components/Loader';
import { UserMenu } from '@/components/Header/UserMenu';
import EveImage from '@/components/ui/EveImage';

export default function AuthButton({
  variant = 'header',
}: {
  variant?: 'header' | 'drawer';
}) {
  const { user, isLoading, loginError, reportLoginError, logout } = useAuth();
  const [loginMutation, { loading: loginLoading }] = useLoginMutation();
  // The corporation and alliance the menu prints under the name. The same
  // query the character page runs, so the two share one cache entry.
  const { data: characterData } = useCharacterQuery({
    variables: { id: Number(user?.characterId) },
    skip: !user || variant !== 'header',
  });

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
        // Redirect the user to EVE SSO
        window.location.href = data.login.url;
      }
    } catch (error) {
      console.error('login error:', error);
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
    if (variant === 'header') {
      return (
        <UserMenu
          user={user}
          corporation={characterData?.character?.corporation}
          alliance={characterData?.character?.alliance}
          onLogout={logout}
        />
      );
    }

    // The drawer is already a menu, so a second one inside it would only be a
    // click in the way: the name and the action sit in plain view.
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <EveImage
            kind="character"
            id={Number(user.characterId)}
            name={user.characterName}
            size={32}
          />
          <span className="text-sm font-medium text-white">
            {user.characterName}
          </span>
        </div>
        <button onClick={logout} className="w-full button button-danger">
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
