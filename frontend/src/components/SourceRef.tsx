type SourceRefProps = {
  source?: string | null;
  sourceURL?: string | null;
  fetchedAt?: string | null;
  className?: string;
};

const prettifySource = (source?: string | null, sourceURL?: string | null): string => {
  if (source && source.trim().length > 0) {
    return source.replaceAll("_", " ");
  }
  if (sourceURL && sourceURL.length > 0) {
    try {
      const url = new URL(sourceURL);
      return url.hostname.replace("www.", "");
    } catch {
      return "external source";
    }
  }
  return "source unavailable";
};

const formatFetchedAt = (date?: string | null): string | null => {
  if (!date) return null;
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleString();
};

export const SourceRef = ({ source, sourceURL, fetchedAt, className }: SourceRefProps): JSX.Element => {
  const sourceLabel = prettifySource(source, sourceURL);
  const fetched = formatFetchedAt(fetchedAt);

  return (
    <div className={`inline-flex flex-wrap items-center gap-2 rounded-full bg-slate-100 px-2 py-1 text-[11px] text-slate-600 dark:bg-slate-800 dark:text-slate-300 ${className ?? ""}`}>
      <span>Fetched from {sourceLabel}</span>
      {sourceURL ? (
        <a href={sourceURL} target="_blank" rel="noreferrer" className="text-casper-blue hover:underline">
          reference
        </a>
      ) : null}
      {fetched ? <span>• {fetched}</span> : null}
    </div>
  );
};
