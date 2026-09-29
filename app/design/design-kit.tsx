"use client";

import { useState } from "react";
import { notoNaskh, notoSans } from "../../lib/fonts";
import { Button } from "../../components/ui/button";
import { Checkbox } from "../../components/ui/checkbox";
import { Chip } from "../../components/ui/chip";
import { Stepper } from "../../components/ui/stepper";
import { ToastProvider } from "../../components/ui/toast";
import { Field } from "../../components/ui/field";
import { SiteFooter } from "../../components/ui/footer";
import { SiteNav } from "../../components/ui/nav";
import { AccountFrames } from "../../components/specimens/account-frames";
import { CatalogFrames } from "../../components/specimens/catalog-frames";
import { TeamSpecimen } from "../../components/specimens/team";
import { AddOnRow } from "../../components/specimens/add-on";
import { HeroBooker } from "../../components/specimens/hero-booker";
import { EmptyStays, StayRow } from "../../components/specimens/stay-row";
import { PaymentFailed, PriceBlock, ReviewFrame } from "../../components/specimens/price";
import { VideoSpecimen } from "../../components/specimens/video";
import { Link } from "../../components/ui/link";
import { Switch } from "../../components/ui/switch";
import {
  CameraIcon,
  CarIcon,
  CheersIcon,
  ChevronIcon,
  CloseIcon,
  EyeIcon,
  GuestIcon,
  HeadsetIcon,
  HeartIcon,
  LockIcon,
  LotusIcon,
  LuggageIcon,
  PalmIcon,
  PinIcon,
  PlaneIcon,
  ShieldIcon,
  SpinnerIcon,
  StayIcon,
  VipIcon,
  YachtIcon,
} from "../../components/icons/icons";
import { ProjectUpdate } from "./framer-kit";
import { HomeCardsSection } from "../../components/specimens/home-cards";
import { PrivateStaySection } from "../../components/specimens/private-stay-card";
import { ProjectFooterSection } from "../../components/specimens/project-footer";
import { TeamMemberSection } from "../../components/specimens/team-member-card";
import monogram from "../../brand/Logo Monogram/Curves_black.svg";

const SWATCHES = [
  { name: "Ivory", token: "var(--color-bg)" },
  { name: "Teal", token: "var(--color-heading)" },
  { name: "Gold", token: "var(--color-accent)" },
  { name: "Charcoal", token: "var(--color-fg)" },
] as const;

const NOTES: Record<string, string> = {
  Color: "Ivory, teal, gold, and charcoal.",
  Link: "Back to the top of the page.",
  Button: "Continue, search, edit, and pay.",
  Input: "Dates, notes, and the fields a guest fills.",
  Password: "Show and hide. The eye has no box.",
  Checkbox: "A square mark. Not a radio.",
  Switch: "On and off, with a short slide.",
  Select: "A destination, in a square menu.",
  "Date range": "Check-in, then check-out.",
  Stepper: "Adults, children, and infants.",
  Modal: "Confirm before the booking changes.",
  Toast: "A short note, then it goes.",
  Card: "The stay, with its photo.",
  Icons: "The marks used on the journey.",
  Chip: "A status, in words and in color.",
  Nav: "Destinations, currency, and language.",
  Hero: "Destination, dates, and who is travelling.",
  Stay: "The house, the price, and the choice.",
  "Empty stays": "No house for these dates.",
  "Add-on": "What can be added to the journey.",
  Price: "The total, the deposit, and what is held.",
  Review: "The stay, before payment.",
  "Payment failed": "What to do when a payment does not go through.",
  Video: "A film of the place.",
  Footer: "How to reach ALMAR.",
  Team: "The people who plan the journey.",
};

