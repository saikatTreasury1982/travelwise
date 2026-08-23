// app/api/auth/password/requirements/route.ts
// Returns the active password policy's human-readable description, so the
// create-password UI can show the rules. Reads password_patterns (id='active').
import { NextResponse } from 'next/server';
import { getPasswordPattern } from '@/app/lib/services/password-service';

export async function GET() {
  const pattern = await getPasswordPattern();
  if (!pattern) {
    return NextResponse.json({ description: 'Password must be at least 8 characters.' });
  }
  return NextResponse.json({
    description: pattern.description,
    minLength: pattern.min_length,
    requireUppercase: !!pattern.require_uppercase,
    requireNumbers: !!pattern.require_numbers,
  });
}