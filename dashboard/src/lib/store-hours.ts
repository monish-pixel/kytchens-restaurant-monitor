/** IST = UTC+5:30 */
export const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

/** Returns a Date whose getUTC* methods reflect IST values. */
export function nowIST(): Date {
  return new Date(Date.now() + IST_OFFSET_MS);
}

/** Real UTC Date for midnight of the IST calendar day + dayOffset. */
export function istDayStart(istDate: Date, dayOffset = 0): Date {
  const y = istDate.getUTCFullYear();
  const m = istDate.getUTCMonth();
  const d = istDate.getUTCDate();
  return new Date(Date.UTC(y, m, d + dayOffset) - IST_OFFSET_MS);
}

/** Real UTC Date for the 1st of the IST month + monthOffset. */
export function istMonthStart(istDate: Date, monthOffset = 0): Date {
  const y = istDate.getUTCFullYear();
  const m = istDate.getUTCMonth();
  return new Date(Date.UTC(y, m + monthOffset, 1) - IST_OFFSET_MS);
}

/**
 * Returns true if utcDate falls within the store's scheduled hours.
 *
 * Pune schedules (IST):
 *   kharadi / baner / wakad : 11 am – midnight every day
 *   kalyani-nagar           : Mon–Thu 9 am – midnight, Fri–Sun 9 am – 3 am next day
 */
export function isWithinStoreHours(locationSlug: string, utcDate: Date): boolean {
  const ist = new Date(utcDate.getTime() + IST_OFFSET_MS);
  const hour = ist.getUTCHours();
  const jsDay = ist.getUTCDay(); // 0=Sun, 1=Mon … 6=Sat

  if (['kharadi', 'baner', 'wakad'].includes(locationSlug)) {
    return hour >= 11; // 11:00–23:59
  }

  if (locationSlug === 'kalyani-nagar') {
    if (hour < 3) {
      // 00:00–02:59: open only if yesterday was Fri(5)/Sat(6)/Sun(0) — extended-hours night
      const prevDay = (jsDay - 1 + 7) % 7;
      return [5, 6, 0].includes(prevDay);
    }
    if (hour < 9) return false; // 03:00–08:59 always closed
    return true;               // 09:00+ open every day
  }

  return true; // unknown location: always include
}
