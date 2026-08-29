'use client';
import { useState, useEffect, useRef } from 'react';
import FlightBookingReview from './FlightBookingReview';

interface Props { tripId: number; currencies: Currency[]; }
interface Currency { currency_code: string; currency_name: string; currency_symbol?: string | null; }
interface Traveler {
  traveler_id: number; traveler_name: string;
  is_primary: number; is_cost_sharer: number; is_active: number;
}

function fmtDateTime(dt: string | null): string {
  if (!dt) return '—';
  const [date, time] = dt.split('T');
  try {
    const d = new Date(date + 'T00:00:00');
    const nice = d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });
    return time ? `${nice} · ${time.slice(0, 5)}` : nice;
  } catch { return dt.replace('T', ' '); }
}

export default function FlightBookingsView({ tripId, currencies }: Props) {
  const [extracting, setExtracting] = useState(false);
  const [reviewData, setReviewData] = useState<any | null>(null);
  const [editing, setEditing] = useState<{ bookingId: number; data: any; bearerIds: number[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [bookings, setBookings] = useState<any[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [roster, setRoster] = useState<Traveler[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);

  const loadRoster = async () => {
    const res = await fetch(`/api/trips/${tripId}/travelers`);
    if (res.ok) setRoster((await res.json()).travelers);
  };
  const loadBookings = async () => {
    setLoadingList(true);
    try {
      const res = await fetch(`/api/trips/${tripId}/flights/bookings`);
      if (res.ok) setBookings((await res.json()).bookings);
    } finally {
      setLoadingList(false);
    }
  };
  useEffect(() => { loadRoster(); loadBookings(); }, [tripId]);

  const nameOf = (id: number) => roster.find((t) => t.traveler_id === id)?.traveler_name ?? '—';

  const openForEdit = (b: any) => {
    setEditing({
      bookingId: b.booking_id,
      bearerIds: b.bearer_traveler_ids ?? [],
      data: {
        booking: {
          agency_reference: b.agency_reference, airline_pnr: b.airline_pnr,
          booking_source: b.booking_source, booking_date: b.booking_date,
          total_paid: b.total_paid, base_fare: b.base_fare, currency_code: b.currency_code,
        },
        legs: b.legs,
        uncertain_fields: [],
        document_notes: null,
      },
    });
  };

  const handleFile = async (file: File) => {
    setError(null); setExtracting(true); setReviewData(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`/api/trips/${tripId}/flights/extract`, { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not read the document');
      if (data.extraction_failed) { setError(data.error_message || 'No flight details found in this document.'); return; }
      setReviewData(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setExtracting(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  async function deleteBooking(id: number) {
    if (!confirm('Delete this booking? Its cost is removed from the forecast.')) return;
    await fetch(`/api/trips/${tripId}/flights/bookings/${id}`, { method: 'DELETE' });
    loadBookings();
  }

  if (editing) {
    return (
      <FlightBookingReview
        tripId={tripId} bookingId={editing.bookingId} data={editing.data}
        initialBearerIds={editing.bearerIds} currencies={currencies}
        onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); loadBookings(); }}
      />
    );
  }
  if (reviewData) {
    return (
      <FlightBookingReview
        tripId={tripId} data={reviewData} currencies={currencies}
        onCancel={() => setReviewData(null)} onSaved={() => { setReviewData(null); loadBookings(); }}
      />
    );
  }

  return (
    <div>
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => fileInput.current?.click()}
        className="rounded-xl p-8 text-center transition-colors"
        style={{
          border: `2px dashed ${dragOver ? 'var(--accent)' : 'var(--border)'}`,
          background: dragOver ? 'color-mix(in srgb, var(--accent) 8%, transparent)' : 'var(--surface)',
          cursor: 'pointer',
        }}
      >
        <input ref={fileInput} type="file" accept=".pdf,.txt,application/pdf,text/plain" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
        {extracting ? (
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 rounded-full animate-spin"
              style={{ border: '4px solid color-mix(in srgb, var(--accent) 30%, transparent)', borderTopColor: 'var(--accent)' }} />
            <p className="text-[14px]" style={{ color: 'var(--ink-soft)' }}>Reading your itinerary…</p>
          </div>
        ) : (
          <>
            <p className="text-[15px] mb-1" style={{ color: 'var(--ink)' }}>Drop your flight itinerary here, or click to browse</p>
            <p className="text-[13px]" style={{ color: 'var(--ink-faint)' }}>PDF or text · from any airline or booking site</p>
          </>
        )}
      </div>

      {error && (
        <div className="mt-4 p-3 rounded-lg text-sm" style={{ background: 'color-mix(in srgb, var(--danger) 12%, transparent)', border: '1px solid var(--danger)', color: 'var(--danger)' }}>
          {error}
        </div>
      )}

      {/* Coming-soon doors */}
      <div className="mt-4 flex gap-3 flex-wrap">
        <div className="text-[12px] px-3 py-2 rounded-lg" style={{ background: 'color-mix(in srgb, var(--ink) 4%, transparent)', color: 'var(--ink-faint)' }}>
          ✦ AI flight suggestions — coming soon
        </div>
        <div className="text-[12px] px-3 py-2 rounded-lg" style={{ background: 'color-mix(in srgb, var(--ink) 4%, transparent)', color: 'var(--ink-faint)' }}>
          🔍 Search flights in-app — coming soon
        </div>
      </div>

      {/* Booking list — full width */}
      <div className="mt-8 space-y-3">
        {loadingList ? (
          <p className="text-[13px]" style={{ color: 'var(--ink-faint)' }}>Loading…</p>
        ) : bookings.length === 0 ? (
          <p className="text-[13px] text-center py-8" style={{ color: 'var(--ink-faint)' }}>No bookings yet. Upload an itinerary to get started.</p>
        ) : (
          bookings.map((b) => (
            <div key={b.booking_id} className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              {/* header */}
              <div className="flex items-center gap-3 px-5 py-3.5" style={{ borderBottom: '1px solid var(--divider)' }}>
                <span className="text-[15px] font-bold" style={{ color: 'var(--ink)' }}>{b.booking_source || 'Booking'}</span>
                {b.airline_pnr && <span className="text-[12px] font-mono" style={{ color: 'var(--ink-soft)' }}>{b.airline_pnr}</span>}
                {b.total_paid != null ? (
                  <span className="ml-auto text-[15px] font-extrabold" style={{ color: 'var(--accent-deep)' }}>
                    {b.currency_code} {b.total_paid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                ) : (
                  <span className="ml-auto text-[13px]" style={{ color: 'var(--danger)' }}>Add price</span>
                )}
                <button onClick={() => deleteBooking(b.booking_id)} title="Delete booking" className="ml-3" style={{ color: 'var(--ink-faint)' }}>🗑</button>
              </div>

              {/* legs */}
              <button onClick={() => openForEdit(b)} className="w-full text-left px-5 py-3">
                {b.legs.map((l: any) => (
                  <div key={l.leg_id} className="grid items-center gap-4 py-1.5" style={{ gridTemplateColumns: '60px 1fr auto' }}>
                    <span className="text-[13px] font-mono font-semibold" style={{ color: 'var(--accent-deep)' }}>{l.flight_number || '—'}</span>
                    <span className="text-[14px]" style={{ color: 'var(--ink)' }}>
                      {l.departure_airport_code} <span style={{ color: 'var(--ink-faint)' }}>→</span> {l.arrival_airport_code}
                      {(l.departure_city || l.arrival_city) && (
                        <span className="text-[12px] ml-2" style={{ color: 'var(--ink-soft)' }}>
                          {l.departure_city || l.departure_airport_code} to {l.arrival_city || l.arrival_airport_code}
                        </span>
                      )}
                    </span>
                    <span className="text-[13px] text-right tabular-nums" style={{ color: 'var(--ink-soft)' }}>{fmtDateTime(l.departure_datetime)}</span>
                  </div>
                ))}
              </button>

              {/* footer — payers + edit */}
              <div className="flex items-center gap-2 px-5 py-3" style={{ borderTop: '1px solid var(--divider)' }}>
                <span className="text-[11px]" style={{ color: 'var(--ink-faint)' }}>Payers</span>
                {(b.bearer_traveler_ids ?? []).length === 0 ? (
                  <span className="text-[11px]" style={{ color: 'var(--danger)' }}>none — click to assign</span>
                ) : (
                  (b.bearer_traveler_ids ?? []).map((id: number) => (
                    <span key={id} className="text-[11px] px-2.5 py-0.5 rounded-full"
                      style={{ background: 'color-mix(in srgb, var(--accent) 18%, transparent)', color: 'var(--accent-deep)' }}>
                      {nameOf(id)}
                    </span>
                  ))
                )}
                <button onClick={() => openForEdit(b)} className="ml-auto text-[12px] font-semibold" style={{ color: 'var(--accent-deep)' }}>Edit booking →</button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}