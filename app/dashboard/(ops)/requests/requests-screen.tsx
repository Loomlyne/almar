"use client";

import { useEffect, useRef, useState } from "react";
import type { ListReply, Locale3, OpsError, SiteRequestSummary, WriteResult } from "../../../../components/ops/api-types";
import { errorText } from "../../../../components/ops/error-text";
import { ListTable, type Column } from "../../../../components/ops/list-table";
import { opsFetch, opsSend } from "../../../../components/ops/ops-client";
import { useDashboardLocale } from "../../../../components/ops/use-dashboard-locale";
import { cn } from "../../../../lib/cn";
import { OPS_KIT_COPY } from "../../../../lib/copy/ops-kit";
import { OPS_REQUESTS_COPY } from "../../../../lib/copy/ops-requests";
import { RequestDetail, Tag, receivedIn, shortSlot } from "./request-detail";

// Requests (plan 06-05, F-10; pictures/06-05 requests-*): every Plan, List, Package and Consultation in one list, newest first.
// The kind and the status filter are toggle buttons (aria-pressed), as signed; Not handled shows first. Reads and writes go through
// the kit client to /api/ops/requests and /api/ops/consult (owner only).

const PATH = "/api/ops/requests";
const CONSULT = "/api/ops/consult";
const KINDS = ["plan", "list", "package", "consultation"] as const;
type KindFilter = (typeof KINDS)[number] | "all";
type StatusFilter = "no" | "yes" | "all";
type HandledReply = WriteResult & { handled_at: string | null; handled_by: string | null };

const TOGGLE = "inline-flex min-h-control cursor-pointer items-center whitespace-nowrap rounded-none border bg-surface px-4 font-body text-label";

function Toggle({ on, onPress, children }: { on: boolean; onPress: () => void; children: string }) {
  return (
    <button type="button" aria-pressed={on} onClick={onPress} className={cn(TOGGLE, on ? "border-teal font-bold text-teal shadow-selected" : "border-line text-ink")}>
      {children}
    </button>
  );
}

function summaryOf(row: SiteRequestSummary, locale: Locale3): string {
  const p = row.payload;
  const parts = (keys: string[]) =>
    keys
      .map((key) => p[key])
      .filter((value) => value !== undefined && value !== null && value !== "")
      .join(" · ");
  if (row.kind === "consultation") return row.consultation ? OPS_REQUESTS_COPY[locale].slotLine.replace("{dubai}", shortSlot(row.consultation.slot_start, locale)) : "";
  if (row.kind === "plan") return parts(["destination", "guests"]);
  if (row.kind === "list") return parts(["property_type", "city"]);
  return parts(["tier_slug", "guests"]);
}

export function RequestsScreen() {
  const locale = useDashboardLocale();
  const copy = OPS_REQUESTS_COPY[locale];
  const kit = OPS_KIT_COPY[locale];
  const [kind, setKind] = useState<KindFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("no");
  const [rows, setRows] = useState<SiteRequestSummary[]>([]);
  const [listError, setListError] = useState<OpsError | null>(null);
  const [open, setOpen] = useState<SiteRequestSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<OpsError | null>(null);
  const [loaded, setLoaded] = useState(false);
  const reading = useRef(0);

  async function load(nextKind: KindFilter = kind, nextStatus: StatusFilter = status) {
    const mine = ++reading.current;
    const reply = await opsFetch<ListReply<SiteRequestSummary>>(PATH, { kind: nextKind, handled: nextStatus });
    if (mine !== reading.current) return;
    setLoaded(true);
    if (reply.ok) {
      setRows(reply.items);
      setListError(null);
    } else setListError(reply.error);
  }

  useEffect(() => {
    void load(kind, status);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, status]);

  async function setHandled(handled: boolean) {
    if (!open || busy) return;
    setBusy(true);
    setError(null);
    const reply = await opsSend<HandledReply>(PATH, { id: open.id, handled });
    if (reply.ok) {
      setOpen({ ...open, handled_at: reply.handled_at, handled_by: reply.handled_by });
      void load();
    } else setError(reply.error);
    setBusy(false);
  }

  async function cancel(bookingId: string): Promise<boolean> {
    if (!open?.consultation) return false;
    setBusy(true);
    setError(null);
    const reply = await opsSend<WriteResult>(CONSULT, { action: "cancel", booking_id: bookingId });
    setBusy(false);
    if (!reply.ok) {
      setError(reply.error);
      return false;
    }
    setOpen({ ...open, consultation: { ...open.consultation, status: "cancelled" } });
    void load();
    return true;
  }

  if (open) {
    return (
      <RequestDetail
        request={open}
        busy={busy}
        error={error}
        onBack={() => {
          setOpen(null);
          setError(null);
        }}
        onHandled={(handled) => void setHandled(handled)}
        onCancel={cancel}
      />
    );
  }

  const columns: Column<SiteRequestSummary>[] = [
    { key: "name", label: copy.cols.name, phone: "title", render: (row) => row.name },
    { key: "kind", label: copy.cols.kind, phone: "meta", render: (row) => <Tag on>{copy.kinds[row.kind]}</Tag> },
    { key: "received", label: copy.cols.received, phone: "meta", render: (row) => receivedIn(row.created_at, locale) },
    { key: "email", label: copy.cols.email, phone: "meta", render: (row) => <bdi dir="ltr">{row.email}</bdi> },
    { key: "summary", label: copy.cols.summary, phone: "meta", render: (row) => summaryOf(row, locale) },
    { key: "status", label: copy.statusL, phone: "meta", render: (row) => <Tag on={row.handled_at === null}>{row.handled_at === null ? copy.st.not : copy.st.yes}</Tag> },
  ];

  const rowLabel = "min-w-16 text-label text-muted";
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <h1 className="m-0 text-balance font-display text-heading font-normal text-teal">{copy.title}</h1>
      <section className="flex min-w-0 flex-col gap-4 border border-line bg-surface p-4 md:p-6">
        <div className="flex flex-col gap-3">
          <div role="group" aria-label={copy.kindL} className="flex flex-wrap items-center gap-2">
            <span className={rowLabel}>{copy.kindL}</span>
            <Toggle on={kind === "all"} onPress={() => setKind("all")}>
              {copy.kindAll}
            </Toggle>
            {KINDS.map((one) => (
              <Toggle key={one} on={kind === one} onPress={() => setKind(one)}>
                {copy.kinds[one]}
              </Toggle>
            ))}
          </div>
          <div role="group" aria-label={copy.statusL} className="flex flex-wrap items-center gap-2">
            <span className={rowLabel}>{copy.statusL}</span>
            <Toggle on={status === "no"} onPress={() => setStatus("no")}>
              {copy.st.not}
            </Toggle>
            <Toggle on={status === "yes"} onPress={() => setStatus("yes")}>
              {copy.st.yes}
            </Toggle>
            <Toggle on={status === "all"} onPress={() => setStatus("all")}>
              {copy.st.all}
            </Toggle>
          </div>
        </div>
        {listError ? (
          <p role="alert" className="m-0 text-label text-error">
            {errorText(kit, listError)}
          </p>
        ) : null}
        {loaded ? (
          <ListTable
            caption={copy.title}
            columns={columns}
            rows={rows}
            onOpen={(row) => {
              setError(null);
              setOpen(row);
            }}
            empty={<p className="m-0 text-body text-muted">{copy.empty}</p>}
          />
        ) : null}
      </section>
    </div>
  );
}
