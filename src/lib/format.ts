export function fmtDuration(sec: number): string {
  const m = Math.round(sec / 60);
  const h = Math.floor(m / 60);
  const mm = m % 60;
  if (h === 0) return `${mm} хв`;
  return mm === 0 ? `${h} год` : `${h} год ${mm} хв`;
}

export const fmtKm = (meters: number) => `${Math.round(meters / 1000)} км`;

export function fmtDate(dateISO: string): string {
  return new Date(`${dateISO}T12:00:00Z`).toLocaleDateString('uk-UA', {
    day: 'numeric', month: 'short', weekday: 'short', timeZone: 'UTC',
  });
}

/** Сьогоднішня дата за місцевим часом користувача, а не за UTC. */
export function todayISO(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Українська множина: plural(3, ['день', 'дні', 'днів']) дає «дні». */
export function plural(n: number, forms: [string, string, string]): string {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return forms[2];
  if (b === 1) return forms[0];
  if (b >= 2 && b <= 4) return forms[1];
  return forms[2];
}
