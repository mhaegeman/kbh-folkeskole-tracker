import type { School } from './types';

const nf = (d: number) => new Intl.NumberFormat('da-DK', { minimumFractionDigits: d, maximumFractionDigits: d });

export function fmt(v: number | null | undefined, digits = 1, suffix = ''): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  return nf(digits).format(v) + suffix;
}

export function fmtDKK(v: number | null | undefined): string {
  if (v === null || v === undefined) return '—';
  if (v === 0) return 'Free';
  return `${nf(0).format(v)} kr.`;
}

export function fmtSigned(v: number | null | undefined, digits = 1): string {
  if (v === null || v === undefined) return '—';
  return (v > 0 ? '+' : v < 0 ? '−' : '±') + nf(digits).format(Math.abs(v));
}

export function fmtDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return '—';
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${m % 60} min`;
}

export function fmtDistance(meters: number | null | undefined): string {
  if (meters === null || meters === undefined) return '—';
  return meters < 1000 ? `${Math.round(meters / 10) * 10} m` : `${fmt(meters / 1000, 1)} km`;
}

export const CATEGORY_LABEL: Record<School['category'], string> = {
  folkeskole: 'Folkeskole',
  friskole: 'Private / friskole',
  'international-public': 'International (public)',
  'international-private': 'International (private)',
};

export function typeLabel(s: School): string {
  if (s.isInternational) return s.isPrivate ? 'International · private' : 'International · public';
  return s.category === 'folkeskole' ? 'Folkeskole' : 'Private / friskole';
}

export const LANGUAGE_LABEL: Record<string, string> = {
  da: 'Danish', en: 'English', fr: 'French', de: 'German', es: 'Spanish', ar: 'Arabic', ur: 'Urdu', tr: 'Turkish', sv: 'Swedish', it: 'Italian', zh: 'Chinese',
};

export const LANGUAGE_CODE = (l: string) => l.toUpperCase();

export function shortName(name: string): string {
  return name.split(',')[0].trim();
}

export function relDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' });
}
