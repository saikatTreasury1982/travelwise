import { rawQuery } from '@/app/lib/db/client';

export interface Currency {
  currency_code: string;
  currency_name: string;
  currency_symbol: string | null;
}

// Global reference table → rawQuery is correct (not tenant-scoped).
export async function listCurrencies(): Promise<Currency[]> {
  const rows = await rawQuery(
    `SELECT currency_code, currency_name, currency_symbol FROM currencies ORDER BY currency_code`,
  );
  return rows.map((c) => ({
    currency_code: String(c.currency_code),
    currency_name: String(c.currency_name),
    currency_symbol: c.currency_symbol == null ? null : String(c.currency_symbol),
  }));
}

export interface Country {
  country_code: string;
  country_name: string;
  currency_code: string;
}

export async function listCountries(): Promise<Country[]> {
  const rows = await rawQuery(
    `SELECT country_code, country_name, currency_code FROM countries ORDER BY country_name`,
  );
  return rows.map((c) => ({
    country_code: String(c.country_code),
    country_name: String(c.country_name),
    currency_code: String(c.currency_code),
  }));
}