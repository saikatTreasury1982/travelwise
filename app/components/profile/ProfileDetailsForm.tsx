'use client';

import { useState } from 'react';
import Input from '@/app/components/ui/Input';
import CountryCombobox, { type Country } from '@/app/components/ui/CountryCombobox';
import CurrencyCombobox, { type Currency } from '@/app/components/ui/CurrencyCombobox';

export interface ProfileData {
  user_id: string;
  email: string | null;
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
  resident_country: string | null;
  home_currency: string | null;
}

export default function ProfileDetailsForm({
  initial, countries, currencies,
}: { initial: ProfileData; countries: Country[]; currencies: Currency[] }) {
  const [firstName, setFirstName] = useState(initial.first_name ?? '');
  const [middleName, setMiddleName] = useState(initial.middle_name ?? '');
  const [lastName, setLastName] = useState(initial.last_name ?? '');
  const [country, setCountry] = useState(initial.resident_country ?? '');
  const [currency, setCurrency] = useState(initial.home_currency ?? '');

  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');
  const [error, setError] = useState('');

  async function save() {
    setSaving(true); setError(''); setSavedMsg('');
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: firstName.trim() || null,
          middle_name: middleName.trim() || null,
          last_name: lastName.trim() || null,
          resident_country: country || null,
          home_currency: currency || null,
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Could not save changes.');
      setSavedMsg('Saved.');
      setTimeout(() => setSavedMsg(''), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save changes.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="surface p-6 md:p-8 max-w-[560px]">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input label="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First name" />
        <Input label="Middle name" value={middleName} onChange={(e) => setMiddleName(e.target.value)} placeholder="Optional" />
      </div>

      <div className="mt-4">
        <Input label="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Last name" />
      </div>

      {/* Email — read-only (login identity; change needs verification, later step) */}
      <div className="mt-4">
        <label className="block text-sm font-semibold mb-1.5" style={{ color: 'var(--ink-soft)' }}>Email</label>
        <div className="w-full h-[52px] px-4 rounded-[var(--radius-md,11px)] text-[15px] flex items-center"
             style={{ background: 'color-mix(in srgb, var(--ink) 5%, var(--surface))', color: 'var(--ink-soft)', border: '1px solid var(--border)' }}>
          {initial.email ?? '—'}
        </div>
        <p className="mt-1.5 text-[13px]" style={{ color: 'var(--ink-faint)' }}>
          Email is your login identity and can’t be changed here yet.
        </p>
      </div>

      <div className="mt-4">
        <label className="block text-sm font-semibold mb-1.5" style={{ color: 'var(--ink-soft)' }}>Resident country</label>
        <CountryCombobox
          value={country}
          countries={countries}
          onSelect={(c: Country) => {
            setCountry(c.country_code);
            // If no currency chosen yet, default to the country's currency.
            if (!currency && c.currency_code) setCurrency(c.currency_code);
          }}
        />
      </div>

      <div className="mt-4">
        <label className="block text-sm font-semibold mb-1.5" style={{ color: 'var(--ink-soft)' }}>Home currency</label>
        <CurrencyCombobox value={currency} currencies={currencies} onSelect={(code: string) => setCurrency(code)} />
      </div>

      <div className="mt-6 flex items-center gap-4">
        <button
          onClick={save}
          disabled={saving}
          className="h-[46px] px-6 rounded-[11px] font-bold text-[14px] disabled:opacity-50"
          style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
        {savedMsg && <span className="text-[14px] font-medium" style={{ color: 'var(--success)' }}>{savedMsg}</span>}
        {error && <span className="text-[14px] font-medium" style={{ color: 'var(--danger)' }}>{error}</span>}
      </div>
    </div>
  );
}