import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useSignInEmailPassword, useSignUpEmailPassword } from '@nhost/react';
import { useAuthenticationStatus } from '@nhost/react';
import { Workflow } from 'lucide-react';

export const LoginPage = () => {
  const { isAuthenticated } = useAuthenticationStatus();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const { signInEmailPassword, isLoading: signInLoading } = useSignInEmailPassword();
  const { signUpEmailPassword, isLoading: signUpLoading } = useSignUpEmailPassword();

  if (isAuthenticated) return <Navigate to="/" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (isSignUp) {
        const result = await signUpEmailPassword(email, password);
        if (result.error) {
          const msg = result.error.message ?? '';
          if (msg.toLowerCase().includes('network') || msg.toLowerCase().includes('fetch')) {
            setError('Cannot reach the backend. Make sure nhost is running or your REACT_APP_NHOST_SUBDOMAIN is set correctly in frontend/.env');
          } else {
            setError(msg);
          }
        }
      } else {
        const result = await signInEmailPassword(email, password);
        if (result.error) {
          const msg = result.error.message ?? '';
          if (msg.toLowerCase().includes('network') || msg.toLowerCase().includes('fetch')) {
            setError('Cannot reach the backend. Make sure nhost is running or your REACT_APP_NHOST_SUBDOMAIN is set correctly in frontend/.env');
          } else {
            setError(msg);
          }
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.toLowerCase().includes('network') || msg.toLowerCase().includes('fetch') || msg.toLowerCase().includes('failed')) {
        setError('Cannot reach the backend. Make sure nhost is running or your REACT_APP_NHOST_SUBDOMAIN is set correctly in frontend/.env');
      } else {
        setError(msg);
      }
    }
  };

  const isLoading = signInLoading || signUpLoading;

  const backendMissing = !process.env.REACT_APP_NHOST_SUBDOMAIN ||
    process.env.REACT_APP_NHOST_SUBDOMAIN === 'your-subdomain';

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <Workflow size={32} className="auth-logo" />
          <h1 className="auth-title">WorkflowAI</h1>
          <p className="auth-subtitle">AI Agent Workflow Builder</p>
        </div>

        {backendMissing && (
          <div className="alert alert-warning">
            <strong>Backend not configured.</strong><br />
            Set <code>REACT_APP_NHOST_SUBDOMAIN</code> in <code>frontend/.env</code> to your nhost project subdomain,
            then restart <code>npm start</code>.<br />
            <a href="https://app.nhost.io" target="_blank" rel="noreferrer" style={{color:'inherit'}}>
              Create a free nhost project →
            </a>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="email" className="form-label">Email</label>
            <input
              id="email"
              type="email"
              className="form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password" className="form-label">Password</label>
            <input
              id="password"
              type="password"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={8}
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
            />
          </div>

          {error && <div className="alert alert-error">{error}</div>}

          <button type="submit" className="btn btn-primary w-full" disabled={isLoading}>
            {isLoading ? 'Loading...' : isSignUp ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        <div className="auth-switch">
          {isSignUp ? (
            <>
              Already have an account?{' '}
              <button className="link-btn" onClick={() => setIsSignUp(false)}>
                Sign in
              </button>
            </>
          ) : (
            <>
              No account?{' '}
              <button className="link-btn" onClick={() => setIsSignUp(true)}>
                Create one
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
