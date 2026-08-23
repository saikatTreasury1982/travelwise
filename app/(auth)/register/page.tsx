// app/(auth)/register/page.tsx
import type { Metadata } from 'next';
import RegistrationForm from '@/app/components/auth/RegistrationForm';

export const metadata: Metadata = {
  title: 'Create account · Travelwise',
  description: 'Create your Travelwise account to start planning trips.',
};

export default function RegisterPage() {
  return <RegistrationForm />;
}