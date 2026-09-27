"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { CalendarDate } from "@internationalized/date";
import { CalendarPanel, formatDate } from "./calendar";
import styles from "./date-field.module.css";

const FORMAT_ERROR = "Enter a date as DD/MM/YYYY.";
const DATE_PATTERN = /^(0[1-9]|[12]\d|3[01])\/(0[1-9]|1[0-2])\/(\d{4})$/;

function parseDisplayDate(value: string): CalendarDate | null {
  const match = DATE_PATTERN.exec(value);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  try {
    const date = new CalendarDate(year, month, day);
    if (date.day !== day || date.month !== month || date.year !== year) return null;
    return date;
  } catch {
    return null;
  }
}

export function DateField() {
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [value, setValue] = useState("32/13/2026");
  const [error, setError] = useState(FORMAT_ERROR);
  const [open, setOpen] = useState(false);
  const selected = parseDisplayDate(value);

  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus({ preventScroll: true });
    function onPointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node) || rootRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onDocumentKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      inputRef.current?.focus();
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onDocumentKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onDocumentKeyDown);
    };
  }, [open]);

  function openPicker() {
    setOpen(true);
  }

  function onChange(next: string) {
    setValue(next);
    setError(DATE_PATTERN.test(next) ? "" : FORMAT_ERROR);
  }

  function pick(date: CalendarDate) {
    setValue(formatDate(date));
    setError("");
    setOpen(false);
    inputRef.current?.focus();
  }

  function onKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }
    if (event.key === "ArrowDown" || event.key === "Enter") {
      event.preventDefault();
      openPicker();
    }
  }

  return (
    <div className="field" ref={rootRef}>
      <label className="field-label" htmlFor="date">
        Date
        <span className="text-[var(--color-fg)]" aria-hidden="true">
          {" "}
          *
        </span>
      </label>
      <div className="field-control">
        <input
          ref={inputRef}
          id="date"
          className="ui-input"
          placeholder="DD/MM/YYYY"
          value={value}
          autoComplete="off"
          inputMode="none"
          spellCheck={false}
          required
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "date-message" : undefined}
          aria-expanded={open}
          aria-controls={open ? panelId : undefined}
          aria-haspopup="dialog"
          onPointerDown={openPicker}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={onKeyDown}
        />
        {open ? (
          <div
            ref={panelRef}
            id={panelId}
            className={styles.panel}
            role="dialog"
            aria-label="Choose a date"
            tabIndex={-1}
          >
            <CalendarPanel
              start={selected}
              end={null}
              hover={null}
              onPick={pick}
              onHover={() => {}}
            />
          </div>
        ) : null}
      </div>
      {error ? (
        <p id="date-message" className="field-error text-[var(--color-danger)]">
          Enter a date as <bdi>DD/MM/YYYY</bdi>.
        </p>
      ) : null}
    </div>
  );
}
