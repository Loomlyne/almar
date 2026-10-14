"use client";

// Plan 03.2-15: the Access card of the stay editor (kit EditPage, option B). DRAFT for the picture gate.
// Private per stay (C-14, OPS-10): address, Wi-Fi name and password, door code, notes. Saved on its own route
// (/api/ops/stay-access), never through the page's Save/Publish, never in a URL, never logged; nothing here is on the
// public site. The password and the door code are hidden until the eye is pressed (standing rule). The values are
// literal: not translated (Notes is an open owner question).

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { errorText } from "../../../../../components/ops/error-text";
import { opsFetch, opsSend } from "../../../../../components/ops/ops-client";
import type { Locale3, StayAccessView } from "../../../../../components/ops/api-types";
import { Button } from "../../../../../components/ui/button";
import { Field } from "../../../../../components/ui/field";
import { OPS_KIT_COPY } from "../../../../../lib/copy/ops-kit";
import { OPS_STAY_TABS_COPY } from "../../../../../lib/copy/ops-stay-tabs";
import { accessPayload, type AccessInput } from "./rates-forms";

const PATH = "/api/ops/stay-access";
const BLANK: AccessInput = { address: "", wifi_name: "", wifi_password: "", door_code: "", notes: "" };

function fromView(view: StayAccessView): AccessInput {
  const access = view.access;
  if (!access) return BLANK;
  return {
    address: access.address ?? "",
    wifi_name: access.wifi_name ?? "",
    wifi_password: access.wifi_password ?? "",
    door_code: access.door_code ?? "",
    notes: access.notes ?? "",
  };
}

const same = (a: AccessInput, b: AccessInput) => (Object.keys(a) as Array<keyof AccessInput>).every((key) => a[key] === b[key]);

export function StayAccessSection({
  stayId,
  locale,
  onDirtyChange,
}: {
  stayId: string;
  locale: Locale3;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const copy = OPS_STAY_TABS_COPY[locale];
  const kit = OPS_KIT_COPY[locale];
  const id = useId();
  const [saved, setSaved] = useState<AccessInput | null>(null);
  const [typed, setTyped] = useState<AccessInput>(BLANK);
  const [loadError, setLoadError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tooLong, setTooLong] = useState<keyof AccessInput | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const load = useCallback(async () => {
    setLoadError(false);
    const reply = await opsFetch<StayAccessView>(PATH, { stay_id: stayId });
    if (!reply.ok) {
      setLoadError(true);
      return;
    }
    const values = fromView(reply);
    setSaved(values);
    setTyped(values);
  }, [stayId]);

  useEffect(() => {
    void load();
  }, [load]);

  const dirty = saved !== null && !same(saved, typed);
  // Told only when it changes; the latest callback is kept in a ref so an inline one cannot loop.
  const tell = useRef(onDirtyChange);
  tell.current = onDirtyChange;
  useEffect(() => {
    tell.current?.(dirty);
  }, [dirty]);
  useEffect(() => () => tell.current?.(false), []);

  async function save() {
    const payload = accessPayload(typed);
    if (!payload.ok) {
      setTooLong(payload.field);
      return;
    }
    setTooLong(null);
    setFailed(null);
    setBusy(true);
    const reply = await opsSend<StayAccessView>(PATH, { action: "save", stay_id: stayId, access: payload.value });
    setBusy(false);
    if (!reply.ok) {
      setFailed(errorText(kit, reply.error));
      return;
    }
    const values = fromView(reply);
    setSaved(values);
    setTyped(values);
    setDone(true);
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p role="alert" className="m-0 text-label text-error">
          {copy.loadFailed}
        </p>
        <Button variant="secondary" onClick={() => void load()}>
          {copy.retry}
        </Button>
      </div>
    );
  }
  if (saved === null) {
    return (
      <p className="m-0 text-label text-muted" aria-live="polite">
        {copy.loading}
      </p>
    );
  }

  const field = (key: keyof AccessInput) => ({
    id: `${id}-${key}`,
    value: typed[key],
    autoComplete: "off",
    className: "max-w-none",
    error: tooLong === key ? copy.access.tooLong : undefined,
    onChange: (event: { target: { value: string } }) => {
      setTyped((was) => ({ ...was, [key]: event.target.value }));
      setDone(false);
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <p className="m-0 text-label text-ink">{copy.access.guestLine}</p>
      <p className="m-0 text-label text-muted">{copy.access.privateLine}</p>
      <Field {...field("address")} label={copy.access.address} multiline />
      <Field {...field("wifi_name")} label={copy.access.wifiName} dir="auto" />
      <Field {...field("wifi_password")} label={copy.access.wifiPassword} type="password" dir="ltr" autoComplete="new-password" />
      <Field {...field("door_code")} label={copy.access.doorCode} type="password" dir="ltr" autoComplete="new-password" />
      <Field {...field("notes")} label={copy.access.notes} hint={copy.access.notesHint} multiline />
      {failed ? (
        <p role="alert" className="m-0 text-label text-error">
          {failed}
        </p>
      ) : null}
      <div className="flex items-center gap-3">
        {/* The card's only action: filled (card buttons are outlined unless they are the only one; never gold). */}
        <Button variant="primary" onClick={() => void save()} disabled={busy || !dirty}>
          {copy.access.saveAccess}
        </Button>
        {done && !dirty ? (
          <span role="status" className="text-label text-muted">
            {copy.access.saved}
          </span>
        ) : null}
      </div>
    </div>
  );
}
