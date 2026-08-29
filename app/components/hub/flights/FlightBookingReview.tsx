'use client';
import { useState, useEffect } from 'react';
import AirportCombobox, { type AirportChoice } from '@/app/components/ui/AirportCombobox';
import CurrencyCombobox from '@/app/components/ui/CurrencyCombobox';

interface Leg {
    leg_order: number;
    departure_airport_code: string | null;
    departure_airport_name: string | null;
    departure_city: string | null;
    departure_datetime: string | null;
    arrival_airport_code: string | null;
    arrival_airport_name: string | null;
    arrival_city: string | null;
    arrival_datetime: string | null;
    airline: string | null;
    flight_number: string | null;
    cabin_class: string | null;
    duration_minutes: number | null;
    baggage_allowance: string | null;
    [key: string]: any;
}
interface Booking {
    agency_reference: string | null;
    airline_pnr: string | null;
    booking_source: string | null;
    booking_date: string | null;
    total_paid: number | null;
    base_fare: number | null;
    currency_code: string | null;
    [key: string]: any;
}
interface ExtractionData {
    booking: Booking;
    legs: Leg[];
    uncertain_fields: string[];
    document_notes: string | null;
}
interface Traveler {
    traveler_id: number; traveler_name: string;
    is_primary: number; is_cost_sharer: number; is_active: number;
}
interface Props {
    tripId: number;
    bookingId?: number;
    data: ExtractionData;
    initialBearerIds?: number[];
    currencies: { currency_code: string; currency_name: string; currency_symbol?: string | null }[];
    onSaved: () => void;
    onCancel: () => void;
}

