'use client';
import { useState, useRef } from 'react';
import CurrencyCombobox from '@/app/components/ui/CurrencyCombobox';

interface Currency { currency_code: string; currency_name: string; currency_symbol?: string | null; }
interface Props {
  tripId: number;
  bookingId: number;
  currencies: Currency[];
  estimatedPrice: number | null;
  currency: string | null;
  onBooked: () => void;
  onCancel: () => void;
}

export default function BookPlannedFlight({ tripId, bookingId, currencies, estimatedPrice, currency, onBooked, onCancel }: Props) {
  const [mode, setMode] = useState<'choose' | 'upload' | 'manual'>('choose');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  // manual fields
  const [price, setPrice] = useState<string>('');
  const [curr, setCurr] = useState<string>(currency ?? '');
  const [pnr, setPnr] = useState('');

  async function handleUpload(file: File) {
    setBusy(true); setError(null);
    try {
      // Reuse Door C extraction to read the real doc.
      const fd = new FormData();
      fd.append('file', file);
      const exRes = await fetch(`/api/trips/${tripId}/flights/extract`, { method: 'POST', body: fd });
      const data = await exRes.json();
      if (!exRes.ok || data.extraction_failed) {
        throw new Error(data.error || data.error_message || 'Could not read the document.');
      }
      // Apply the extracted real data to THIS booking → Booked.
      const bookRes = await fetch(`/api/trips/${tripId}/flights/bookings/${bookingId}/book`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          total_paid: data.booking?.total_paid,
          currency_code: data.booking?.currency_code,
          airline_pnr: data.booking?.airline_pnr,
          agency_reference: data.booking?.agency_reference,
          booking_source: data.booking?.booking_source,
          booking_date: data.booking?.booking_date,
          legs: data.legs,
        }),
      });
      if (!bookRes.ok) throw new Error((await bookRes.json().catch(() => ({}))).error || 'Could not mark as booked.');
      onBooked();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  async function saveManual() {
    if (!price || !curr) { setError('Enter the real price and currency.'); return; }
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/trips/${tripId}/flights/bookings/${bookingId}/book`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ total_paid: parseFloat(price), currency_code: curr, airline_pnr: pnr || null }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Could not mark as booked.');
      onBooked();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl p-4 mt-2" style={{ background: 'color-mix(in srgb, var(--accent) 5%, var(--surface))', border: '1px solid var(--accent)' }}>
      <div className="flex items-center justify-between mb-3">
                <div className="text-[13px] font-semibold" style={{ color: 'var(--ink)' }}>Confirm this flight's booking</div>
        <button onClick={onCancel} className="text-[12px]" style={{ color: 'var(--ink-soft)' }}>Cancel</button>
      </div>

      {mode === 'choose' && (
        <div className="flex gap-3 flex-wrap">
          <button onClick={() => setMode('upload')} className="text-[13px] font-semibold px-4 py-2 rounded-lg"
            style={{ background: 'var(--accent)', color: 'var(--accent-ink)', cursor: 'pointer' }}>
            Upload confirmation
          </button>
          <button onClick={() => setMode('manual')} className="text-[13px] font-semibold px-4 py-2 rounded-lg"
            style={{ background: 'var(--surface)', color: 'var(--ink-soft)', border: '1px solid var(--border)', cursor: 'pointer' }}>
            Enter price manually
          </button>
        </div>
      )}

      {mode === 'upload' && (
        <div>
          <div onClick={() => fileInput.current?.click()}
            className="rounded-lg p-6 text-center" style={{ border: '2px dashed var(--border)', background: 'var(--surface)', cursor: 'pointer' }}>
            <input ref={fileInput} type="file" accept=".pdf,.txt,application/pdf,text/plain" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ''; }} />
            {busy ? (
              <p className="text-[13px]" style={{ color: 'var(--ink-soft)' }}>Reading your confirmation…</p>
            ) : (
              <p className="text-[13px]" style={{ color: 'var(--ink)' }}>Drop your booking confirmation, or click to browse</p>
            )}
          </div>
          <button onClick={() => setMode('choose')} className="text-[12px] mt-2" style={{ color: 'var(--ink-soft)' }}>← Back</button>
        </div>
      )}

      {mode === 'manual' && (
        <div>
          <div className="flex gap-2 items-end flex-wrap">
            <div>
              <label className="block text-[11px] mb-1" style={{ color: 'var(--ink-faint)' }}>Real price paid</label>
              <div className="flex gap-1">
                <CurrencyCombobox value={curr} currencies={currencies} onSelect={setCurr} size="compact" className="w-24" />
                <input type="number" value={price} onChange={(e) => setPrice(e.target.value)}
                  placeholder={estimatedPrice != null ? `est. ${estimatedPrice}` : '0.00'}
                  style={{ width: 120, height: 34, padding: '6px 8px', borderRadius: 8, fontSize: 14, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--ink)' }} />
              </div>
            </div>
            <div>
              <label className="block text-[11px] mb-1" style={{ color: 'var(--ink-faint)' }}>PNR (optional)</label>
              <input value={pnr} onChange={(e) => setPnr(e.target.value)}
                style={{ width: 120, height: 34, padding: '6px 8px', borderRadius: 8, fontSize: 14, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--ink)' }} />
            </div>
            <button onClick={saveManual} disabled={busy} className="text-[13px] font-semibold px-4 rounded-lg" style={{ height: 34, background: 'var(--accent)', color: 'var(--accent-ink)', cursor: 'pointer' }}>
              {busy ? 'Saving…' : 'Mark booked'}
            </button>
          </div>
          <button onClick={() => setMode('choose')} className="text-[12px] mt-2" style={{ color: 'var(--ink-soft)' }}>← Back</button>
        </div>
      )}

      {error && <p className="text-[12px] mt-2" style={{ color: 'var(--danger)' }}>{error}</p>}
    </div>
  );
}