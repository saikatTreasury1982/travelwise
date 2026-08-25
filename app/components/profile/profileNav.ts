import type { SubNavItem } from '@/app/components/settings/SettingsShell';

export const PROFILE_NAV: SubNavItem[] = [
  { key: 'details',  label: 'Details',        href: '/profile' },
  { key: 'visited',  label: 'Visited places', href: '/profile/visited' },
  { key: 'journals', label: 'Journals',       href: '/profile/journals' },
  { key: 'guides',   label: 'Guides',         href: '/profile/guides' },
];