export default function FlightBookingReview({ tripId, bookingId, data, initialBearerIds, currencies, onCancel, onSaved }: Props) {
    const [booking, setBooking] = useState<Booking>(data.booking);
    const [legs, setLegs] = useState<Leg[]>(data.legs);
    const [uncertain, setUncertain] = useState<Set<string>>(new Set(data.uncertain_fields));
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // payer picker (mandatory) — cost-sharers only
    const [roster, setRoster] = useState<Traveler[]>([]);
    const [bearers, setBearers] = useState<Set<number>>(new Set(initialBearerIds ?? []));

    useEffect(() => {
        (async () => {
            const r = await fetch(`/api/trips/${tripId}/travelers`);
            if (r.ok) setRoster((await r.json()).travelers);
        })();
    }, [tripId]);

    const eligible = roster.filter((t) => t.is_active === 1 && t.is_cost_sharer === 1);

    const clearFlag = (path: string) =>
        setUncertain((prev) => { if (!prev.has(path)) return prev; const n = new Set(prev); n.delete(path); return n; });
    const setBookingField = (k: keyof Booking, v: any) => { setBooking((b) => ({ ...b, [k]: v })); clearFlag(`booking.${k}`); };
    const setLegField = (i: number, k: keyof Leg, v: any) => {
        setLegs((prev) => prev.map((l, idx) => (idx === i ? { ...l, [k]: v } : l))); clearFlag(`legs[${i}].${k}`);
    };
    const setLegAirport = (i: number, side: 'departure' | 'arrival', a: AirportChoice) => {
        setLegs((prev) => prev.map((l, idx) => idx === i ? {
            ...l, [`${side}_airport_code`]: a.iata_code, [`${side}_airport_name`]: a.airport_name, [`${side}_city`]: a.city,
        } : l));
        clearFlag(`legs[${i}].${side}_airport_code`);
    };
    const removeLeg = (i: number) =>
        setLegs((prev) => prev.filter((_, idx) => idx !== i).map((l, idx) => ({ ...l, leg_order: idx + 1 })));
    const toggleBearer = (id: number) =>
        setBearers((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

    const isFlagged = (path: string) => uncertain.has(path);
    const priceNeedsCurrency = booking.total_paid != null && !booking.currency_code?.trim();
    const needsPrice = booking.total_paid == null || !booking.currency_code?.trim();

    const canSave =
        legs.length > 0 &&
        legs.every((l) => l.departure_datetime && l.arrival_datetime) &&
        !needsPrice &&               // confirmed booking needs price + currency
        bearers.size > 0;           // Decision 2a — at least one payer

    const save = async () => {
        setSaving(true); setError(null);
        try {
            const editing = bookingId != null;
            // Create: single POST with bearers → expense emits atomically.
            // Edit: PUT booking/legs, then PUT payers.
            const res = await fetch(
                editing ? `/api/trips/${tripId}/flights/bookings/${bookingId}` : `/api/trips/${tripId}/flights/bookings`,
                {
                    method: editing ? 'PUT' : 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        booking, legs,
                        bearer_traveler_ids: [...bearers],
                        status: 'confirmed', source: 'pdf',
                    }),
                },
            );
            if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed to save booking');

            if (editing) {
                // ensure payers are synced on edit
                await fetch(`/api/trips/${tripId}/flights/bookings/${bookingId}/travelers`, {
                    method: 'PUT', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ traveler_ids: [...bearers] }),
                });
            }
            onSaved();
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to save');
        } finally {
            setSaving(false);
        }
    };

    const inputStyle = (flagged: boolean): React.CSSProperties => ({
        width: '100%', padding: '6px 8px', borderRadius: 8, fontSize: 14,
        background: flagged ? 'color-mix(in srgb, var(--accent) 6%, var(--surface))' : 'var(--surface)',
        border: `1px solid ${flagged ? 'var(--accent)' : 'var(--border)'}`,
        color: 'var(--ink)', outline: 'none',
    });
    const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 24 };

    return (
        <div style={card}>
            <div className="flex items-center justify-between mb-5">
                <h3 className="text-[19px] font-semibold" style={{ color: 'var(--ink)' }}>
                    {bookingId != null ? 'Edit booking' : 'Review booking'}
                </h3>
                {data.document_notes && <span className="text-[13px]" style={{ color: 'var(--accent-deep)' }}>{data.document_notes}</span>}
            </div>

            {/* Booking header strip */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                <Field label="Source">
                    <input value={booking.booking_source ?? ''} onChange={(e) => setBookingField('booking_source', e.target.value)} style={inputStyle(isFlagged('booking.booking_source'))} />
                </Field>
                <Field label="Agency ref">
                    <input value={booking.agency_reference ?? ''} onChange={(e) => setBookingField('agency_reference', e.target.value)} style={inputStyle(isFlagged('booking.agency_reference'))} />
                </Field>
                <Field label="Airline PNR">
                    <input value={booking.airline_pnr ?? ''} onChange={(e) => setBookingField('airline_pnr', e.target.value)} style={inputStyle(isFlagged('booking.airline_pnr'))} />
                </Field>
                <Field label="Total paid">
                    <div className="flex gap-1 items-start">
                        <CurrencyCombobox
                            value={booking.currency_code ?? ''}
                            currencies={currencies}
                            onSelect={(code) => setBookingField('currency_code', code)}
                            className="!h-[38px] w-24"
                        />
                        <input type="number" value={booking.total_paid ?? ''} onChange={(e) => setBookingField('total_paid', e.target.value ? parseFloat(e.target.value) : null)} style={inputStyle(isFlagged('booking.total_paid'))} />
                    </div>
                </Field>
            </div>

            {/* Legs table */}
            <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                    <thead>
                        <tr className="text-left text-[11px] uppercase" style={{ color: 'var(--ink-faint)', letterSpacing: '.4px' }}>
                            <th className="py-2 pr-2">#</th><th className="py-2 pr-2">Flight</th>
                            <th className="py-2 pr-2 w-48">From</th><th className="py-2 pr-2 w-48">To</th>
                            <th className="py-2 pr-2">Depart</th><th className="py-2 pr-2">Arrive</th>
                            <th className="py-2 pr-2">Cabin</th><th className="py-2 pr-2">Baggage</th><th className="py-2"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {legs.map((l, i) => (
                            <tr key={i} className="align-top" style={{ borderTop: '1px solid var(--divider)' }}>
                                <td className="py-2 pr-2" style={{ color: 'var(--ink-faint)' }}>{i + 1}</td>
                                <td className="py-2 pr-2">
                                    <div className="flex flex-col gap-1">
                                        <input value={l.flight_number ?? ''} onChange={(e) => setLegField(i, 'flight_number', e.target.value)} placeholder="Flight #" style={{ ...inputStyle(isFlagged(`legs[${i}].flight_number`)), width: 128 }} />
                                        <input value={l.airline ?? ''} onChange={(e) => setLegField(i, 'airline', e.target.value)} placeholder="Airline" style={{ ...inputStyle(isFlagged(`legs[${i}].airline`)), width: 128, fontSize: 12 }} />
                                    </div>
                                </td>
                                <td className="py-2 pr-2">
                                    <AirportCombobox value={l.departure_airport_code} displayCity={l.departure_city} displayName={l.departure_airport_name} highlight={isFlagged(`legs[${i}].departure_airport_code`)} onSelect={(a) => setLegAirport(i, 'departure', a)} />
                                </td>
                                <td className="py-2 pr-2">
                                    <AirportCombobox value={l.arrival_airport_code} displayCity={l.arrival_city} displayName={l.arrival_airport_name} highlight={isFlagged(`legs[${i}].arrival_airport_code`)} onSelect={(a) => setLegAirport(i, 'arrival', a)} />
                                </td>
                                <td className="py-2 pr-2">
                                    <input type="datetime-local" value={l.departure_datetime ?? ''} onChange={(e) => setLegField(i, 'departure_datetime', e.target.value)} style={inputStyle(isFlagged(`legs[${i}].departure_datetime`))} />
                                </td>
                                <td className="py-2 pr-2">
                                    <input type="datetime-local" value={l.arrival_datetime ?? ''} onChange={(e) => setLegField(i, 'arrival_datetime', e.target.value)} style={inputStyle(isFlagged(`legs[${i}].arrival_datetime`))} />
                                </td>
                                <td className="py-2 pr-2">
                                    <input value={l.cabin_class ?? ''} onChange={(e) => setLegField(i, 'cabin_class', e.target.value)} style={{ ...inputStyle(isFlagged(`legs[${i}].cabin_class`)), width: 96 }} />
                                </td>
                                <td className="py-2 pr-2">
                                    <input value={l.baggage_allowance ?? ''} onChange={(e) => setLegField(i, 'baggage_allowance', e.target.value)} style={{ ...inputStyle(isFlagged(`legs[${i}].baggage_allowance`)), width: 160 }} />
                                </td>
                                <td className="py-2">
                                    {legs.length > 1 && (
                                        <button type="button" onClick={() => removeLeg(i)} title="Remove leg" style={{ color: 'var(--ink-faint)' }}>✕</button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Mandatory payer picker (Decision 2a) */}
            <div className="mt-6 rounded-xl p-4" style={{ background: 'color-mix(in srgb, var(--accent) 5%, var(--surface))', border: '1px solid var(--border)' }}>
                <div className="flex items-center justify-between mb-3">
                    <div className="text-[13px] font-semibold" style={{ color: 'var(--ink)' }}>Who's paying for this flight? <span style={{ color: 'var(--danger)' }}>*</span></div>
                    <div className="text-[12px]" style={{ color: bearers.size > 0 ? 'var(--success)' : 'var(--ink-faint)' }}>
                        {bearers.size > 0 ? `${bearers.size} selected` : 'required'}
                    </div>
                </div>
                {eligible.length === 0 ? (
                    <p className="text-[13px]" style={{ color: 'var(--ink-faint)' }}>No cost-sharing travellers on this trip. Add one first.</p>
                ) : (
                    <div className="flex flex-wrap gap-2">
                        {eligible.map((t) => {
                            const on = bearers.has(t.traveler_id);
                            return (
                                <button key={t.traveler_id} onClick={() => toggleBearer(t.traveler_id)}
                                    className="text-[13px] px-3 py-1.5 rounded-full transition-colors"
                                    style={{
                                        background: on ? 'var(--accent)' : 'var(--surface)',
                                        color: on ? 'var(--accent-ink)' : 'var(--ink-soft)',
                                        border: `1px solid ${on ? 'transparent' : 'var(--border)'}`,
                                        cursor: 'pointer', fontWeight: on ? 600 : 400,
                                    }}>
                                    {t.traveler_name}{t.is_primary === 1 ? ' ★' : ''}
                                </button>
                            );
                        })}
                    </div>
                )}
                <p className="text-[11px] mt-2" style={{ color: 'var(--ink-faint)' }}>The fare is split equally among the selected payers.</p>
            </div>

            {error && <div className="mt-4 p-3 rounded-lg text-sm" style={{ background: 'color-mix(in srgb, var(--danger) 12%, transparent)', border: '1px solid var(--danger)', color: 'var(--danger)' }}>{error}</div>}
            {priceNeedsCurrency && <p className="text-[13px] text-right mt-3" style={{ color: 'var(--accent-deep)' }}>Enter a currency for the amount.</p>}

            <div className="flex justify-end gap-3 mt-6">
                <button onClick={onCancel} className="text-[14px] px-4 py-2 rounded-lg" style={{ color: 'var(--ink-soft)' }}>Cancel</button>
                <button onClick={save} disabled={!canSave || saving}
                    className="text-[14px] font-semibold px-5 py-2 rounded-lg"
                    style={{
                        background: (!canSave || saving) ? 'color-mix(in srgb, var(--accent) 40%, transparent)' : 'var(--accent)',
                        color: 'var(--accent-ink)', cursor: (!canSave || saving) ? 'default' : 'pointer',
                    }}>
                    {saving ? 'Saving…' : 'Save booking'}
                </button>
            </div>
        </div>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <label className="block text-[11px] mb-1" style={{ color: 'var(--ink-faint)' }}>{label}</label>
            {children}
        </div>
    );
}