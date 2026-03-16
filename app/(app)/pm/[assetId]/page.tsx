"use client";

import Link from "next/link";
import { ClipboardCheck, PauseCircle, PlayCircle, Wrench } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { AppShell, ContextBar } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { formatPmFrequency } from "@/lib/pm";
import type { PmAssetDetail, PmChecklistResult, PmLogRecord } from "@/lib/types";
import { formatEquipmentTypeLabel } from "@/lib/utils";

const today = new Date().toISOString().slice(0, 10);

export default function PmAssetDetailPage({
  params
}: {
  params: { assetId: string };
}) {
  const [detail, setDetail] = useState<PmAssetDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [programForm, setProgramForm] = useState({
    title: "Quarterly PM",
    frequencyMonths: "3",
    startDate: today,
    instructions: "",
    checklistText: ""
  });
  const [logForm, setLogForm] = useState({
    dueAt: today,
    completedAt: today,
    status: "completed" as "completed" | "skipped",
    performedBy: "",
    summary: "",
    workNotes: "",
    findings: "",
    followUpRequired: false
  });
  const [checklistNotes, setChecklistNotes] = useState<Record<string, { done: boolean; note: string }>>({});
  const [savingProgram, setSavingProgram] = useState(false);
  const [savingLog, setSavingLog] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch(`/api/pm/assets/${encodeURIComponent(params.assetId)}`, {
          cache: "no-store"
        });
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error ?? "Unable to load PM detail");
        }

        setDetail(payload);
        if (payload.program) {
          setProgramForm({
            title: payload.program.title,
            frequencyMonths: String(payload.program.frequency_months),
            startDate: payload.program.start_date,
            instructions: payload.program.instructions || "",
            checklistText: (payload.program.checklist_template ?? []).join("\n")
          });
          setLogForm((current) => ({
            ...current,
            dueAt: payload.program.next_due_at,
            completedAt: today
          }));
          setChecklistNotes(
            Object.fromEntries(
              (payload.program.checklist_template ?? []).map((label: string) => [label, { done: false, note: "" }])
            )
          );
        }
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Unable to load PM detail");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [params.assetId]);

  const checklistTemplate = useMemo(
    () =>
      programForm.checklistText
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean),
    [programForm.checklistText]
  );

  async function reloadDetail() {
    const response = await fetch(`/api/pm/assets/${encodeURIComponent(params.assetId)}`, { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error ?? "Unable to load PM detail");
    }
    setDetail(payload);
    return payload as PmAssetDetail;
  }

  async function saveProgram() {
    setSavingProgram(true);
    setError("");
    try {
      const payload = {
        title: programForm.title,
        frequencyMonths: Number(programForm.frequencyMonths),
        startDate: programForm.startDate,
        instructions: programForm.instructions,
        checklistTemplate
      };
      const response = await fetch(
        detail?.program ? `/api/pm/programs/${encodeURIComponent(detail.program.id)}` : "/api/pm/programs",
        {
          method: detail?.program ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            detail?.program
              ? payload
              : {
                  ...payload,
                  assetId: params.assetId
                }
          )
        }
      );
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error ?? "Unable to save PM program");
      }

      const refreshed = await reloadDetail();
      setLogForm((current) => ({
        ...current,
        dueAt: refreshed.program?.next_due_at ?? current.dueAt
      }));
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save PM program");
    } finally {
      setSavingProgram(false);
    }
  }

  async function toggleProgramActive(isActive: boolean) {
    if (!detail?.program) {
      return;
    }

    setSavingProgram(true);
    setError("");
    try {
      const response = await fetch(`/api/pm/programs/${encodeURIComponent(detail.program.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive })
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error ?? "Unable to update PM program");
      }

      setDetail((current) => (current ? { ...current, program: body.program } : current));
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to update PM program");
    } finally {
      setSavingProgram(false);
    }
  }

  async function saveLog() {
    if (!detail?.program) {
      return;
    }

    setSavingLog(true);
    setError("");
    try {
      const checklistResults: PmChecklistResult[] = detail.program.checklist_template.map((label) => ({
        label,
        done: checklistNotes[label]?.done ?? false,
        note: checklistNotes[label]?.note ?? ""
      }));

      const response = await fetch("/api/pm/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          programId: detail.program.id,
          assetId: detail.asset.id,
          dueAt: logForm.dueAt,
          completedAt: logForm.status === "completed" ? logForm.completedAt : undefined,
          status: logForm.status,
          performedBy: logForm.performedBy,
          summary: logForm.summary,
          workNotes: logForm.workNotes,
          findings: logForm.findings,
          followUpRequired: logForm.followUpRequired,
          checklistResults
        })
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error ?? "Unable to save PM log");
      }

      const newLog = body.log as PmLogRecord;
      setDetail((current) =>
        current && current.program
          ? {
              ...current,
              program: {
                ...current.program,
                next_due_at: body.nextDueAt,
                last_completed_at:
                  logForm.status === "completed" ? logForm.completedAt : current.program.last_completed_at
              },
              logs: [newLog, ...current.logs]
            }
          : current
      );
      setLogForm({
        dueAt: body.nextDueAt,
        completedAt: today,
        status: "completed",
        performedBy: "",
        summary: "",
        workNotes: "",
        findings: "",
        followUpRequired: false
      });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save PM log");
    } finally {
      setSavingLog(false);
    }
  }

  return (
    <AppShell
      title="PM Detail"
      description="Enroll assets in recurring maintenance, log completed work, and review PM history."
      contextBar={
        detail ? (
          <ContextBar
            items={[
              { label: "More", href: "/more" },
              { label: "PM Tracker", href: "/pm" },
              {
                label:
                  detail.asset.equipment_tag || formatEquipmentTypeLabel(detail.asset.equipment_type)
              }
            ]}
          />
        ) : undefined
      }
    >
      {loading ? (
        <section className="panel p-5 md:p-6">
          <EmptyState title="Loading PM detail" body="Pulling program setup, due state, and maintenance history." />
        </section>
      ) : detail ? (
        <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <section className="panel p-5 md:p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-moss">Asset</p>
                <h2 className="mt-2 text-2xl font-semibold text-ink">
                  {detail.asset.equipment_tag ||
                    detail.asset.temporary_identifier ||
                    formatEquipmentTypeLabel(detail.asset.equipment_type)}
                </h2>
                <p className="mt-2 text-sm text-slate">
                  {(detail.customer?.name ? `${detail.customer.name} | ` : "") + detail.site.name}
                </p>
              </div>
              <Link href={`/assets/${encodeURIComponent(detail.asset.id)}`} className="button-secondary">
                Open asset
              </Link>
            </div>

            <div className="mt-5 grid gap-3">
              <DetailRow
                label="Cadence"
                value={detail.program ? formatPmFrequency(detail.program.frequency_months) : "Not enrolled"}
              />
              <DetailRow label="Next due" value={detail.program?.next_due_at || "Not scheduled"} />
              <DetailRow label="Last completed" value={detail.program?.last_completed_at || "No PM logged"} />
              <DetailRow
                label="Status"
                value={detail.program ? (detail.program.is_active ? "Active" : "Paused") : "Not enrolled"}
              />
            </div>

            <div className="mt-6 rounded-3xl bg-mist p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-moss">Program setup</div>
                  <div className="mt-1 text-sm text-slate">Define the recurring PM cadence and checklist for this asset.</div>
                </div>
                <Wrench className="h-5 w-5 text-slate" />
              </div>

              <div className="mt-4 space-y-4">
                <Field label="Title">
                  <input
                    className="field"
                    value={programForm.title}
                    onChange={(event) => setProgramForm((current) => ({ ...current, title: event.target.value }))}
                  />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Cadence">
                    <select
                      className="field"
                      value={programForm.frequencyMonths}
                      onChange={(event) =>
                        setProgramForm((current) => ({ ...current, frequencyMonths: event.target.value }))
                      }
                    >
                      <option value="1">Monthly</option>
                      <option value="3">Quarterly</option>
                      <option value="6">Semiannual</option>
                      <option value="12">Annual</option>
                    </select>
                  </Field>
                  <Field label="Start date">
                    <input
                      className="field"
                      type="date"
                      value={programForm.startDate}
                      onChange={(event) => setProgramForm((current) => ({ ...current, startDate: event.target.value }))}
                    />
                  </Field>
                </div>
                <Field label="Instructions">
                  <textarea
                    className="field min-h-24"
                    value={programForm.instructions}
                    onChange={(event) =>
                      setProgramForm((current) => ({ ...current, instructions: event.target.value }))
                    }
                  />
                </Field>
                <Field label="Checklist template">
                  <textarea
                    className="field min-h-28"
                    value={programForm.checklistText}
                    onChange={(event) =>
                      setProgramForm((current) => ({ ...current, checklistText: event.target.value }))
                    }
                    placeholder="One checklist item per line"
                  />
                </Field>
                <div className="flex flex-wrap gap-3">
                  <button className="button-primary" type="button" onClick={() => void saveProgram()} disabled={savingProgram}>
                    {savingProgram ? "Saving..." : detail.program ? "Edit cadence" : "Enroll asset"}
                  </button>
                  {detail.program ? (
                    <button
                      className="button-secondary"
                      type="button"
                      onClick={() => void toggleProgramActive(!detail.program?.is_active)}
                      disabled={savingProgram}
                    >
                      {detail.program.is_active ? "Pause tracking" : "Resume tracking"}
                    </button>
                  ) : null}
                </div>
              </div>
            </div>

            {error ? <p className="mt-4 rounded-2xl bg-mist px-4 py-3 text-sm text-slate">{error}</p> : null}
          </section>

          <section className="panel p-5 md:p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-moss">Open due item</p>
                <h2 className="mt-2 text-2xl font-semibold text-ink">Log PM work</h2>
              </div>
              <ClipboardCheck className="h-5 w-5 text-slate" />
            </div>

            {detail.program ? (
              <div className="mt-5 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Due date">
                    <input
                      className="field"
                      type="date"
                      value={logForm.dueAt}
                      onChange={(event) => setLogForm((current) => ({ ...current, dueAt: event.target.value }))}
                    />
                  </Field>
                  <Field label="Completed on">
                    <input
                      className="field"
                      type="date"
                      value={logForm.completedAt}
                      onChange={(event) =>
                        setLogForm((current) => ({ ...current, completedAt: event.target.value }))
                      }
                      disabled={logForm.status === "skipped"}
                    />
                  </Field>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Status">
                    <select
                      className="field"
                      value={logForm.status}
                      onChange={(event) =>
                        setLogForm((current) => ({
                          ...current,
                          status: event.target.value as "completed" | "skipped"
                        }))
                      }
                    >
                      <option value="completed">Completed</option>
                      <option value="skipped">Skipped</option>
                    </select>
                  </Field>
                  <Field label="Performed by">
                    <input
                      className="field"
                      value={logForm.performedBy}
                      onChange={(event) =>
                        setLogForm((current) => ({ ...current, performedBy: event.target.value }))
                      }
                    />
                  </Field>
                </div>
                <Field label="Summary">
                  <input
                    className="field"
                    value={logForm.summary}
                    onChange={(event) => setLogForm((current) => ({ ...current, summary: event.target.value }))}
                    placeholder="Quarterly inspection and lubrication"
                  />
                </Field>
                <Field label="Work notes">
                  <textarea
                    className="field min-h-24"
                    value={logForm.workNotes}
                    onChange={(event) =>
                      setLogForm((current) => ({ ...current, workNotes: event.target.value }))
                    }
                  />
                </Field>
                <Field label="Findings">
                  <textarea
                    className="field min-h-24"
                    value={logForm.findings}
                    onChange={(event) =>
                      setLogForm((current) => ({ ...current, findings: event.target.value }))
                    }
                  />
                </Field>
                {detail.program.checklist_template.length ? (
                  <div className="rounded-3xl bg-mist p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-moss">Checklist</div>
                    <div className="mt-3 space-y-3">
                      {detail.program.checklist_template.map((label) => (
                        <div key={label} className="rounded-2xl bg-white px-4 py-3">
                          <label className="flex items-center gap-3 text-sm font-medium text-ink">
                            <input
                              type="checkbox"
                              checked={checklistNotes[label]?.done ?? false}
                              onChange={(event) =>
                                setChecklistNotes((current) => ({
                                  ...current,
                                  [label]: { done: event.target.checked, note: current[label]?.note ?? "" }
                                }))
                              }
                            />
                            {label}
                          </label>
                          <textarea
                            className="field mt-3 min-h-20"
                            value={checklistNotes[label]?.note ?? ""}
                            onChange={(event) =>
                              setChecklistNotes((current) => ({
                                ...current,
                                [label]: { done: current[label]?.done ?? false, note: event.target.value }
                              }))
                            }
                            placeholder="Optional note"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
                <label className="flex items-center gap-3 text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={logForm.followUpRequired}
                    onChange={(event) =>
                      setLogForm((current) => ({ ...current, followUpRequired: event.target.checked }))
                    }
                  />
                  Follow-up required
                </label>
                <button className="button-primary w-full" type="button" onClick={() => void saveLog()} disabled={savingLog}>
                  {savingLog ? "Saving log..." : "Log PM"}
                </button>
              </div>
            ) : (
              <div className="mt-5">
                <EmptyState title="Asset not enrolled" body="Set up a PM program first, then due work can be logged here." />
              </div>
            )}

            <div className="mt-8">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-moss">Maintenance history</div>
              {detail.logs.length ? (
                <div className="mt-4 grid gap-3">
                  {detail.logs.map((log) => (
                    <div key={log.id} className="rounded-3xl border border-ink/10 bg-white px-4 py-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="font-semibold text-ink">{log.summary || "PM logged"}</div>
                          <div className="mt-1 text-sm text-slate">
                            Due {log.due_at}
                            {log.completed_at ? ` | Completed ${log.completed_at}` : ""}
                            {log.performed_by ? ` | ${log.performed_by}` : ""}
                          </div>
                        </div>
                        <span className="rounded-full bg-mist px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate">
                          {log.status}
                        </span>
                      </div>
                      {log.work_notes ? <p className="mt-3 text-sm text-slate">{log.work_notes}</p> : null}
                      {log.findings ? <p className="mt-2 text-sm text-slate">Findings: {log.findings}</p> : null}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-4">
                  <EmptyState title="No PM history yet" body="Completed or skipped PMs will build a timeline here." />
                </div>
              )}
            </div>
          </section>
        </div>
      ) : (
        <section className="panel p-5 md:p-6">
          <EmptyState title="PM asset not found" body="The asset could not be loaded for PM tracking." />
        </section>
      )}
    </AppShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-mist px-4 py-3">
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate">{label}</div>
      <div className="mt-1 text-sm text-ink">{value}</div>
    </div>
  );
}
