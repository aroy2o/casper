import { useEffect } from "react";
import { Link } from "react-router-dom";
import { connectAlerts, disconnectAlerts, markAllRead } from "../features/alerts/alertsSlice";
import { useAppDispatch, useAppSelector } from "../app/hooks";
import { formatDate } from "../utils/format";

const borderClass: Record<string, string> = {
  new_tender_flagged: "border-casper-red",
  price_spike: "border-casper-amber",
  audit_complete: "border-casper-green",
  scrape_error: "border-casper-red"
};

export const AlertFeed = (): JSX.Element => {
  const dispatch = useAppDispatch();
  const token = useAppSelector((state) => state.auth.accessToken);
  const items = useAppSelector((state) => state.alerts.items);

  useEffect(() => {
    if (!token) return;
    dispatch(connectAlerts(token));
    return () => {
      dispatch(disconnectAlerts());
    };
  }, [dispatch, token]);

  return (
    <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Live Alerts</h3>
        <button
          type="button"
          onClick={() => dispatch(markAllRead())}
          className="rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          Mark all read
        </button>
      </div>
      <div className="max-h-[280px] space-y-2 overflow-y-auto pr-1">
        {items.length === 0 ? (
          <p className="text-sm text-slate-500">No alerts yet</p>
        ) : (
          items.slice(0, 20).map((alert) => (
            <article
              key={alert._id}
              className={`rounded-lg border-l-4 bg-white p-3 dark:bg-slate-950 ${borderClass[alert.type] ?? "border-slate-400"}`}
            >
              <p className="text-xs text-slate-500">{formatDate(alert.createdAt)}</p>
              <p className="text-sm text-slate-800 dark:text-slate-200">{alert.message}</p>
              {alert.tenderId ? (
                <Link className="text-xs text-casper-blue hover:underline" to={`/tenders/${alert.tenderId}`}>
                  Open tender
                </Link>
              ) : null}
            </article>
          ))
        )}
      </div>
    </section>
  );
};
