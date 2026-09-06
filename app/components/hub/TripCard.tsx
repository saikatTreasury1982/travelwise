// app/components/hub/TripCard.tsx
import Link from 'next/link';

const LABELS: Record<number, string> = { 1: 'Draft', 2: 'Active', 3: 'Completed', 4: 'Suspended' };
function statusBadge(code: number | null): { label: string; style: React.CSSProperties } {
  const c = code ?? 1;
  const base: React.CSSProperties = { fontSize: 11, fontWeight: 600 };
  if (c === 4) return { label: 'Suspended', style: { ...base, background: 'color-mix(in srgb, var(--danger) 12%, transparent)', color: 'var(--danger)' } };
  if (c === 3) return { label: 'Completed', style: { ...base, background: 'color-mix(in srgb, var(--success) 12%, transparent)', color: 'var(--success)' } };
  if (c === 2) return { label: 'Active', style: { ...base, background: 'var(--accent)', color: 'var(--accent-ink)' } };
  return { label: 'Draft', style: { ...base, background: 'color-mix(in srgb, var(--ink) 6%, transparent)', color: 'var(--ink-soft)' } };
}

interface TripCardProps {
  trip: {
    trip_id: number; trip_name: string; start_date: string; end_date: string;
    status_code: number | null; trip_budget: number | null; budget_currency: string | null;
    destinations: Array<{ country: string; city: string | null }>;
    cover_image_url?: string | null;
    cover_image_credit?: string | null;
    cover_image_link?: string | null;
  };
}

function fmtDate(d: string) {
  try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
  catch { return d; }
}

export default function TripCard({ trip }: TripCardProps) {
  const places = trip.destinations.map((d) => d.city || d.country).filter(Boolean).join(', ');
  const hasCover = !!trip.cover_image_url;

  return (
    <Link href={`/trips/${trip.trip_id}`} className="block rounded-2xl overflow-hidden transition-transform hover:-translate-y-0.5"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      {/* header — cover photo, or the navy gradient fallback */}
      <div className="relative" style={{ height: 120, backgroundColor: 'var(--panel)' }}>
        {hasCover ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={trip.cover_image_url as string}
              alt={places || trip.trip_name}
              className="w-full h-full object-cover"
              loading="lazy"
            />
            {/* subtle bottom gradient so any overlaid text stays legible */}
            <div className="absolute inset-x-0 bottom-0 h-10" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.45), transparent)' }} />
            {trip.cover_image_credit && (
              <span className="absolute bottom-1 right-2 text-[10px]" style={{ color: 'rgba(255,255,255,0.75)' }}>
                {trip.cover_image_credit}
              </span>
            )}
          </>
        ) : (
          <div className="w-full h-full" style={{ backgroundImage: 'radial-gradient(200px 120px at 30% 20%, rgba(52,96,156,0.6), transparent)' }} />
        )}
      </div>

      <div className="p-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[16px] font-bold truncate" style={{ color: 'var(--ink)' }}>{trip.trip_name}</span>
          {(() => {
            const b = statusBadge(trip.status_code); return (
              <span className="px-2 py-0.5 rounded-full flex-shrink-0 ml-2" style={b.style}>
                {b.label}
              </span>
            );
          })()}
        </div>
        <p className="text-[13px] mb-2" style={{ color: 'var(--ink-soft)' }}>
          {fmtDate(trip.start_date)} – {fmtDate(trip.end_date)}{places ? ` · ${places}` : ''}
        </p>
        {trip.trip_budget != null && (
          <p className="text-[12px]" style={{ color: 'var(--ink-faint)' }}>
            Budget: {trip.budget_currency ?? ''} {trip.trip_budget.toLocaleString()}
          </p>
        )}
      </div>
    </Link>
  );
}