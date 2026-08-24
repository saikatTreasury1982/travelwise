// app/components/settings/nav.ts
import type { SubNavItem } from './SettingsShell';

export const PROFILE_NAV: SubNavItem[] = [
  { key: 'details', label: 'Details', href: '/profile' },
  { key: 'visited', label: 'Visited places', href: '/profile/visited' },
  { key: 'journals', label: 'Journals', href: '/profile/journals' },
  { key: 'guides', label: 'Guides', href: '/profile/guides' },
];

export const ACCOUNT_NAV: SubNavItem[] = [
  { key: 'password', label: 'Password', href: '/account' },
  { key: 'passkeys', label: 'Passkeys', href: '/account/passkeys' },
  { key: 'plan', label: 'Plan', href: '/account/plan' },
];

export const SETTINGS_NAV: SubNavItem[] = [
  { key: 'appearance', label: 'Appearance', href: '/settings' },
  { key: 'notifications', label: 'Notifications', href: '/settings/notifications' },
  { key: 'preferences', label: 'Preferences', href: '/settings/preferences' },
];