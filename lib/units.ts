export function toBaseUnits(amountDecimal: string, decimals: number): string {
  const [whole, fracRaw] = String(amountDecimal).split(".");
  const frac = (fracRaw ?? "").padEnd(decimals, "0").slice(0, decimals);
  const num = (whole || "0") + frac;
  const normalized = num.replace(/^0+/, "");
  return normalized.length ? normalized : "0";
}

export function fromBaseUnits(amount: string, decimals: number): string {
  const s = String(amount).replace(/^0+/, "") || "0";
  if (decimals === 0) return s;
  const pad = s.padStart(decimals + 1, "0");
  const i = pad.length - decimals;
  const whole = pad.slice(0, i);
  const frac = pad.slice(i).replace(/0+$/, "");
  return frac.length ? `${whole}.${frac}` : whole;
} 