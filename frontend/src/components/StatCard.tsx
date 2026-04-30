interface StatCardProps {
  label: string;
  value: string;
  subtext?: string;
  trend?: number;
}

export const StatCard = ({ label, value, subtext, trend }: StatCardProps): JSX.Element => {
  const trendClass = trend === undefined ? "" : trend >= 0 ? "text-casper-green" : "text-casper-red";

  return (
    <article className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">{value}</p>
      {subtext ? <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{subtext}</p> : null}
      {trend !== undefined ? (
        <p className={`mt-3 text-xs font-semibold ${trendClass}`}>{trend >= 0 ? `+${trend.toFixed(1)}%` : `${trend.toFixed(1)}%`}</p>
      ) : null}
    </article>
  );
};
