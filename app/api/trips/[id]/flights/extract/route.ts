// app/api/trips/[id]/flights/extract/route.ts
import { NextResponse } from 'next/server';
import { getUserContext } from '@/app/lib/auth/context';
import { extractFlightBooking } from '@/app/lib/services/flight-extraction';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = new Set(['application/pdf', 'text/plain']);

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getUserContext();
  if (!ctx) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const { id } = await params;
  const tripId = Number(id);
  if (!Number.isInteger(tripId)) return NextResponse.json({ error: 'Invalid trip id' }, { status: 400 });

  let file: File;
  try {
    const fd = await request.formData();
    const f = fd.get('file');
    if (!(f instanceof File)) return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    file = f;
  } catch {
    return NextResponse.json({ error: 'Bad upload' }, { status: 400 });
  }
  if (file.size === 0) return NextResponse.json({ error: 'File is empty' }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'File is too large (max 10 MB).' }, { status: 400 });

  let mimeType = file.type;
  if (!ALLOWED.has(mimeType)) {
    const name = file.name.toLowerCase();
    if (name.endsWith('.pdf')) mimeType = 'application/pdf';
    else if (name.endsWith('.txt')) mimeType = 'text/plain';
    else return NextResponse.json({ error: 'Only PDF and plain text are supported.' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const result = await extractFlightBooking(buffer, mimeType);
  // Extract-and-discard: the PDF is not stored. Return structured data only.
  return NextResponse.json(result);
}