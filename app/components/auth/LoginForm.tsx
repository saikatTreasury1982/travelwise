// app/components/auth/LoginForm.tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Input from '@/app/components/ui/Input';
import PasswordModal from '@/app/components/ui/PasswordModal';
import AuthActions, { type AuthAction } from './AuthActions';

const emailIcon = <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" /></svg>;
const passkeyIcon = <svg className="w-[19px] h-[19px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M12 11.5v3.2" /><path d="M8.6 10.6a3.4 3.4 0 0 1 6.8 0v2a8 8 0 0 1-.6 3" /><path d="M5.6 10.6a6.4 6.4 0 0 1 12.8 0v2a12 12 0 0 1-.5 3.3" /></svg>;
const lockIcon = <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="10.5" width="16" height="10" rx="2" /><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" /></svg>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [generalError, setGeneralError] = useState('');
  const [busy, setBusy] = useState<'passkey' | 'password' | null>(null);

  // password modal
  const [pwOpen, setPwOpen] = useState(false);
  const [pwMode, setPwMode] = useState<'login' | 'create'>('login');
  const [pwReqs, setPwReqs] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [pwSuccess, setPwSuccess] = useState('');

  function validateEmail(): boolean {
    if (!email) { setEmailError('Email is required'); return false; }
    if (!EMAIL_RE.test(email)) { setEmailError('Please enter a valid email address'); return false; }
    setEmailError('');
    return true;
  }

  // --- passkey ---
  async function handlePasskey() {
    if (!validateEmail()) return;
    setGeneralError('');
    setBusy('passkey');
    try {
      const { startAuthentication } = await import('@simplewebauthn/browser');
      const optRes = await fetch('/api/auth/passkey/login-options', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }),
      });
      if (optRes.status === 404) { setGeneralError('No passkey found for this account. Try password, or create one.'); return; }
      if (!optRes.ok) throw new Error('Could not start passkey sign-in');
      const options = await optRes.json();
      const credential = await startAuthentication(options);
      const verifyRes = await fetch('/api/auth/passkey/login-verify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ credential }),
      });
      if (!verifyRes.ok) throw new Error('Authentication failed');
      router.push('/dashboard');
    } catch (err) {
      setGeneralError(err instanceof Error ? err.message : 'Passkey sign-in failed');
    } finally {
      setBusy(null);
    }
  }

  // --- password: detect create vs login, open modal ---
  async function handlePassword() {
    if (!validateEmail()) return;
    setGeneralError('');
    setBusy('password');
    try {
      const methodsRes = await fetch('/api/auth/check-auth-methods', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }),
      });
      const methods = methodsRes.ok ? await methodsRes.json() : { hasPassword: false };
      setPwMode(methods.hasPassword ? 'login' : 'create');

      if (!methods.hasPassword) {
        const reqRes = await fetch('/api/auth/password/requirements').catch(() => null);
        if (reqRes?.ok) { const d = await reqRes.json(); setPwReqs(d.description ?? ''); }
      }
      setPwError(''); setPwSuccess('');
      setPwOpen(true);
    } catch {
      setGeneralError('Something went wrong. Please try again.');
    } finally {
      setBusy(null);
    }
  }

  // --- password modal submit ---
  async function handlePasswordSubmit(password: string) {
    setPwError(''); setPwSuccess(''); setPwLoading(true);
    try {
      if (pwMode === 'create') {
        const res = await fetch('/api/auth/password/create', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }),
        });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Could not set password'); }
        setPwSuccess('Password created. Sign in with it now.');
        setPwMode('login');
      } else {
        const res = await fetch('/api/auth/password/login', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }),
        });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Sign-in failed'); }
        router.push('/dashboard');
      }
    } catch (err) {
      setPwError(err instanceof Error ? err.message : 'Something went wrong');
      throw err;
    } finally {
      setPwLoading(false);
    }
  }

  const actions: AuthAction[] = [
    { key: 'passkey', label: 'Sign in with a passkey', icon: passkeyIcon, onClick: handlePasskey, loading: busy === 'passkey', variant: 'primary' },
    { key: 'password', label: 'Continue with password', icon: lockIcon, onClick: handlePassword, loading: busy === 'password' },
  ];

  return (
    <div>
      <div className="flex flex-col gap-2 mb-8">
        <h1 className="text-[27px] font-bold leading-tight" style={{ color: 'var(--ink)', letterSpacing: '-0.5px' }}>Welcome back</h1>
        <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>Sign in to keep planning.</p>
      </div>

      {generalError && (
        <div className="p-3 rounded-lg text-sm mb-4 animate-slide-down" style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger)', color: 'var(--danger)' }}>
          {generalError}
        </div>
      )}

      <div className="mb-6">
        <Input
          name="email" type="email" label="Email" placeholder="you@example.com"
          value={email} onChange={(e) => { setEmail(e.target.value); if (emailError) setEmailError(''); }}
          error={emailError} autoComplete="email" leftIcon={emailIcon}
        />
      </div>

      <AuthActions actions={actions} />

      <p className="mt-8 text-sm" style={{ color: 'var(--ink-soft)' }}>
        New to Travelwise?{' '}
        <Link href="/register" className="font-semibold" style={{ color: 'var(--ink)', borderBottom: '1px solid rgba(0,0,0,0.25)' }}>Create an account</Link>
      </p>

      <PasswordModal
        isOpen={pwOpen}
        onClose={() => setPwOpen(false)}
        onSubmit={handlePasswordSubmit}
        title="Password"
        description={pwMode === 'create' ? "You haven't set a password yet. Create one to continue." : 'Enter your password to sign in.'}
        passwordRequirements={pwMode === 'create' ? pwReqs : ''}
        isLoading={pwLoading}
        error={pwError}
        mode={pwMode}
        successMessage={pwSuccess}
      />
    </div>
  );
}