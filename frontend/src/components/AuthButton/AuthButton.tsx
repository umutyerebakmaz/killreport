'use client';

import { useAuth } from '@/hooks/useAuth';
import { gql, useMutation } from '@apollo/client';
import Loader from '@/components/Loader';

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
      console.error('Login error:', error);
      alert('Login failed. Please try again.');
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
        <span className="text-sm font-semibold text-white">
          {user.characterName}
        </span>
        <button onClick={logout} className="button button-danger">
          LOGOUT
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleLogin}
      disabled={loginLoading}
      className="button button-primary"
    >
      {loginLoading ? <Loader size="sm" /> : 'LOGIN'}
    </button>
  );
}
