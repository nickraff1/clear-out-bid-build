import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { z } from 'zod';

const emailSchema = z.string().email('Please enter a valid email address');

const hasRecoveryParams = () => {
  if (typeof window === 'undefined') return false;

  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const search = new URLSearchParams(window.location.search);

  return (
    hash.get('type') === 'recovery' ||
    search.get('type') === 'recovery' ||
    window.location.hash.length > 1 ||
    hash.has('access_token') ||
    hash.has('refresh_token') ||
    hash.has('token_hash') ||
    search.has('code') ||
    search.has('token_hash')
  );
};

interface ResetPasswordProps {
  forceUpdateMode?: boolean;
}

export default function ResetPassword({ forceUpdateMode = false }: ResetPasswordProps = {}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'request' | 'update'>(() =>
    forceUpdateMode || hasRecoveryParams() ? 'update' : 'request'
  );
  const [recoveryReady, setRecoveryReady] = useState(false);

  useEffect(() => {
    const isRecovery = forceUpdateMode || hasRecoveryParams();
    if (!isRecovery) return;

    setMode('update');

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
        setRecoveryReady(Boolean(session));
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      setRecoveryReady(Boolean(data.session));
    });

    return () => subscription.unsubscribe();
  }, [forceUpdateMode]);

  const handleResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate
    const result = emailSchema.safeParse(email);
    if (!result.success) {
      setError(result.error.errors[0].message);
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      
      if (error) {
        setError(error.message);
      } else {
        setSuccess(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        setError(error.message);
      } else {
        setSuccess(true);
      }
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <Layout hideFooter>
        <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center py-12 px-4">
          <div className="w-full max-w-md text-center">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-success/10 mb-6">
              <CheckCircle2 className="h-8 w-8 text-success" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">
              Check your email
            </h1>
            <p className="text-muted-foreground mb-6">
              {mode === 'update'
                ? 'Your password has been updated. You can now continue to your account.'
                : <>If an account exists for <strong>{email}</strong>, we've sent instructions to reset your password.</>}
            </p>
            <Button variant="outline" asChild>
              <Link to={mode === 'update' ? '/app' : '/login'}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                {mode === 'update' ? 'Continue to Account' : 'Return to Login'}
              </Link>
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  if (mode === 'update') {
    return (
      <Layout hideFooter>
        <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center py-12 px-4">
          <div className="w-full max-w-md">
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold text-foreground mb-2">
                Set a new password
              </h1>
              <p className="text-muted-foreground">
                Choose a strong password you haven't used before.
              </p>
            </div>

            <div className="bg-card border border-border rounded-xl p-6 shadow-card">
              {!recoveryReady && (
                <Alert className="mb-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Validating your reset link… If this message stays visible, request a new link.
                  </AlertDescription>
                </Alert>
              )}

              <form onSubmit={handlePasswordUpdate} className="space-y-4">
                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="password">New password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading || !recoveryReady}
                    className="input-focus"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    disabled={loading || !recoveryReady}
                    className="input-focus"
                  />
                </div>

                <Button type="submit" className="w-full" disabled={loading || !recoveryReady}>
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    'Update password'
                  )}
                </Button>
              </form>

              <div className="mt-6 text-center">
                <Link
                  to="/login"
                  className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center"
                >
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Back to Login
                </Link>
              </div>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout hideFooter>
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center py-12 px-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-foreground mb-2">
              Reset your password
            </h1>
            <p className="text-muted-foreground">
              Enter your email and we'll send you a link to reset your password
            </p>
          </div>

          <div className="bg-card border border-border rounded-xl p-6 shadow-card">
            <form onSubmit={handleResetRequest} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  className="input-focus"
                />
              </div>

              <Button 
                type="submit" 
                className="w-full" 
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  'Send Reset Link'
                )}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <Link 
                to="/login" 
                className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center"
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back to Login
              </Link>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
