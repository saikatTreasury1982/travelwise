// app/plan/page.tsx
import { redirect } from 'next/navigation';

// Trip planning now happens in a slide-over panel on the My Trips page.
// This route is kept only to redirect any old links/bookmarks.
export default function PlanPage() {
  redirect('/trips');
}