import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import { Input } from '../components/ui/Input';

export default function Login() {
  const [isLogin, setIsLogin] = React.useState(true);
  const [username, setUsername] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [error, setError] = React.useState('');
  const { login, register, loginAsGuest } = useAuth();
  const navigate = useNavigate();

  const getErrorMessage = (err: unknown): string => {
    if (typeof err === 'string') return err;
    if (err && typeof err === 'object') {
      const anyErr = err as { response?: { data?: { detail?: unknown } } };
      const detail = anyErr.response?.data?.detail;
      if (typeof detail === 'string') return detail;
    }
    return 'An error occurred';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      if (isLogin) {
        await login(username, password);
      } else {
        // Validate password confirmation
        if (password !== confirmPassword) {
          setError('Passwords do not match');
          return;
        }
        await register(username, email, password);
      }
      navigate('/');
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <div className="min-h-full bg-bg">
      <div className="container-page flex min-h-full items-center justify-center py-10">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>{isLogin ? 'Welcome back' : 'Create account'}</CardTitle>
            <CardDescription>{isLogin ? 'Sign in to continue.' : 'Create an account to save and plan.'}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <div className="rounded-lg border border-border bg-surface px-4 py-3 text-sm">
                <div className="font-medium">Sign in failed</div>
                <div className="text-muted">{error}</div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <div className="text-sm font-medium">Username</div>
                <div className="mt-2">
                  <Input value={username} onChange={(e) => setUsername(e.target.value)} required />
                </div>
              </div>

              {!isLogin && (
                <div>
                  <div className="text-sm font-medium">Email</div>
                  <div className="mt-2">
                    <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                  </div>
                </div>
              )}

              <div>
                <div className="text-sm font-medium">Password</div>
                <div className="mt-2">
                  <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                </div>
              </div>

              {!isLogin && (
                <div>
                  <div className="text-sm font-medium">Confirm password</div>
                  <div className="mt-2">
                    <Input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>
              )}

              <Button type="submit" variant="primary" className="w-full">
                {isLogin ? 'Sign in' : 'Create account'}
              </Button>
            </form>

            {isLogin && (
              <div className="pt-2">
                <div className="flex items-center gap-3 text-xs text-muted">
                  <div className="h-px flex-1 bg-border" />
                  <span>or</span>
                  <div className="h-px flex-1 bg-border" />
                </div>
                <div className="mt-3">
                  <Button
                    variant="secondary"
                    className="w-full"
                    onClick={() => {
                      loginAsGuest();
                      navigate('/');
                    }}
                  >
                    Continue as guest
                  </Button>
                  <div className="mt-2 text-center text-xs text-muted">Browse public recipes without an account.</div>
                </div>
              </div>
            )}

            <div className="text-center text-sm text-muted">
              {isLogin ? "Don't have an account? " : 'Already have an account? '}
              <button
                type="button"
                className="font-medium text-primary underline underline-offset-4"
                onClick={() => {
                  setIsLogin(!isLogin);
                  setError('');
                  setPassword('');
                  setConfirmPassword('');
                }}
              >
                {isLogin ? 'Register' : 'Login'}
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
