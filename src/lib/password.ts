export interface PasswordChecks { length: boolean; upper: boolean; digit: boolean; special: boolean }

export function passwordChecks(pw: string): PasswordChecks {
  return {
    length: pw.length >= 8,
    upper: /[A-Z]/.test(pw),
    digit: /[0-9]/.test(pw),
    special: /[^A-Za-z0-9]/.test(pw),
  };
}

/** 0–5 score used to drive the strength bar. */
export function passwordScore(pw: string): number {
  if (!pw) return 0;
  const c = passwordChecks(pw);
  return [c.length, c.upper, c.digit, c.special, pw.length >= 12].filter(Boolean).length;
}

/** 0 = faible (rouge), 1 = moyen (orange), 2 = fort (vert). */
export function strengthLevel(score: number): 0 | 1 | 2 {
  return score <= 2 ? 0 : score <= 3 ? 1 : 2;
}
