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

/** `dismissLabel` names each toast's close button (default "Dismiss": the dashboard's callers pass none). */
export function ToastProvider({ children, dismissLabel = "Dismiss" }: { children: ReactNode; dismissLabel?: string }) {
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
      <div className="pointer-events-none fixed inset-x-0 bottom-16 z-50 flex flex-col items-center gap-2">
        <div role="status" className="sr-only">
          {live}
        </div>
        {items.map((item) => (
          <ToastCard key={item.id} item={item} dismissLabel={dismissLabel} onDismiss={() => dismiss(item.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastCard({ item, dismissLabel, onDismiss }: { item: ToastItem; dismissLabel: string; onDismiss: () => void }) {
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
      className="pointer-events-auto flex items-center gap-2 rounded-none bg-surface px-4 py-2 text-ink shadow-lg"
      role={role}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <ToastMark tone={item.tone} />
      <p className="m-0">{item.text}</p>
      <button type="button" className="inline-flex size-control shrink-0 cursor-pointer items-center justify-center border-0 bg-transparent text-teal" aria-label={dismissLabel} onClick={onDismiss}>
        <CloseIcon size={16} />
      </button>
    </div>
  );
}

function ToastMark({ tone }: { tone: Tone }) {
  if (tone === "success") return <ShieldIcon size={16} className="text-success" />;
  if (tone === "warning") return <ShieldIcon size={16} className="text-warning" />;
  if (tone === "alert") return <ShieldIcon size={16} />;
  return <SpinnerIcon size={16} />;
}
