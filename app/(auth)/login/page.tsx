// app/(auth)/login/page.tsx
import type { Metadata } from 'next';
import LoginForm from '@/app/components/auth/LoginForm';

export const metadata: Metadata = {
  title: 'Sign in · Travelwise',
  description: 'Sign in to your Travelwise account.',
};

export default function LoginPage() {
  return <LoginForm />;
}