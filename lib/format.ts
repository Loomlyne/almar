const LATN = "ar-AE-u-nu-latn";

function grouped(amount: number, locale = "en-US"): string {
  const whole = Number.isInteger(amount);
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  }).format(amount);
}

export function formatAmount(currency: string, amount: number): string {
  return `${currency} ${grouped(amount)}`;
}

export function formatAmountLatn(currency: string, amount: number): string {
  return `${currency} ${grouped(amount, LATN)}`;
}

export function formatDate(day: number, month: number, year: number): string {
  const dd = String(day).padStart(2, "0");
  const mm = String(month).padStart(2, "0");
  return `${dd}/${mm}/${year}`;
}

export function formatRange(start: string, end: string): string {
  return `${start} – ${end}`;
}
