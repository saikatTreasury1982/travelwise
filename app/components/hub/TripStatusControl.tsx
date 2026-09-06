// app/components/hub/TripStatusControl.tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
const LABELS: Record<number, string> = { 1: 'Draft', 2: 'Active', 3: 'Completed', 4: 'Suspended' };
export default function TripStatusControl({
    tripId, statusCode, variant = 'default',
}: { tripId: number; statusCode: number; variant?: 'default' | 'onImage' }) {
    const router = useRouter();
    const [status, setStatus] = useState(statusCode);
    const [busy, setBusy] = useState(false);
    const suspended = status === 4;
    const completed = status === 3;
    const active = status === 2;
    const onImage = variant === 'onImage';

    // Dot colour per state — lightened on-image so it reads over dark photos.
    const dotColor = (): string => {
        if (onImage) {
            if (suspended) return '#F0A868';
            if (completed) return '#7FE0A8';
            if (active) return '#5FD08A';
            return '#E8C77F'; // Draft
        }
        if (suspended) return 'var(--danger)';
        if (completed) return 'var(--success)';
        if (active) return 'var(--success)';
        return 'var(--accent)'; // Draft
    };

    // ----- badge styling -----
    const badgeStyle = (): React.CSSProperties => {
        if (onImage) {
            return {
                display: 'inline-flex', alignItems: 'center', gap: 7,
                fontSize: 12.5, fontWeight: 600, padding: '7px 13px', borderRadius: 999,
                background: 'rgba(255,255,255,0.14)', color: '#fff',
                border: '1px solid rgba(255,255,255,0.22)',
                backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
                boxShadow: '0 2px 10px rgba(0,0,0,0.15)',
            };
        }
        // default (unchanged look)
        const base: React.CSSProperties = { fontSize: 12, fontWeight: 600, padding: '5px 12px', borderRadius: 999 };
        if (suspended) return { ...base, background: 'color-mix(in srgb, var(--danger) 12%, transparent)', color: 'var(--danger)' };
        if (completed) return { ...base, background: 'color-mix(in srgb, var(--success) 12%, transparent)', color: 'var(--success)' };
        if (active) return { ...base, background: 'var(--accent)', color: 'var(--accent-ink)' };
        return { ...base, background: 'color-mix(in srgb, var(--ink) 6%, transparent)', color: 'var(--ink-soft)' }; // Draft
    };

    // ----- button styling -----
    const buttonStyle = (): React.CSSProperties => {
        if (onImage) {
            return {
                fontSize: 12, fontWeight: 600, padding: '7px 13px', borderRadius: 8,
                background: 'rgba(255,255,255,0.14)', color: '#fff',
                border: '1px solid rgba(255,255,255,0.22)',
                backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
                boxShadow: '0 2px 10px rgba(0,0,0,0.15)',
                cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1,
            };
        }
        return {
            fontSize: 12, fontWeight: 600, padding: '5px 12px', borderRadius: 8,
            border: '1px solid var(--border)', background: 'var(--surface)',
            color: 'var(--ink-soft)', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1,
        };
    };

    async function toggle() {
        if (busy) return;
        setBusy(true);
        const prev = status;
        // Optimistic: flip immediately (non-financial → guideline 2.2 allows revert).
        setStatus(suspended ? 1 : 4);
        try {
            const res = await fetch(`/api/trips/${tripId}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ suspend: !suspended }),
            });
            if (!res.ok) throw new Error();
            const data = await res.json();
            setStatus(Number(data.status_code)); // land on server-resolved code
            router.refresh(); // re-pull the hub so module cards reflect any change
        } catch {
            setStatus(prev); // rollback
        } finally {
            setBusy(false);
        }
    }

    const dotPulse = onImage && active; // pulse a live trip's dot on the hero

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={badgeStyle()}>
                <span
                    style={{
                        width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                        background: dotColor(),
                        boxShadow: onImage ? '0 0 0 3px rgba(255,255,255,0.18)' : undefined,
                        animation: dotPulse ? 'twStatusPulse 2s infinite' : undefined,
                    }}
                />
                {LABELS[status] ?? 'Draft'}
            </span>
            {/* Suspend/Reactivate only for non-completed trips. Completed shows badge only. */}
            {!completed && (
                <button onClick={toggle} disabled={busy} style={buttonStyle()}>
                    {suspended ? 'Reactivate' : 'Suspend'}
                </button>
            )}
            {dotPulse && (
                <style>{`@keyframes twStatusPulse{0%,100%{box-shadow:0 0 0 0 rgba(95,208,138,.5)}50%{box-shadow:0 0 0 5px rgba(95,208,138,0)}}`}</style>
            )}
        </div>
    );
}