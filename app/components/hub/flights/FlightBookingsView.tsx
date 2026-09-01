'use client';
import { useState, useEffect, useRef } from 'react';
import FlightBookingReview from './FlightBookingReview';
import FlightSuggestPanel from './FlightSuggestPanel';
import BookPlannedFlight from './BookPlannedFlight';
import VarianceChip from '@/app/components/ui/VarianceChip';

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

function totalDuration(legs: any[]): number {
  return legs.reduce((s, l) => s + (l.duration_minutes ?? 0), 0);
}
function earliestDepart(legs: any[]): string {
  return legs.map((l) => l.departure_datetime).filter(Boolean).sort()[0] ?? '';
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
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [sortKey, setSortKey] = useState<'price' | 'fastest' | 'earliest'>('price');
  const [bookingPanelFor, setBookingPanelFor] = useState<number | null>(null);

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
          total_paid: b.total_paid ?? b.estimated_price, base_fare: b.base_fare, currency_code: b.currency_code,
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

      // Smart merge: if it matches a flight already planned, ask whether to merge —
      // but ALWAYS open the review form so the user can verify/complete the data
      // (e.g. a missing price the AI couldn't read). OK/Cancel only picks the save target.
      let mergeIntoBookingId: number | null = null;
      if (data.plannedMatch) {
        const m = data.plannedMatch;
        const merge = confirm(
          `You already have this flight planned (${m.route}).\n\n` +
          `OK = update that planned flight with this booking\n` +
          `Cancel = save as a separate new booking`,
        );
        if (merge) mergeIntoBookingId = m.booking_id;
      }

      // Always show the review form; carry the merge target + mark this as a real booking.
      setReviewData({ ...data, mergeIntoBookingId });
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

  async function unconfirm(id: number) {
    if (!confirm('Move this flight back to shortlisted? It will be removed from your forecast until you confirm it again.')) return;
    const res = await fetch(`/api/trips/${tripId}/flights/bookings/${id}/unconfirm`, { method: 'POST' });
    if (res.ok) loadBookings();
    else alert('This booking cannot be moved back to shortlisted.');
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
        tripId={tripId}
        data={reviewData}
        mergeIntoBookingId={reviewData.mergeIntoBookingId ?? null}
        currencies={currencies}
        onCancel={() => setReviewData(null)}
        onSaved={() => { setReviewData(null); loadBookings(); }}
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

      {/* Doors: AI suggest (live), search (coming soon) */}
      <div className="mt-4 flex gap-3 flex-wrap items-center">
        <button onClick={() => setSuggestOpen((v) => !v)}
          className="text-[13px] font-semibold px-4 py-2 rounded-lg"
          style={{ background: 'color-mix(in srgb, var(--accent) 14%, transparent)', color: 'var(--accent-deep)', cursor: 'pointer' }}>
          ✦ Suggest flights with AI
        </button>
        <div className="text-[12px] px-3 py-2 rounded-lg" style={{ background: 'color-mix(in srgb, var(--ink) 4%, transparent)', color: 'var(--ink-faint)' }}>
          🔍 Search flights in-app — coming soon
        </div>
      </div>

      {suggestOpen && (
        <div className="mt-4">
          <FlightSuggestPanel tripId={tripId} onShortlisted={loadBookings} onClose={() => setSuggestOpen(false)} />
        </div>
      )}

      {/* Booking list — grouped: Confirmed + Considering */}
      {(() => {
        const confirmed = bookings.filter((b) => b.status === 'confirmed');
        const shortlisted = bookings.filter((b) => b.status === 'shortlisted');

        const sortedShort = [...shortlisted].sort((a, b) => {
          if (sortKey === 'price') return (a.total_paid ?? Infinity) - (b.total_paid ?? Infinity);
          if (sortKey === 'fastest') return totalDuration(a.legs) - totalDuration(b.legs);
          return earliestDepart(a.legs).localeCompare(earliestDepart(b.legs));
        });

        if (loadingList) return <p className="mt-8 text-[13px]" style={{ color: 'var(--ink-faint)' }}>Loading…</p>;
        if (bookings.length === 0) return <p className="mt-8 text-[13px] text-center py-8" style={{ color: 'var(--ink-faint)' }}>No bookings yet. Upload an itinerary or ask AI to suggest options.</p>;


        function renderBookingCard(b: any) {
          return (
            <div key={b.booking_id} className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              {/* header */}
              <div className="flex items-center gap-3 px-5 py-3.5" style={{ borderBottom: '1px solid var(--divider)' }}>
                <span className="text-[15px] font-bold" style={{ color: 'var(--ink)' }}>{b.booking_source || 'Booking'}</span>
                {b.status === 'shortlisted' ? (
                  <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: 'color-mix(in srgb, var(--ink) 8%, transparent)', color: 'var(--ink-soft)' }}>Shortlisted</span>
                ) : b.booking_confirmed === 1 ? (
                  <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: 'color-mix(in srgb, var(--success) 16%, transparent)', color: 'var(--success)' }}>✓ Booked</span>
                ) : (
                  <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: 'color-mix(in srgb, var(--accent) 16%, transparent)', color: 'var(--accent-deep)' }}>Planned</span>
                )}
                {b.airline_pnr && <span className="text-[12px] font-mono" style={{ color: 'var(--ink-soft)' }}>{b.airline_pnr}</span>}
                {(() => {
                  const isBooked = b.booking_confirmed === 1;
                  const amount = isBooked ? b.total_paid : b.estimated_price;
                  return amount != null ? (
                    <span className="ml-auto text-[15px] font-extrabold" style={{ color: 'var(--accent-deep)' }}>
                      {b.currency_code} {amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      {!isBooked && <span className="text-[11px] font-normal ml-1" style={{ color: 'var(--ink-faint)' }}>est.</span>}
                    </span>
                  ) : (
                    <span className="ml-auto text-[13px]" style={{ color: 'var(--danger)' }}>Add price</span>
                  );
                })()}
                {b.booking_confirmed === 1 && (
                  <VarianceChip estimate={b.estimated_price} actual={b.total_paid} currency={b.currency_code} compact />
                )}
                <button onClick={() => deleteBooking(b.booking_id)} title="Delete booking" className="tw-link ml-3" style={{ color: 'var(--ink-faint)' }}>🗑</button>
              </div>

              {/* legs — clickable to edit */}
              <button onClick={() => openForEdit(b)} className="tw-legs w-full text-left px-5 py-3" style={{ cursor: 'pointer' }}>
                {b.legs.map((l: any) => (
                  <div key={l.leg_id ?? `${l.departure_airport_code}-${l.leg_order}`} className="grid items-center gap-4 py-1.5" style={{ gridTemplateColumns: '60px 1fr auto' }}>
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

              {/* footer — differs by status */}
              {b.status === 'shortlisted' ? (
                <div className="flex items-center gap-2 px-5 py-3" style={{ borderTop: '1px solid var(--divider)' }}>
                  <span className="text-[12px]" style={{ color: 'var(--ink-soft)' }}>Shortlisted — confirm to add it to your forecast.</span>
                  <button onClick={() => openForEdit(b)} className="tw-btn ml-auto text-[12px] font-semibold px-3.5 py-1.5 rounded-lg"
                    style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}>
                    Confirm this flight →
                  </button>
                </div>
              ) : (
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
                  <div className="ml-auto flex items-center gap-3">
                    {b.booking_confirmed !== 1 && (
                      <button onClick={() => setBookingPanelFor(bookingPanelFor === b.booking_id ? null : b.booking_id)}
                        className="tw-link text-[12px] font-semibold" style={{ color: 'var(--success)' }}>
                        ✈ I've confirmed this
                      </button>
                    )}
                    {b.source !== 'pdf' && b.booking_confirmed !== 1 && (
                      <button onClick={() => unconfirm(b.booking_id)} className="tw-link text-[12px]" style={{ color: 'var(--ink-soft)' }}>
                        ↩ Move to shortlist
                      </button>
                    )}
                    <button onClick={() => openForEdit(b)} className="tw-link text-[12px] font-semibold" style={{ color: 'var(--accent-deep)' }}>Edit booking →</button>
                  </div>
                </div>
              )}

              {/* Planned → Booked panel */}
              {bookingPanelFor === b.booking_id && (
                <div className="px-5 pb-4">
                  <BookPlannedFlight
                    tripId={tripId}
                    bookingId={b.booking_id}
                    currencies={currencies}
                    estimatedPrice={b.estimated_price ?? null}
                    currency={b.currency_code ?? null}
                    onCancel={() => setBookingPanelFor(null)}
                    onBooked={() => { setBookingPanelFor(null); loadBookings(); }}
                  />
                </div>
              )}
            </div>
          );
        }

        return (
          <>
            {/* CONFIRMED */}
            {confirmed.length > 0 && (
              <div className="mt-8">
                <h2 className="text-xs font-bold uppercase mb-3" style={{ color: 'var(--accent-deep)', letterSpacing: '0.4px' }}>Confirmed bookings</h2>
                <div className="space-y-3">
                  {confirmed.map((b) => renderBookingCard(b))}
                </div>
              </div>
            )}

            {/* CONSIDERING — compare board */}
            {shortlisted.length > 0 && (
              <div className="mt-8">
                <div className="flex items-center gap-3 mb-3 flex-wrap">
                  <h2 className="text-xs font-bold uppercase" style={{ color: 'var(--accent-deep)', letterSpacing: '0.4px' }}>Considering ({shortlisted.length})</h2>
                  <div className="flex items-center gap-1.5 ml-auto">
                    <span className="text-[12px]" style={{ color: 'var(--ink-faint)' }}>Sort</span>
                    {(['price', 'fastest', 'earliest'] as const).map((k) => (
                      <button key={k} onClick={() => setSortKey(k)}
                        className="text-[12px] px-2.5 py-1 rounded-lg"
                        style={{
                          background: sortKey === k ? 'color-mix(in srgb, var(--accent) 18%, transparent)' : 'transparent',
                          color: sortKey === k ? 'var(--accent-deep)' : 'var(--ink-soft)',
                          border: `1px solid ${sortKey === k ? 'transparent' : 'var(--border)'}`,
                          fontWeight: sortKey === k ? 600 : 400, cursor: 'pointer',
                        }}>
                        {k === 'price' ? 'Cheapest' : k === 'fastest' ? 'Fastest' : 'Earliest'}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2.5">
                  {sortedShort.map((b) => renderBookingCard(b))}
                </div>
              </div>
            )}
          </>
        );
      })()}
    </div>
  );
}