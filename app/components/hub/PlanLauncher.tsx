// app/components/hub/PlanLauncher.tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import CopilotHero from '@/app/components/hub/CopilotHero';
import PlanPanel from '@/app/components/copilot/PlanPanel';

export default function PlanLauncher({ firstName }: { firstName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [seed, setSeed] = useState('');

  function openPanel(prompt: string) { setSeed(prompt); setOpen(true); }
  function closePanel() { setOpen(false); router.refresh(); /* new trip shows in the list */ }

  return (
    <>
      <CopilotHero firstName={firstName} onStart={openPanel} />
      <PlanPanel open={open} initialPrompt={seed} onClose={closePanel} />
    </>
  );
}