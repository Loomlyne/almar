import { Fragment, type ReactNode } from "react";
import { AlertCircleIcon } from "../icons/icons";
import { Link } from "../ui/link";
import { cn } from "../../lib/cn";
import { formatIsoDate } from "../../lib/booking/trip-format";
import type { BookingReason, ReasonCode } from "../../lib/booking/types";
import { formatPlural } from "../../lib/journey-format";
import type { JourneyCopy, Locale } from "./types";

// Plan 04-03 (signed 2026-10-25): every refusal of the booking routes as one sentence with its way out. Back to the
// stay for dates, guests and availability; WhatsApp where only a person can help; Start again when the hold ended or
// the dates were taken at the hold. Props in, nothing fetched or stored.

type Action = "backToStay" | "whatsapp" | "startAgain" | null;

export type BookingReasonLinks = { stay: string; whatsapp: string; startAgain?: string };

type Line = { text: (r: BookingReason, ctx: Ctx) => ReactNode; action: Action };

type Ctx = { copy: JourneyCopy; locale: Locale; offerName?: (id: string) => string | undefined };

function fillNodes(template: string, slots: Record<string, ReactNode>): ReactNode {
  const parts = template.split(/\{(\w+)\}/g);
  return parts.map((part, i) => (i % 2 === 1 ? <Fragment key={i}>{slots[part] ?? `{${part}}`}</Fragment> : part));
}

/** The nights of a reason as DD/MM/YYYY, each kept left to right, joined in the page's language. */
function nightsNode(nights: string[], locale: Locale): ReactNode {
  const sep = locale === "ar" ? "، " : ", ";
  return nights.map((n, i) => (
    <Fragment key={n}>
      {i > 0 ? sep : null}
      <bdi dir="ltr">{formatIsoDate(n)}</bdi>
    </Fragment>
  ));
}

const plain = (key: keyof Omit<JourneyCopy["reasons"], "actions" | "below_min_nights" | "over_max_guests">): Line["text"] =>
  (_r, { copy }) => copy.reasons[key] as string;

function onNights(key: "blocked" | "sold_out"): Line["text"] {
  return (r, { copy, locale }) =>
    r.nights && r.nights.length > 0 ? fillNodes(copy.reasons[key], { nights: nightsNode(r.nights, locale) }) : copy.reasons.taken;
}

function onAddon(key: "addon_unavailable" | "addon_quantity"): Line["text"] {
  return (r, { copy, offerName }) => {
    const name = r.id ? offerName?.(r.id) : undefined;
    return name ? fillNodes(copy.reasons[key], { name: <bdi>{name}</bdi> }) : copy.reasons.invalid;
  };
}

// Exhaustive on purpose: tsc fails here when 04-08 or a later plan adds a code without a line.
const LINES: Record<ReasonCode, Line> = {
  stay_unavailable: { text: plain("stay_unavailable"), action: "backToStay" },
  dates_invalid: { text: plain("dates_invalid"), action: "backToStay" },
  below_min_nights: {
    text: (r, { copy, locale }) =>
      typeof r.min === "number" ? formatPlural(copy.reasons.below_min_nights, r.min, locale) : copy.reasons.dates_invalid,
    action: "backToStay",
  },
  over_max_guests: {
    text: (r, { copy, locale }) =>
      typeof r.max === "number" ? formatPlural(copy.reasons.over_max_guests, r.max, locale) : copy.reasons.invalid,
    action: "backToStay",
  },
  blocked: { text: onNights("blocked"), action: "backToStay" },
  sold_out: { text: onNights("sold_out"), action: "backToStay" },
  no_rate: { text: plain("no_rate"), action: "whatsapp" },
  addon_unavailable: { text: onAddon("addon_unavailable"), action: null },
  addon_quantity: { text: onAddon("addon_quantity"), action: null },
  settings_missing: { text: plain("settings_missing"), action: "whatsapp" },
  settings_changed: { text: plain("settings_changed"), action: null },
  deposit_unavailable: {
    text: (r, { copy }) => (r.cause ? copy.request.depositUnavailable[r.cause] : copy.reasons.deposit_unavailable),
    action: null,
  },
  below_minimum_charge: { text: plain("below_minimum_charge"), action: "whatsapp" },
  hold_limit: { text: plain("hold_limit"), action: "whatsapp" },
  hold_ending: { text: plain("hold_ending"), action: null },
  hold_ended: { text: plain("hold_ended"), action: "startAgain" },
  not_payable: { text: plain("not_payable"), action: "whatsapp" },
  nothing_due: { text: plain("nothing_due"), action: null },
  terms_required: { text: plain("terms_required"), action: null },
  unavailable: { text: plain("unavailable"), action: "whatsapp" },
  invalid: { text: plain("invalid"), action: null },
  requests_closed: { text: plain("requests_closed"), action: "whatsapp" },
  too_many_open: { text: plain("too_many_open"), action: "whatsapp" },
};

export type BookingReasonsProps = {
  reasons: BookingReason[];
  copy: JourneyCopy;
  locale: Locale;
  links: BookingReasonLinks;
  /** An add-on's name by its id, for addon_unavailable and addon_quantity. */
  offerName?: (id: string) => string | undefined;
  /** "hold": sold_out and blocked read "These dates were just taken." and offer Start again. */
  at?: "quote" | "hold";
  live?: "polite" | "assertive";
  className?: string;
};

export function BookingReasons({ reasons, copy, locale, links, offerName, at = "quote", live = "polite", className }: BookingReasonsProps) {
  if (reasons.length === 0) return null;
  const ctx: Ctx = { copy, locale, offerName };
  const a = copy.reasons.actions;
  const href: Record<Exclude<Action, null>, string> = {
    backToStay: links.stay,
    whatsapp: links.whatsapp,
    startAgain: links.startAgain ?? links.stay,
  };
  const label: Record<Exclude<Action, null>, string> = { backToStay: a.backToStay, whatsapp: a.whatsapp, startAgain: a.startAgain };

  return (
    <ul aria-live={live} className={cn("m-0 p-0 list-none flex flex-col gap-2", className)}>
      {reasons.map((r, i) => {
        const taken = at === "hold" && (r.code === "sold_out" || r.code === "blocked");
        const line = LINES[r.code];
        const text = taken ? copy.reasons.taken : line.text(r, ctx);
        const action: Action = taken ? "startAgain" : line.action;
        return (
          <li
            key={`${r.code}-${i}`}
            data-reason={r.code}
            className="flex items-start gap-3 border border-error border-s-4 bg-surface px-4 py-3 text-label text-ink"
          >
            <AlertCircleIcon size={20} className="shrink-0 mt-0.5 text-error" />
            <span className="flex min-w-0 flex-1 flex-col items-start">
              <span>{text}</span>
              {action ? (
                <Link
                  href={href[action]}
                  className="min-h-8"
                  {...(action === "whatsapp" ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                >
                  {label[action]}
                </Link>
              ) : null}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
