// app/components/hub/TripStatusControl.tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

const LABELS: Record<number, string> = { 1: 'Draft', 2: 'Active', 3: 'Completed', 4: 'Suspended' };

export default function TripStatusControl({
    tripId, statusCode,
}: { tripId: number; statusCode: number }) {
    const router = useRouter();
    const [status, setStatus] = useState(statusCode);
    const [busy, setBusy] = useState(false);
    const suspended = status === 4;
    const completed = status === 3;
    const active = status === 2;
    const badgeStyle = (): React.CSSProperties => {
        if (suspended) return { background: 'color-mix(in srgb, var(--danger) 12%, transparent)', color: 'var(--danger)' };
        if (completed) return { background: 'color-mix(in srgb, var(--success) 12%, transparent)', color: 'var(--success)' };
        if (active) return { background: 'var(--accent)', color: 'var(--accent-ink)' };
        return { background: 'color-mix(in srgb, var(--ink) 6%, transparent)', color: 'var(--ink-soft)' }; // Draft
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

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 600, padding: '5px 12px', borderRadius: 999, ...badgeStyle() }}>
                {LABELS[status] ?? 'Draft'}
            </span>
            {/* Suspend/Reactivate only for non-completed trips. Completed shows badge only. */}
            {!completed && (
                <button
                    onClick={toggle}
                    disabled={busy}
                    style={{
                        fontSize: 12, fontWeight: 600, padding: '5px 12px', borderRadius: 8,
                        border: '1px solid var(--border)', background: 'var(--surface)',
                        color: 'var(--ink-soft)', cursor: busy ? 'default' : 'pointer',
                        opacity: busy ? 0.6 : 1,
                    }}
                >
                    {suspended ? 'Reactivate' : 'Suspend'}
                </button>
            )}
        </div>
    );
}