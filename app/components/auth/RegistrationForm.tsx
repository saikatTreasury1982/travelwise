// app/components/auth/RegistrationForm.tsx
'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Input from '@/app/components/ui/Input';
import Button from '@/app/components/ui/Button';
import CountryCombobox, { type Country } from '@/app/components/ui/CountryCombobox';

interface FormData {
  firstName: string;
  middleName: string;
  lastName: string;
  email: string;
  residentCountry: string;
  homeCurrency: string;
}
interface Errors {
  firstName?: string;
  lastName?: string;
  email?: string;
  residentCountry?: string;
  general?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function RegistrationForm() {
  const router = useRouter();
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [form, setForm] = useState<FormData>({
    firstName: '', middleName: '', lastName: '', email: '', residentCountry: '', homeCurrency: '',
  });

  useEffect(() => {
    fetch('/api/countries')
      .then((r) => r.json())
      .then((d) => setCountries(d.countries ?? []))
      .catch(() => setCountries([]));
  }, []);

  function set<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key as keyof Errors]) setErrors((e) => ({ ...e, [key]: undefined }));
  }

  function selectCountry(c: Country) {
    // auto-fill currency from the chosen country
    setForm((f) => ({ ...f, residentCountry: c.country_code, homeCurrency: c.currency_code }));
    if (errors.residentCountry) setErrors((e) => ({ ...e, residentCountry: undefined }));
  }

  function validate(): boolean {
    const next: Errors = {};
    if (!form.firstName.trim()) next.firstName = 'First name is required';
    if (!form.lastName.trim()) next.lastName = 'Last name is required';
    if (!form.email) next.email = 'Email is required';
    else if (!EMAIL_RE.test(form.email)) next.email = 'Please enter a valid email address';
    if (!form.residentCountry) next.residentCountry = 'Please select your country';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setErrors({});
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email,
          firstName: form.firstName,
          middleName: form.middleName || null,
          lastName: form.lastName,
          residentCountry: form.residentCountry,
          homeCurrency: form.homeCurrency,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Registration failed');
      // Account created (profile only). Go to login to set a credential.
      router.push('/login');
    } catch (err) {
      setErrors({ general: err instanceof Error ? err.message : 'Registration failed. Please try again.' });
    } finally {
      setLoading(false);
    }
  }

  const currencyName = countries.find((c) => c.country_code === form.residentCountry)?.currency_code || form.homeCurrency;

  return (
    <div>
      <div className="flex flex-col gap-2 mb-8">
        <h1 className="text-[27px] font-bold leading-tight" style={{ color: 'var(--ink)', letterSpacing: '-0.5px' }}>Create your account</h1>
        <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>Start planning your travels with Travelwise.</p>
      </div>

      {errors.general && (
        <div className="p-3 rounded-lg text-sm mb-4 animate-slide-down" style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger)', color: 'var(--danger)' }}>
          {errors.general}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-4 sm:flex-row">
          <Input name="firstName" label="First name" placeholder="John" value={form.firstName}
            onChange={(e) => set('firstName', e.target.value)} error={errors.firstName} autoComplete="given-name" />
          <Input name="middleName" label="Middle (optional)" placeholder="" value={form.middleName}
            onChange={(e) => set('middleName', e.target.value)} autoComplete="additional-name" />
        </div>

        <Input name="lastName" label="Last name" placeholder="Smith" value={form.lastName}
          onChange={(e) => set('lastName', e.target.value)} error={errors.lastName} autoComplete="family-name" />

        <Input name="email" type="email" label="Email" placeholder="you@example.com" value={form.email}
          onChange={(e) => set('email', e.target.value)} error={errors.email} autoComplete="email" />

        <div>
          <label className="block text-sm font-semibold mb-1.5" style={{ color: 'var(--ink-soft)' }}>
            Country of residence
          </label>
          <CountryCombobox value={form.residentCountry} countries={countries} onSelect={selectCountry} error={errors.residentCountry} />
        </div>

        {form.homeCurrency && (
          <p className="text-sm" style={{ color: 'var(--ink-faint)' }}>
            Home currency: <span style={{ color: 'var(--ink)', fontWeight: 600 }}>{currencyName}</span> (from your country — you can change it later)
          </p>
        )}

        <div className="mt-2">
          <Button type="submit" variant="primary" isLoading={loading} fullWidth>Create account</Button>
        </div>
      </form>

      <p className="mt-8 text-sm" style={{ color: 'var(--ink-soft)' }}>
        Already have an account?{' '}
        <Link href="/login" className="font-semibold" style={{ color: 'var(--ink)', borderBottom: '1px solid rgba(0,0,0,0.25)' }}>Sign in</Link>
      </p>
    </div>
  );
}