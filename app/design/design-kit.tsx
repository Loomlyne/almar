"use client";

import { useState } from "react";
import { notoNaskh, notoSans } from "../../lib/fonts";
import { Button } from "../../components/ui/button";
import { Checkbox } from "../../components/ui/checkbox";
import { Field } from "../../components/ui/field";
import { Link } from "../../components/ui/link";
import { Radio } from "../../components/ui/radio";
import { Switch } from "../../components/ui/switch";

const SWATCHES = [
  { name: "Ivory", token: "var(--color-bg)" },
  { name: "Teal", token: "var(--color-heading)" },
  { name: "Gold", token: "var(--color-accent)" },
  { name: "Charcoal", token: "var(--color-fg)" },
] as const;

const JUMPS = ["Link", "Button", "Input", "Password", "Checkbox", "Radio", "Switch"] as const;

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

export function DesignKit() {
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
    <main className="kit" id="content">
      <header className="kit-bar">
        <h1>
          <bdi>Design system</bdi>
        </h1>
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

      <section className="kit-section" aria-label="Color">
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

      <nav className="kit-jumps" aria-label="On this page">
        {JUMPS.map((name) => (
          <a key={name} href={`#${name.toLowerCase()}`}>
            {name}
          </a>
        ))}
      </nav>

      <section className="kit-section" id="link" aria-label="Link">
        <h2>Link</h2>
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
        <h2>Button</h2>
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
        <h2>Input</h2>
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
        <Field
          id="date"
          label="Date"
          placeholder="DD/MM/YYYY"
          defaultValue="32/13/2026"
          error={
            <>
              Enter a date as <bdi>DD/MM/YYYY</bdi>.
            </>
          }
          required
        />
        <Field
          id="check-in"
          label="Check-in"
          placeholder="DD/MM/YYYY"
          value={checkIn}
          onChange={(event) => {
            const next = event.target.value;
            setCheckIn(next);
            if (checkInError) {
              const ok = DATE_PATTERN.test(next);
              setCheckInError(ok ? "" : "Enter a date as DD/MM/YYYY.");
            }
          }}
          error={checkInError || undefined}
        />
        <Button variant="secondary" onClick={() => validateDate()}>
          Check date
        </Button>
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
        <h2>Password</h2>
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
        <h2>Checkbox</h2>
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

      <section className="kit-section" id="radio" aria-label="Radio">
        <h2>Radio</h2>
        <Radio label="Deposit" name="pay-choice" value="deposit" defaultChecked />
        <Radio label="Pay in full" name="pay-choice" value="full" />
        <States
          rows={[
            ["Hover", "darken"],
            ["Focus", "teal ring"],
            ["Disabled", "muted"],
            ["Loading", "N/A"],
            ["Error", "red under the group label"],
            ["Empty", "none selected"],
          ]}
        />
      </section>

      <section className="kit-section" id="switch" aria-label="Switch">
        <h2>Switch</h2>
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
    </main>
  );
}