const CHAPTERS = [
  {
    id: "chapter-brand",
    title: "Brand",
    note: "Ivory, teal, gold, and charcoal.",
    items: [
      ["Color", "color"],
      ["Wordmark", "wordmark"],
      ["Site header", "site-header"],
      ["Project stays", "project-stays"],
    ] as const,
  },
  {
    id: "chapter-controls",
    title: "Controls",
    note: "The parts a booking is made of.",
    items: [
      ["Link", "link"],
      ["Button", "button"],
      ["Input", "input"],
      ["Password", "password"],
      ["Checkbox", "checkbox"],
      ["Switch", "switch"],
      ["Select", "select"],
      ["Date range", "date-range"],
      ["Stepper", "stepper"],
      ["Modal", "modal"],
      ["Toast", "toast"],
      ["Card", "card"],
      ["Icons", "icons"],
      ["Chip", "chip"],
    ] as const,
  },
  {
    id: "chapter-journey",
    title: "The journey",
    note: "The stay, the dates, and the price.",
    items: [
      ["Nav", "nav"],
      ["Hero", "hero"],
      ["Stay", "stay"],
      ["Empty stays", "empty-stays"],
      ["Add-on", "add-on"],
      ["Price", "price"],
      ["Review", "review"],
      ["Payment failed", "payment-failed"],
      ["Video", "video"],
      ["Team", "specimen-team"],
      ["Footer", "footer"],
    ] as const,
  },
  {
    id: "chapter-guest",
    title: "The guest",
    note: "Sign-in, the booking, and payment.",
    items: [
      "Sign-in",
      "Ops sign-in",
      "Account menu",
      "Account",
      "Change email",
      "Change phone",
      "Reset password",
      "Forgot password",
      "Check your email",
      "Sign out",
      "Delete account",
      "Cancel booking",
      "Session expired",
      "Booking terms",
      "Marketing emails",
      "Booker not staying",
      "Guest names",
      "Passport",
      "UAE airport",
      "Saved card",
      "Stripe",
      "Pay success",
      "Hold expired",
      "Create an account later",
      "Pay the difference",
      "Pay the remainder",
      "Currency on pay",
      "Status",
      "Booking header",
      "Booking list",
    ].map((title) => [title, title.toLowerCase().replaceAll(" ", "-")] as const),
  },
  {
    id: "chapter-catalog",
    title: "The catalog",
    note: "Packages, contact, and the rest of the journey.",
    items: [
      "Package",
      "Story",
      "Destination",
      "Legal",
      "FAQ",
      "Maintenance",
      "Cookie",
      "Map",
      "File upload",
      "Ops table",
      "Currency",
      "Language",
      "Sort",
      "Filter",
      "Consultation",
      "Booking steps",
      "Share",
      "Heart",
      "Unsigned heart",
      "Photos",
      "Print",
      "Download",
      "Contact",
      "Plan with us",
      "List with us",
      "Special requests",
      "Address",
      "Return address",
      "Second city",
      "WhatsApp trip",
      "Inclusions",
      "Package add-on",
      "Pets",
      "Access",
      "Too late",
      "Nights",
      "Back",
      "Experiences",
      "Empty rooms",
      "Coupon",
      "Phone price bar",
      "Hold countdown",
      "Damage hold",
      "Deposit",
      "Newsletter",
      "Airport meet",
      "Home pickup",
      "Driver assigned",
      "Flights booked",
    ].map((title) => [title, `specimen-${title.toLowerCase().replaceAll(" ", "-")}`] as const),
  },
] as const;

function SectionHead({ title }: { title: string }) {
  return (
    <header className="kit-head">
      <h2>{title}</h2>
      {NOTES[title] ? <p className="kit-sub">{NOTES[title]}</p> : null}
    </header>
  );
}

function Chapter({ id, title, note }: { id: string; title: string; note: string }) {
  return (
    <header className="kit-chapter" id={id}>
      <h2>{title}</h2>
      <p className="kit-sub">{note}</p>
    </header>
  );
}

const NOTO_CLASSES = `${notoNaskh.variable} ${notoSans.variable}`.split(" ");

type Locale = "en" | "ar" | "es";

function setLocale(locale: Locale) {
  const root = document.documentElement;
  root.lang = locale === "ar" ? "ar" : locale === "es" ? "es" : "en";
  root.dir = locale === "ar" ? "rtl" : "ltr";
  root.classList.remove(...NOTO_CLASSES);
  if (locale === "ar") root.classList.add(...NOTO_CLASSES);
}

const DATE_PATTERN = /^(0[1-9]|[12]\d|3[01])\/(0[1-9]|1[0-2])\/\d{4}$/;

function States({ rows }: { rows: Array<[string, string]> }) {
  return (
    <dl className="state-grid">
      {rows.map(([state, note]) => (
        <div key={state}>
          <dt>{state}</dt>
          <dd>{note}</dd>
        </div>
      ))}
    </dl>
  );
}

