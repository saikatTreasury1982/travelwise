// app/components/admin/UploadToolCard.tsx
'use client';
import { useState, useRef } from 'react';

export default function UploadToolCard({
  title, description, endpoint, accept = '.csv',
}: { title: string; description: string; endpoint: string; accept?: string }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  async function run() {
    const file = fileRef.current?.files?.[0];
    if (!file) { setResult('Choose a file first.'); return; }
    setBusy(true); setResult(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(endpoint, { method: 'POST', body: fd });
      const data = await res.json();
      setResult(JSON.stringify(data, null, 2));
    } catch (e) {
      setResult(`Error: ${e instanceof Error ? e.message : 'failed'}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <h3 className="text-[15px] font-semibold mb-1" style={{ color: 'var(--ink)' }}>{title}</h3>
      <p className="text-[13px] mb-4" style={{ color: 'var(--ink-soft)' }}>{description}</p>
      <input
        ref={fileRef} type="file" accept={accept}
        onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
        className="block text-[13px] mb-3"
        style={{ color: 'var(--ink-soft)' }}
      />
      <button
        onClick={run} disabled={busy}
        className="text-[13px] font-semibold px-4 py-2 rounded-lg"
        style={{
          background: busy ? 'color-mix(in srgb, var(--accent) 40%, transparent)' : 'var(--accent)',
          color: 'var(--accent-ink)', cursor: busy ? 'default' : 'pointer',
        }}
      >
        {busy ? 'Importing…' : 'Import'}
      </button>
      {result && (
        <pre className="mt-4 p-3 rounded-lg text-[12px] overflow-x-auto"
          style={{ background: 'color-mix(in srgb, var(--ink) 4%, transparent)', color: 'var(--ink-soft)', maxHeight: 240 }}>
          {result}
        </pre>
      )}
    </div>
  );
}