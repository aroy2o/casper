import { useState } from "react";
import { api } from "../app/api";
import { useAppSelector } from "../app/hooks";
import { formatDate } from "../utils/format";

// ─── Types ─────────────────────────────────────────────────────────────────────

type Severity = "low" | "medium" | "high" | "critical";
type IncidentStatus = "open" | "investigating" | "resolved" | "closed";
type IncidentType =
  | "unauthorized_access" | "data_breach" | "permission_escalation" | "suspicious_activity"
  | "data_export" | "brute_force" | "policy_violation" | "system_anomaly" | "other";

interface SecurityIncident {
  _id: string;
  title: string;
  description: string;
  incidentType: IncidentType;
  severity: Severity;
  status: IncidentStatus;
  reportedBy: string;
  assignedTo: string | null;
  affectedResource: string | null;
  sourceIp: string | null;
  resolvedAt: string | null;
  resolutionNotes: string | null;
  mitigationSteps: string[];
  createdAt: string;
}

interface AuditLog {
  _id: string;
  action: string;
  userId: string | null;
  userEmail: string | null;
  userRole: string | null;
  ip: string | null;
  resource: string | null;
  resourceId: string | null;
  outcome: "success" | "failure" | "warning";
  createdAt: string;
}

interface SOC2Report {
  generatedAt: string;
  period: string;
  incidents: {
    total: number;
    open: number;
    critical: number;
    resolvedLast30Days: number;
    bySeverity: Record<string, number>;
    byType: Record<string, number>;
  };
  activity: { loginFailures: number; dataExports: number; adminActions: number };
  openIncidents: SecurityIncident[];
  controls: Record<string, string>;
}

// ─── RTK Query injections ──────────────────────────────────────────────────────

const securityApi = api.injectEndpoints({
  endpoints: (builder) => ({
    listIncidents: builder.query<{ incidents: SecurityIncident[]; total: number; page: number; pages: number }, { page?: number; severity?: string; status?: string }>({
      query: ({ page = 1, severity, status }) => {
        const params = new URLSearchParams({ page: String(page), limit: "20" });
        if (severity) params.set("severity", severity);
        if (status) params.set("status", status);
        return `/api/security/incidents?${params}`;
      },
      providesTags: ["Audit"]
    }),
    createIncident: builder.mutation<SecurityIncident, Partial<SecurityIncident>>({
      query: (body) => ({ url: "/api/security/incidents", method: "POST", body }),
      invalidatesTags: ["Audit"]
    }),
    updateIncident: builder.mutation<SecurityIncident, { id: string; updates: Partial<SecurityIncident> }>({
      query: ({ id, updates }) => ({ url: `/api/security/incidents/${id}`, method: "PATCH", body: updates }),
      invalidatesTags: ["Audit"]
    }),
    getAuditLogs: builder.query<{ logs: AuditLog[]; total: number; page: number; pages: number }, { page?: number; action?: string; outcome?: string }>({
      query: ({ page = 1, action, outcome }) => {
        const params = new URLSearchParams({ page: String(page), limit: "50" });
        if (action) params.set("action", action);
        if (outcome) params.set("outcome", outcome);
        return `/api/security/audit-logs?${params}`;
      }
    }),
    getSOC2Report: builder.query<SOC2Report, void>({
      query: () => "/api/security/soc2-report"
    })
  })
});

const { useListIncidentsQuery, useCreateIncidentMutation, useUpdateIncidentMutation, useGetAuditLogsQuery, useGetSOC2ReportQuery } = securityApi;

// ─── Helpers ───────────────────────────────────────────────────────────────────

const SEVERITY_COLORS: Record<Severity, string> = {
  low: "bg-green-100 text-green-700",
  medium: "bg-amber-100 text-amber-700",
  high: "bg-orange-100 text-orange-700",
  critical: "bg-red-100 text-red-700"
};

const STATUS_COLORS: Record<IncidentStatus, string> = {
  open: "bg-red-100 text-red-700",
  investigating: "bg-amber-100 text-amber-700",
  resolved: "bg-green-100 text-green-700",
  closed: "bg-slate-100 text-slate-500"
};

const CONTROL_COLORS: Record<string, string> = {
  pass: "text-green-600",
  warning: "text-amber-600",
  fail: "text-red-600"
};

// ─── New Incident Form ─────────────────────────────────────────────────────────