export function DesignKit({ hasMapbox = false }: { hasMapbox?: boolean }) {
  const [locale, setLocaleState] = useState<Locale>("en");
  const [compact, setCompact] = useState(false);
  const [checkIn, setCheckIn] = useState("");
  const [checkInError, setCheckInError] = useState("");

  function chooseLocale(next: Locale) {
    setLocaleState(next);
    setLocale(next);
  }

  function toggleCompact() {
    const next = !compact;
    setCompact(next);
    if (next) document.documentElement.setAttribute("data-density", "compact");
    else document.documentElement.removeAttribute("data-density");
  }

  function validateDate(next = checkIn) {
    const ok = DATE_PATTERN.test(next);
    setCheckInError(ok ? "" : "Enter a date as DD/MM/YYYY.");
    if (!ok) document.getElementById("check-in")?.focus();
  }

  return (
    <ToastProvider>
    <main className="kit" id="content">
      <div className="kit-shell">
      <nav className="kit-side" aria-label="On this page">
        {CHAPTERS.map((chapter) => (
          <div className="kit-side-group" key={chapter.id}>
            <a className="kit-side-label" href={`#${chapter.id}`}>
              {chapter.title}
            </a>
            {chapter.items.map(([name, id]) => (
              <a key={id} href={`#${id}`}>
                {name}
              </a>
            ))}
          </div>
        ))}
      </nav>
      <div className="kit-main">
      <header className="kit-bar">
        <div className="kit-head">
          <h1>
            <bdi>ALMAR</bdi>
          </h1>
          <p className="kit-sub">Private journeys in Colombia.</p>
        </div>
        <div className="kit-controls">
          <button type="button" className="kit-control" aria-pressed={locale === "en"} onClick={() => chooseLocale("en")}>
            EN
          </button>
          <button type="button" className="kit-control" aria-pressed={locale === "ar"} onClick={() => chooseLocale("ar")}>
            AR
          </button>
          <button type="button" className="kit-control" aria-pressed={locale === "es"} onClick={() => chooseLocale("es")}>
            ES
          </button>
          <button type="button" className="kit-control" aria-pressed={compact} onClick={toggleCompact}>
            Compact
          </button>
        </div>
      </header>

      <Chapter id="chapter-brand" title="Brand" note="Ivory, teal, gold, and charcoal." />
      <section className="kit-section" id="color" aria-label="Color">
        <SectionHead title="Color" />
        <ul className="swatches">
          {SWATCHES.map((swatch) => (
            <li key={swatch.name}>
              <figure className="swatch">
                <div className="swatch-chip" style={{ background: swatch.token }} />
                <figcaption>
                  <bdi>{swatch.name}</bdi>
                </figcaption>
              </figure>
            </li>
          ))}
        </ul>
      </section>

      <ProjectUpdate />

      <Chapter id="chapter-controls" title="Controls" note="The parts a booking is made of." />

      <section className="kit-section" id="link" aria-label="Link">
        <SectionHead title="Link" />
        <Link href="#content">Back</Link>
        <States
          rows={[
            ["Hover", "gold text"],
            ["Focus", "teal ring"],
            ["Disabled", "N/A"],
            ["Loading", "N/A"],
            ["Error", "N/A"],
            ["Empty", "N/A"],
          ]}
        />
      </section>

      <section className="kit-section" id="button" aria-label="Button">
        <SectionHead title="Button" />
        <div className="specimen-row">
          <Button variant="primary">Continue</Button>
          <Button variant="secondary">Search</Button>
          <Button variant="ghost">Edit</Button>
          <Button variant="danger">Sign out</Button>
          <Button variant="primary" disabled>
            Save
          </Button>
          <Button variant="primary" busy>
            Pay
          </Button>
        </div>
        <States
          rows={[
            ["Hover", "darker fill or border"],
            ["Focus", "teal ring"],
            ["Disabled", "muted, no gold"],
            ["Loading", "spinner, label stays"],
            ["Error", "N/A"],
            ["Empty", "N/A"],
          ]}
        />
      </section>

      <section className="kit-section" id="input" aria-label="Input">
        <SectionHead title="Input" />
        <Field
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="name@example.com"
          required
        />
        <Field id="phone" label="Phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="+971 00 000 0000" />
        <Field id="search" label="Search" type="search" search placeholder="Cartagena" />
        <Field id="note" label="Note" multiline optional placeholder="Add a note" />
        <Field id="coupon" label="Coupon" coupon optional placeholder="WELCOME" />
        <div className="date-check">
          <label className="field-label" htmlFor="check-in">
            Check-in
          </label>
          <div className={checkInError ? "date-check-control is-invalid" : "date-check-control"}>
            <input
              id="check-in"
              className="date-check-input"
              placeholder="DD/MM/YYYY"
              value={checkIn}
              inputMode="numeric"
              autoComplete="off"
              spellCheck={false}
              aria-invalid={checkInError ? true : undefined}
              aria-describedby={checkInError ? "check-in-message" : undefined}
              onChange={(event) => {
                const next = event.target.value;
                setCheckIn(next);
                if (checkInError) {
                  const ok = DATE_PATTERN.test(next);
                  setCheckInError(ok ? "" : "Enter a date as DD/MM/YYYY.");
                }
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  validateDate();
                }
              }}
            />
            <button type="button" className="date-check-action" onClick={() => validateDate()}>
              Check date
            </button>
          </div>
          {checkInError ? (
            <p id="check-in-message" className="field-error text-[var(--color-danger)]">
              {checkInError}
            </p>
          ) : null}
        </div>
        <States
          rows={[
            ["Hover", "border unchanged"],
            ["Focus", "teal ring, border unchanged"],
            ["Disabled", "muted"],
            ["Loading", "N/A"],
            ["Error", "red hint replacement"],
            ["Empty", "example placeholder"],
          ]}
        />
      </section>

      <section className="kit-section" id="password" aria-label="Password">
        <SectionHead title="Password" />
        <Field
          id="design-password"
          label="Password"
          type="password"
          autoComplete="current-password"
          hint="Use at least 8 characters."
        />
        <States
          rows={[
            ["Hover", "border unchanged"],
            ["Focus", "teal ring"],
            ["Disabled", "eye still named"],
            ["Loading", "N/A"],
            ["Error", "Use at least 8 characters."],
            ["Empty", "example placeholder"],
          ]}
        />
      </section>

      <section className="kit-section" id="checkbox" aria-label="Checkbox">
        <SectionHead title="Checkbox" />
        <Checkbox label="Remember me" name="remember" />
        <Checkbox label="Newsletter" name="newsletter" disabled />
        <States
          rows={[
            ["Hover", "darken"],
            ["Focus", "teal ring"],
            ["Disabled", "muted"],
            ["Loading", "N/A"],
            ["Error", "red under label"],
            ["Empty", "unchecked"],
          ]}
        />
      </section>

      <section className="kit-section" id="switch" aria-label="Switch">
        <SectionHead title="Switch" />
        <div className="specimen-row">
          <Switch label="Email updates on" defaultChecked />
          <Switch label="Offers on" />
          <Switch label="Alerts on" disabled />
        </div>
        <States
          rows={[
            ["On", "teal track"],
            ["Off", "ivory track"],
            ["Focus", "teal ring"],
            ["Disabled", "muted"],
            ["Loading", "N/A"],
            ["Error", "N/A"],
            ["Empty", "N/A"],
          ]}
        />
      </section>

      <section className="kit-section" id="select" aria-label="Select">
        <SectionHead title="Select" />
        <States
          rows={[
            ["Hover", "same as input"],
            ["Focus", "same as input"],
            ["Disabled", "muted"],
            ["Loading", "N/A"],
            ["Error", "red hint replacement"],
            ["Empty", "No options to show"],
          ]}
        />
      </section>

      <section className="kit-section" id="date-range" aria-label="Date range">
        <SectionHead title="Date range" />
        <States
          rows={[
            ["Hover", "teal edge"],
            ["Focus", "same teal edge"],
            ["Disabled", "muted, not selectable"],
            ["Loading", "N/A"],
            ["Empty", "No range yet"],
          ]}
        />
      </section>

      <section className="kit-section" id="stepper" aria-label="Stepper">
        <SectionHead title="Stepper" />
        <StepperSpecimen />
        <States
          rows={[
            ["Hover", "darken"],
            ["Focus", "teal ring"],
            ["Disabled", "minus at floor"],
            ["Loading", "N/A"],
            ["Error", "N/A"],
            ["Empty", "N/A"],
          ]}
        />
      </section>

      <section className="kit-section" id="modal" aria-label="Modal">
        <SectionHead title="Modal" />
        <States
          rows={[
            ["Hover", "N/A"],
            ["Focus", "focus trapped"],
            ["Disabled", "N/A"],
            ["Loading", "N/A"],
            ["Error", "N/A"],
            ["Empty", "N/A"],
          ]}
        />
      </section>

      <section className="kit-section" id="toast" aria-label="Toast">
        <SectionHead title="Toast" />
        <States
          rows={[
            ["Hover", "pause timer"],
            ["Focus", "dismiss control ring"],
            ["Disabled", "N/A"],
            ["Loading", "N/A"],
            ["Error", "4 seconds, then dismiss"],
            ["Empty", "N/A"],
          ]}
        />
      </section>

      <section className="kit-section" id="card" aria-label="Card">
        <SectionHead title="Card" />
        <div className="card-specimen">
          <div className="card-image" />
          <div className="card-pulse" />
          <img
            className="card-monogram"
            alt=""
            src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(monogram)}`}
          />
        </div>
        <States
          rows={[
            ["Hover", "image outline only"],
            ["Focus", "N/A"],
            ["Disabled", "N/A"],
            ["Loading", "skeleton"],
            ["Error", "N/A"],
            ["Empty", "missing-image monogram"],
          ]}
        />
      </section>

      <section className="kit-section" id="icons" aria-label="Icons">
        <SectionHead title="Icons" />
        <div className="icon-row">
          <CameraIcon title="Mark" />
          <LuggageIcon />
          <VipIcon />
          <YachtIcon />
          <CheersIcon />
          <PalmIcon />
          <GuestIcon />
          <PlaneIcon />
          <StayIcon />
          <PinIcon />
          <CarIcon />
          <ShieldIcon />
          <LotusIcon />
          <HeadsetIcon />
          <EyeIcon />
          <ChevronIcon />
          <CloseIcon />
          <LockIcon />
          <HeartIcon />
          <SpinnerIcon />
        </div>
        <States
          rows={[
            ["Hover", "inherit"],
            ["Focus", "N/A"],
            ["Disabled", "inherit muted"],
            ["Loading", "spinner glyph"],
            ["Error", "N/A"],
            ["Empty", "N/A"],
          ]}
        />
      </section>

      <section className="kit-section" id="chip" aria-label="Chip">
        <SectionHead title="Chip" />
        <div className="specimen-row">
          <Chip>Chip</Chip>
          <Chip on>On</Chip>
        </div>
      </section>
      <Chapter id="chapter-journey" title="The journey" note="The stay, the dates, and the price." />
      <section className="kit-section" id="nav" aria-label="Nav">
        <SectionHead title="Nav" />
        <SiteNav locale={locale} onLocale={chooseLocale} />
        <States
          rows={[
            ["Hover", "link hover"],
            ["Focus", "teal focus ring"],
            ["Disabled", "N/A"],
            ["Loading", "N/A"],
            ["Error", "N/A"],
            ["Empty", "N/A"],
          ]}
        />
      </section>
      <section className="kit-section" id="hero" aria-label="Hero">
        <SectionHead title="Hero" />
        <HeroBooker />
      </section>
      <section className="kit-section" id="stay" aria-label="Stay">
        <SectionHead title="Stay" />
        <StayRow />
      </section>
      <section className="kit-section" id="empty-stays" aria-label="Empty stays">
        <SectionHead title="Empty stays" />
        <EmptyStays />
      </section>
      <section className="kit-section" id="add-on" aria-label="Add-on">
        <SectionHead title="Add-on" />
        <AddOnRow />
      </section>
      <section className="kit-section" id="price" aria-label="Price">
        <SectionHead title="Price" />
        <PriceBlock />
      </section>
      <section className="kit-section" id="review" aria-label="Review">
        <SectionHead title="Review" />
        <ReviewFrame />
      </section>
      <section className="kit-section" id="payment-failed" aria-label="Payment failed">
        <SectionHead title="Payment failed" />
        <PaymentFailed />
      </section>
      <section className="kit-section" id="video" aria-label="Video">
        <SectionHead title="Video" />
        <VideoSpecimen />
      </section>
      <TeamSpecimen />
      <section className="kit-section" id="footer" aria-label="Footer">
        <SectionHead title="Footer" />
        <SiteFooter />
      </section>
      <Chapter id="chapter-guest" title="The guest" note="Sign-in, the booking, and payment." />
      <AccountFrames />
      <Chapter id="chapter-catalog" title="The catalog" note="Packages, contact, and the rest of the journey." />
      <CatalogFrames hasMapbox={hasMapbox} />
      <ProjectFooterSection locale={locale} />
      <TeamMemberSection locale={locale} />
      <PrivateStaySection locale={locale} />
      <HomeCardsSection locale={locale} />
      <div id="destinations" />
      <div id="experiences" />
      <div id="about" />
      <div id="contact" />
      <div id="log-in" />
      <div id="list-with-us" />
      </div>
      </div>
    </main>
    </ToastProvider>
  );
}

// Legacy /design specimen only; plan 07 deletes this route. Controlled Stepper demo.
function StepperSpecimen() {
  const [count, setCount] = useState(1);
  return (
    <Stepper value={count} onChange={setCount} min={1} max={9} addLabel="Add adult" removeLabel="Remove adult" />
  );
}
