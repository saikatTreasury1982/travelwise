// app/components/ui/LoadingOverlay.tsx
'use client';

interface LoadingOverlayProps {
  isLoading: boolean;
  message?: string;
}

export default function LoadingOverlay({ isLoading, message = 'Processing…' }: LoadingOverlayProps) {
  if (!isLoading) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
      <div className="flex flex-col items-center gap-4">
        <div
          className="w-12 h-12 rounded-full animate-spin"
          style={{ border: '4px solid var(--accent)', borderTopColor: 'transparent' }}
        />
        <p className="text-sm font-medium" style={{ color: '#FFFFFF' }}>{message}</p>
      </div>
    </div>
  );
}