const NewIncidentForm = ({ onClose }: { onClose: () => void }) => {
  const [form, setForm] = useState({ title: "", description: "", incidentType: "suspicious_activity" as IncidentType, severity: "medium" as Severity, affectedResource: "", sourceIp: "" });
  const [createIncident, { isLoading }] = useCreateIncidentMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.description) return;
    await createIncident({ ...form, affectedResource: form.affectedResource || undefined, sourceIp: form.sourceIp || undefined } as any);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-900 space-y-4">
        <h3 className="text-base font-semibold">Report Security Incident</h3>
        <div>
          <label className="mb-1 block text-xs text-slate-500">Title</label>
          <input required value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} className="w-full rounded border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950" placeholder="Brief incident title" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">Description</label>
          <textarea required rows={3} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className="w-full rounded border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950" placeholder="What happened?" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs text-slate-500">Type</label>
            <select value={form.incidentType} onChange={(e) => setForm((f) => ({ ...f, incidentType: e.target.value as IncidentType }))} className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950">
              {["unauthorized_access", "data_breach", "permission_escalation", "suspicious_activity", "data_export", "brute_force", "policy_violation", "system_anomaly", "other"].map((t) => (
                <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">Severity</label>
            <select value={form.severity} onChange={(e) => setForm((f) => ({ ...f, severity: e.target.value as Severity }))} className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950">
              {["low", "medium", "high", "critical"].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs text-slate-500">Affected resource (optional)</label>
            <input value={form.affectedResource} onChange={(e) => setForm((f) => ({ ...f, affectedResource: e.target.value }))} className="w-full rounded border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950" placeholder="e.g. /api/tenders" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">Source IP (optional)</label>
            <input value={form.sourceIp} onChange={(e) => setForm((f) => ({ ...f, sourceIp: e.target.value }))} className="w-full rounded border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950" placeholder="e.g. 1.2.3.4" />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="rounded border border-slate-300 px-4 py-1.5 text-sm dark:border-slate-700">Cancel</button>
          <button type="submit" disabled={isLoading} className="rounded bg-casper-blue px-4 py-1.5 text-sm text-white disabled:opacity-50">
            {isLoading ? "Submitting…" : "Submit"}
          </button>
        </div>
      </form>
    </div>
  );
};

// ─── Main Page ─────────────────────────────────────────────────────────────────

export const Security = (): JSX.Element => {
  const user = useAppSelector((state) => state.auth.user);
  const isAdmin = user?.role === "admin";
  const [tab, setTab] = useState<"dashboard" | "incidents" | "audit-logs">("dashboard");
  const [incidentPage, setIncidentPage] = useState(1);
  const [logPage, setLogPage] = useState(1);
  const [severityFilter, setSeverityFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [logActionFilter, setLogActionFilter] = useState("");
  const [logOutcomeFilter, setLogOutcomeFilter] = useState("");
  const [showNewForm, setShowNewForm] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);

  const { data: soc2, isLoading: soc2Loading } = useGetSOC2ReportQuery(undefined, { skip: !isAdmin || tab !== "dashboard" });
  const { data: incidents, isLoading: incidentsLoading } = useListIncidentsQuery({ page: incidentPage, ...(severityFilter && { severity: severityFilter }), ...(statusFilter && { status: statusFilter }) }, { skip: tab === "audit-logs" });
  const { data: logs, isLoading: logsLoading } = useGetAuditLogsQuery({ page: logPage, ...(logActionFilter && { action: logActionFilter }), ...(logOutcomeFilter && { outcome: logOutcomeFilter }) }, { skip: tab !== "audit-logs" });
  const [updateIncident] = useUpdateIncidentMutation();

  const handleStatusChange = async (id: string, status: IncidentStatus) => {
    setUpdating(id);
    await updateIncident({ id, updates: { status } }).catch(() => {});
    setUpdating(null);
  };

  return (
    <div className="space-y-4">
      {showNewForm && <NewIncidentForm onClose={() => setShowNewForm(false)} />}

      {/* Tab bar */}
      <div className="flex items-center justify-between">
        <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-800 dark:bg-slate-900">
          {(["dashboard", "incidents", "audit-logs"] as const).map((t) => (
            <button key={t} type="button" onClick={() => setTab(t)} className={`rounded-lg px-4 py-1.5 text-sm font-medium capitalize transition-colors ${tab === t ? "bg-white shadow dark:bg-slate-800" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"}`}>
              {t.replace("-", " ")}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => setShowNewForm(true)} className="rounded bg-casper-blue px-3 py-1.5 text-sm text-white hover:bg-blue-600">
          + Report Incident
        </button>
      </div>

      {/* ── Dashboard ── */}
      {tab === "dashboard" && (
        <>
          {!isAdmin ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700 dark:border-amber-800 dark:bg-amber-950/30">
              SOC 2 dashboard is restricted to admins. You can still view and report incidents above.
            </div>
          ) : soc2Loading ? (
            <div className="skeleton h-48" />
          ) : soc2 ? (
            <div className="space-y-4">
              {/* Control status */}
              <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900">
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">SOC 2 Controls</h3>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  {Object.entries(soc2.controls).map(([control, verdict]) => (
                    <div key={control} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                      <p className="text-xs text-slate-400 capitalize">{control.replace(/([A-Z])/g, " $1")}</p>
                      <p className={`mt-1 text-sm font-bold uppercase ${CONTROL_COLORS[verdict] ?? "text-slate-500"}`}>{verdict}</p>
                    </div>
                  ))}
                </div>
              </section>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
                  <p className="text-xs text-slate-500">Total incidents</p>
                  <p className="mt-1 text-2xl font-bold">{soc2.incidents.total}</p>
                </div>
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/30">
                  <p className="text-xs text-red-500">Open</p>
                  <p className="mt-1 text-2xl font-bold text-red-600">{soc2.incidents.open}</p>
                </div>
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
                  <p className="text-xs text-amber-600">Critical</p>
                  <p className="mt-1 text-2xl font-bold text-amber-600">{soc2.incidents.critical}</p>
                </div>
                <div className="rounded-2xl border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950/30">
                  <p className="text-xs text-green-600">Resolved (30d)</p>
                  <p className="mt-1 text-2xl font-bold text-green-600">{soc2.incidents.resolvedLast30Days}</p>
                </div>
              </div>

              {/* Activity */}
              <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900">
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">90-Day Activity</h3>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div><p className="text-xs text-slate-500">Login failures</p><p className="font-bold">{soc2.activity.loginFailures}</p></div>
                  <div><p className="text-xs text-slate-500">Data exports</p><p className="font-bold">{soc2.activity.dataExports}</p></div>
                  <div><p className="text-xs text-slate-500">Admin actions</p><p className="font-bold">{soc2.activity.adminActions}</p></div>
                </div>
              </section>

              {/* Open incidents */}
              {soc2.openIncidents.length > 0 && (
                <section className="rounded-2xl border border-red-200 bg-red-50 p-5 dark:border-red-900 dark:bg-red-950/20">
                  <h3 className="mb-3 text-sm font-semibold text-red-700 dark:text-red-400">Open / Investigating Incidents</h3>
                  <div className="space-y-2">
                    {soc2.openIncidents.map((inc) => (
                      <div key={inc._id} className="flex items-center justify-between rounded-lg border border-red-200 bg-white px-3 py-2 dark:border-red-800 dark:bg-slate-900">
                        <div>
                          <p className="text-sm font-medium">{inc.title}</p>
                          <p className="text-xs text-slate-400">{formatDate(inc.createdAt)} · {inc.incidentType.replace(/_/g, " ")}</p>
                        </div>
                        <span className={`ml-3 rounded-full px-2 py-0.5 text-xs font-medium ${SEVERITY_COLORS[inc.severity]}`}>{inc.severity}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <p className="text-xs text-slate-400">Report generated: {formatDate(soc2.generatedAt)} · Period: {soc2.period}</p>
            </div>
          ) : null}
        </>
      )}

      {/* ── Incidents ── */}
      {tab === "incidents" && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <select value={severityFilter} onChange={(e) => { setSeverityFilter(e.target.value); setIncidentPage(1); }} className="rounded border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-950">
              <option value="">All severity</option>
              {["low", "medium", "high", "critical"].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setIncidentPage(1); }} className="rounded border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-950">
              <option value="">All status</option>
              {["open", "investigating", "resolved", "closed"].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {incidentsLoading ? <div className="skeleton h-32" /> : (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900">
              {(incidents?.incidents.length ?? 0) === 0 ? (
                <p className="p-6 text-center text-sm text-slate-400">No incidents found.</p>
              ) : (
                <div className="divide-y divide-slate-200 dark:divide-slate-700">
                  {incidents?.incidents.map((inc) => (
                    <div key={inc._id} className="flex flex-col gap-2 p-4 md:flex-row md:items-start md:justify-between">
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{inc.title}</span>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${SEVERITY_COLORS[inc.severity]}`}>{inc.severity}</span>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[inc.status]}`}>{inc.status}</span>
                        </div>
                        <p className="mt-1 text-sm text-slate-500">{inc.description.slice(0, 120)}{inc.description.length > 120 ? "…" : ""}</p>
                        <p className="mt-1 text-xs text-slate-400">
                          {inc.incidentType.replace(/_/g, " ")} · Reported by {inc.reportedBy} · {formatDate(inc.createdAt)}
                          {inc.affectedResource && ` · ${inc.affectedResource}`}
                        </p>
                      </div>
                      {isAdmin && inc.status !== "closed" && (
                        <div className="flex gap-1 shrink-0">
                          {inc.status === "open" && (
                            <button type="button" disabled={updating === inc._id} onClick={() => void handleStatusChange(inc._id, "investigating")} className="rounded bg-amber-500 px-2 py-1 text-xs text-white hover:bg-amber-600 disabled:opacity-50">
                              Investigate
                            </button>
                          )}
                          {(inc.status === "open" || inc.status === "investigating") && (
                            <button type="button" disabled={updating === inc._id} onClick={() => void handleStatusChange(inc._id, "resolved")} className="rounded bg-green-600 px-2 py-1 text-xs text-white hover:bg-green-700 disabled:opacity-50">
                              Resolve
                            </button>
                          )}
                          <button type="button" disabled={updating === inc._id} onClick={() => void handleStatusChange(inc._id, "closed")} className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-100 dark:border-slate-700 disabled:opacity-50">
                            Close
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {(incidents?.pages ?? 0) > 1 && (
            <div className="flex justify-center gap-2">
              <button type="button" disabled={incidentPage === 1} onClick={() => setIncidentPage((p) => p - 1)} className="rounded border px-3 py-1 text-sm disabled:opacity-50">Prev</button>
              <span className="text-sm">Page {incidentPage} / {incidents?.pages}</span>
              <button type="button" disabled={incidentPage >= (incidents?.pages ?? 1)} onClick={() => setIncidentPage((p) => p + 1)} className="rounded border px-3 py-1 text-sm disabled:opacity-50">Next</button>
            </div>
          )}
        </div>
      )}

      {/* ── Audit Logs ── */}
      {tab === "audit-logs" && (
        <div className="space-y-3">
          {!isAdmin ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">Audit logs are restricted to admins.</div>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                <select value={logActionFilter} onChange={(e) => { setLogActionFilter(e.target.value); setLogPage(1); }} className="rounded border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-950">
                  <option value="">All actions</option>
                  {["login_success", "login_failed", "logout", "tender_upload", "tender_delete", "tender_export", "report_export", "admin_action", "security_incident_create"].map((a) => (
                    <option key={a} value={a}>{a.replace(/_/g, " ")}</option>
                  ))}
                </select>
                <select value={logOutcomeFilter} onChange={(e) => { setLogOutcomeFilter(e.target.value); setLogPage(1); }} className="rounded border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-950">
                  <option value="">All outcomes</option>
                  <option value="success">Success</option>
                  <option value="failure">Failure</option>
                  <option value="warning">Warning</option>
                </select>
              </div>

              {logsLoading ? <div className="skeleton h-32" /> : (
                <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-xs text-slate-500 dark:border-slate-700">
                        <th className="px-4 py-2">Time</th>
                        <th className="px-4 py-2">Action</th>
                        <th className="px-4 py-2">User</th>
                        <th className="px-4 py-2">IP</th>
                        <th className="px-4 py-2">Resource</th>
                        <th className="px-4 py-2">Outcome</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(logs?.logs ?? []).map((log) => (
                        <tr key={log._id} className="border-t border-slate-200 dark:border-slate-700">
                          <td className="px-4 py-2 text-xs text-slate-400">{formatDate(log.createdAt)}</td>
                          <td className="px-4 py-2 font-mono text-xs">{log.action}</td>
                          <td className="px-4 py-2 text-xs">{log.userEmail ?? log.userId ?? "—"}</td>
                          <td className="px-4 py-2 font-mono text-xs text-slate-400">{log.ip ?? "—"}</td>
                          <td className="px-4 py-2 text-xs">{log.resource ?? "—"}{log.resourceId ? ` (${log.resourceId.slice(-6)})` : ""}</td>
                          <td className="px-4 py-2">
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${log.outcome === "success" ? "bg-green-100 text-green-700" : log.outcome === "failure" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                              {log.outcome}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {(logs?.logs.length ?? 0) === 0 && <p className="p-6 text-center text-sm text-slate-400">No audit logs found.</p>}
                </div>
              )}

              {(logs?.pages ?? 0) > 1 && (
                <div className="flex justify-center gap-2">
                  <button type="button" disabled={logPage === 1} onClick={() => setLogPage((p) => p - 1)} className="rounded border px-3 py-1 text-sm disabled:opacity-50">Prev</button>
                  <span className="text-sm">Page {logPage} / {logs?.pages}</span>
                  <button type="button" disabled={logPage >= (logs?.pages ?? 1)} onClick={() => setLogPage((p) => p + 1)} className="rounded border px-3 py-1 text-sm disabled:opacity-50">Next</button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};
