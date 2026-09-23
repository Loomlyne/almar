"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { CloseIcon, ShieldIcon, SpinnerIcon } from "../icons/icons";

type Tone = "status" | "alert" | "success" | "warning";

type ToastItem = {
  id: number;
  tone: Tone;
  text: string;
};

type ToastContextValue = {
  push: (text: string, tone?: Tone) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const value = useContext(ToastContext);
  if (!value) throw new Error("ToastProvider is missing");
  return value;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const [live, setLive] = useState("");
  const nextId = useRef(1);

  function push(text: string, tone: Tone = "status") {
    const id = nextId.current;
    nextId.current += 1;
    setItems((current) => [...current, { id, tone, text }].slice(-3));
    setLive("");
    window.setTimeout(() => setLive(text), 0);
  }

  function dismiss(id: number) {
    setItems((current) => current.filter((item) => item.id !== id));
  }

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="toast-stack">
        <div role="status" className="toast-live">
          {live}
        </div>
        {items.map((item) => (
          <ToastCard key={item.id} item={item} onDismiss={() => dismiss(item.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastCard({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  const [paused, setPaused] = useState(false);
  const remaining = useRef(4000);
  const started = useRef(0);

  useEffect(() => {
    if (paused) return undefined;
    started.current = Date.now();
    const timer = window.setTimeout(onDismiss, remaining.current);
    return () => {
      remaining.current = Math.max(0, remaining.current - (Date.now() - started.current));
      window.clearTimeout(timer);
    };
  }, [paused, onDismiss]);

  const role = item.tone === "alert" ? "alert" : "status";
  return (
    <div
      className={`toast toast-${item.tone}`}
      role={role}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <ToastMark tone={item.tone} />
      <p>{item.text}</p>
      <button type="button" className="icon-button" aria-label="Dismiss" onClick={onDismiss}>
        <CloseIcon size={16} />
      </button>
    </div>
  );
}

function ToastMark({ tone }: { tone: Tone }) {
  if (tone === "success") return <ShieldIcon size={16} className="toast-success" />;
  if (tone === "warning") return <ShieldIcon size={16} className="toast-warning" />;
  if (tone === "alert") return <ShieldIcon size={16} />;
  return <SpinnerIcon size={16} />;
}

export function ShowToast() {
  const { push } = useToast();
  return (
    <button type="button" className="ui-button ui-button-inline" onClick={() => push("Saved.")}>
      Show toast
    </button>
  );
}
