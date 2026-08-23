// app/components/ui/PasswordModal.tsx
'use client';
import { useState } from 'react';
import Input from './Input';
import CircleIconButton from './CircleIconButton';

interface PasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (password: string, confirmPassword?: string) => Promise<void>;
  title: string;
  description?: string;
  passwordRequirements?: string;
  isLoading?: boolean;
  error?: string;
  mode: 'login' | 'create';
  successMessage?: string;
}

const lockIcon = <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>;
const arrowIcon = <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>;
const xIcon = <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>;
const checkIcon = <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>;

export default function PasswordModal({
  isOpen, onClose, onSubmit, title, description, passwordRequirements,
  isLoading = false, error, mode, successMessage,
}: PasswordModalProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');
    if (mode === 'create') {
      if (!password || !confirmPassword) { setLocalError('Both fields are required'); return; }
      if (password !== confirmPassword) { setLocalError('Passwords do not match'); return; }
    }
    await onSubmit(password, confirmPassword);
  };

  const handleClose = () => { setPassword(''); setConfirmPassword(''); setLocalError(''); onClose(); };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} onClick={handleClose} />

      <div className="surface relative p-6 rounded-2xl shadow-2xl max-w-md w-full animate-scale-in">
        <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--ink)' }}>{title}</h2>
        {description && <p className="text-sm mb-4" style={{ color: 'var(--ink-soft)' }}>{description}</p>}

        {successMessage ? (
          <div className="space-y-4">
            <div className="p-4 rounded-lg" style={{ background: 'color-mix(in srgb, var(--success) 18%, transparent)', border: '1px solid var(--success)', color: 'var(--ink)' }}>
              <p className="font-semibold mb-1">Success</p>
              <p className="text-sm">{successMessage}</p>
            </div>
            <div className="flex justify-center">
              <CircleIconButton type="button" onClick={handleClose} variant="primary" title="Close" icon={checkIcon} />
            </div>
          </div>
        ) : (
          <>
            {passwordRequirements && (
              <div className="p-3 rounded-lg text-sm mb-4" style={{ background: 'color-mix(in srgb, var(--accent) 15%, transparent)', border: '1px solid color-mix(in srgb, var(--accent) 40%, transparent)', color: 'var(--ink)' }}>
                <p className="font-semibold mb-1">Password requirements</p>
                <p>{passwordRequirements}</p>
              </div>
            )}
            {(error || localError) && (
              <div className="p-3 rounded-lg text-sm mb-4" style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger)', color: 'var(--danger)' }}>
                {error || localError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'create' ? (
                <>
                  <Input name="password" type="password" label="New Password" placeholder="Enter your password"
                    value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required leftIcon={lockIcon} />
                  <Input name="confirmPassword" type="password" label="Confirm Password" placeholder="Re-enter your password"
                    value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" required leftIcon={lockIcon} />
                  <div className="flex justify-center gap-4">
                    <CircleIconButton type="button" onClick={handleClose} variant="default" size="small" title="Cancel" icon={xIcon} />
                    <CircleIconButton type="submit" variant="primary" size="small" isLoading={isLoading} title="Create" icon={arrowIcon} />
                  </div>
                </>
              ) : (
                <div className="flex items-end gap-3">
                  <div className="flex-1">
                    <Input name="password" type="password" label="Password" placeholder="Enter your password"
                      value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required leftIcon={lockIcon} />
                  </div>
                  <div className="flex gap-2 pb-1">
                    <CircleIconButton type="button" onClick={handleClose} variant="default" size="small" title="Cancel" icon={xIcon} />
                    <CircleIconButton type="submit" variant="primary" size="small" isLoading={isLoading} title="Continue" icon={arrowIcon} />
                  </div>
                </div>
              )}
            </form>
          </>
        )}
      </div>
    </div>
  );
}