// All business-day math here uses UTC exclusively — this matches the
// attendance register's own date-range logic (see the attendance page),
// and is what makes the freeze deadline reproducible regardless of what
// timezone a server or a developer's machine happens to be running in.
// Never touch local-timezone Date getters/setters in this file.

export function isWeekend(dateStr) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  const day = d.getUTCDay(); // 0 = Sunday, 6 = Saturday
  return day === 0 || day === 6;
}

// Returns the date, as a "YYYY-MM-DD" string, that is `n` business days
// (Mon–Fri) after the given date. Weekends are skipped entirely — they
// never count toward `n`.
export function addBusinessDays(dateStr, n) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  let added = 0;
  while (added < n) {
    d.setUTCDate(d.getUTCDate() + 1);
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) added += 1;
  }
  return d.toISOString().slice(0, 10);
}

// Formats an array of millisecond durations as a human-readable average
// ("2.3h" or "1.5d") — shared between the weekly digest email and the
// vendor performance scorecard.
export function averageDuration(msValues) {
  if (msValues.length === 0) return "—";
  const avgMs = msValues.reduce((a, b) => a + b, 0) / msValues.length;
  const hours = avgMs / 3_600_000;
  return hours < 24 ? `${hours.toFixed(1)}h` : `${(hours / 24).toFixed(1)}d`;
}

export function todayUTC() {
  return new Date().toISOString().slice(0, 10);
}

// Inclusive day count between two "YYYY-MM-DD" dates. Same UTC-only
// discipline as the rest of this file.
export function totalDaysInclusive(from, to) {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  const start = Date.UTC(fy, fm - 1, fd);
  const end = Date.UTC(ty, tm - 1, td);
  return Math.round((end - start) / 86400000) + 1;
}
