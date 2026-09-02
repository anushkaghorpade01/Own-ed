/** Parse amounts like 200000, 2 lakh, 2.5L, 80%, ₹4,500 */
export function parseIndianAmount(raw: string): number | null {
  const s = raw.trim().toLowerCase().replace(/[₹,\s]/g, "");
  if (!s) return null;

  const pct = s.match(/^(\d+(?:\.\d+)?)\s*%$/);
  if (pct) return parseFloat(pct[1]!);

  const lakh = s.match(/^(\d+(?:\.\d+)?)\s*(?:lakh|lakhs|l|lac|lacs)$/);
  if (lakh) return Math.round(parseFloat(lakh[1]!) * 100_000);

  const k = s.match(/^(\d+(?:\.\d+)?)\s*k$/);
  if (k) return Math.round(parseFloat(k[1]!) * 1_000);

  const plain = s.match(/^(\d+(?:\.\d+)?)$/);
  if (plain) return parseFloat(plain[1]!);

  return null;
}
