export function formatINR(value: number | null | undefined, decimals = 2): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  const n = Number(value);
  const abs = Math.abs(n);
  // crore = 1e7? In India: 1 lakh = 1e5, 1 crore = 1e7
  if (abs >= 1e7) {
    return `₹${(n / 1e7).toFixed(decimals)} Cr`;
  }
  if (abs >= 1e5) {
    return `₹${(n / 1e5).toFixed(decimals)} Lakh`;
  }
  return `₹${n.toLocaleString(undefined, { maximumFractionDigits: decimals })}`;
}

export function formatINRShort(value: number | null | undefined, decimals = 2): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  const n = Number(value);
  const abs = Math.abs(n);
  if (abs >= 1e7) return `${(n / 1e7).toFixed(decimals)} Cr`;
  if (abs >= 1e5) return `${(n / 1e5).toFixed(decimals)} Lakh`;
  return n.toLocaleString(undefined, { maximumFractionDigits: decimals });
}
