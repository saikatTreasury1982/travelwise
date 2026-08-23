import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(
  amount: number,
  currencyCode: string = 'USD',
  decimalPlaces: number = 2
): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: decimalPlaces,
    maximumFractionDigits: decimalPlaces,
  }).format(amount);
}

export function formatDate(
  date: Date | string,
  format: 'YYYY-MM-DD' | 'DD-MM-YYYY' | 'MM-DD-YYYY' | 'DD Mmm YYYY' = 'YYYY-MM-DD'
): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  switch (format) {
    case 'DD-MM-YYYY':
      return `${day}-${month}-${year}`;
    case 'MM-DD-YYYY':
      return `${month}-${day}-${year}`;
    case 'DD Mmm YYYY':
      return `${day} ${monthNames[d.getMonth()]} ${year}`;
    case 'YYYY-MM-DD':
    default:
      return `${year}-${month}-${day}`;
  }
}

export function formatDateRange(
  startDate: string | null | undefined,
  endDate: string | null | undefined,
  format: 'YYYY-MM-DD' | 'DD-MM-YYYY' | 'MM-DD-YYYY' | 'DD Mmm YYYY' = 'YYYY-MM-DD'
): string {
  if (!startDate && !endDate) return '[Dates not set]';
  if (!startDate) return `Until ${formatDate(endDate!, format)}`;
  if (!endDate) return `From ${formatDate(startDate, format)}`;

  return `${formatDate(startDate, format)} - ${formatDate(endDate, format)}`;
}

export function formatTime(
  timeString: string | null | undefined,
  format: '12h' | '24h' = '24h'
): string {
  if (!timeString) return '';

  const [hours, minutes] = timeString.split(':').map(Number);

  if (format === '12h') {
    const period = hours >= 12 ? 'PM' : 'AM';
    const hour12 = hours % 12 || 12;
    return `${hour12}:${minutes.toString().padStart(2, '0')} ${period}`;
  }

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

export function formatNumber(
  value: number | null | undefined,
  decimalPlaces: number = 2
): string {
  if (value === null || value === undefined) return '';
  return value.toFixed(decimalPlaces);
}