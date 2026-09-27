"use client";

import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { CalendarDate, getLocalTimeZone } from "@internationalized/date";
import { CalendarPanel, formatDate } from "../ui/calendar";
import { Button } from "../ui/button";
import { Chip } from "../ui/chip";
import { Field } from "../ui/field";
import { Link } from "../ui/link";
import { Checkbox } from "../ui/checkbox";
import { OptionSelect } from "../ui/select";
import { Switch } from "../ui/switch";
import { useToast } from "../ui/toast";
import { formatAmount } from "../../lib/format";
import { HoldCountdown } from "./hold-countdown";

const PHOTO = "/assets/img/caedcb84dd0d35bb.webp";

function Frame({ title, children }: { title: string; children: ReactNode }) {
  const id = `specimen-${title.toLowerCase().replaceAll(" ", "-")}`;
  return (
    <section className="kit-section" id={id} aria-label={title}>
      <header className="kit-head">
        <h2>{title}</h2>
      </header>
      {children}
    </section>
  );
}

function FaqCue() {
  return (
    <span className="faq-cue" aria-hidden="true">
      <svg viewBox="0 0 256 256" width="20" height="20">
        <path d="M224,128a8,8,0,0,1-8,8H136v80a8,8,0,0,1-16,0V136H40a8,8,0,0,1,0-16h80V40a8,8,0,0,1,16,0v80h80A8,8,0,0,1,224,128Z" />
      </svg>
    </span>
  );
}

const POLICY_CONTENT =
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.";

function PolicyItem({
  id,
  title,
  open,
  onToggle,
}: {
  id: string;
  title: string;
  open: boolean;
  onToggle: () => void;
}) {
  const panelId = `${id}-panel`;
  return (
    <div className={open ? "faq-item is-open" : "faq-item"}>
      <h3>
        <button
          type="button"
          id={id}
          className="faq-question"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={onToggle}
        >
          <span>{title}</span>
          <FaqCue />
        </button>
      </h3>
      <div className="faq-answer" id={panelId} role="region" aria-labelledby={id} hidden={!open}>
        <span className="faq-rule" aria-hidden="true" />
        <p>{POLICY_CONTENT}</p>
      </div>
    </div>
  );
}

function Faq() {
  // Titles from the private-stay pages. Opened body is the Policy Item
  // content variable, not an invented policy.
  const questions = [
    "Stay inclusions and staffing",
    "Availability and confirmation",
    "Changes and cancellation",
    "Occupancy and safety",
  ] as const;
  const [open, setOpen] = useState(0);
  return (
    <div className="faq-list">
      {questions.map((question, index) => (
        <PolicyItem
          key={question}
          id={`specimen-faq-q-${index}`}
          title={question}
          open={open === index}
          onToggle={() => setOpen(open === index ? -1 : index)}
        />
      ))}
    </div>
  );
}

function ShareFrame() {
  const { push } = useToast();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="ghost" type="button" onClick={() => setOpen(true)}>
        Share
      </Button>
      {open ? (
        <div className="share-sheet">
          <Button
            variant="ghost"
            type="button"
            onClick={() => push("Link copied.")}
          >
            Copy
          </Button>
          <a href="https://wa.me/971563883302">WhatsApp</a>
          <Button variant="ghost" type="button">
            Share sheet
          </Button>
        </div>
      ) : null}
    </>
  );
}

function compareDates(a: CalendarDate, b: CalendarDate) {
  if (a.year !== b.year) return a.year - b.year;
  if (a.month !== b.month) return a.month - b.month;
  return a.day - b.day;
}

function nightsBetween(start: CalendarDate, end: CalendarDate) {
  const zone = getLocalTimeZone();
  const ms = end.toDate(zone).getTime() - start.toDate(zone).getTime();
  return Math.max(0, Math.round(ms / 86_400_000));
}

function nightsLabel(count: number) {
  return count === 1 ? "1 night" : `${count} nights`;
}

function NightsRange() {
  const [start, setStart] = useState<CalendarDate | null>(new CalendarDate(2026, 9, 23));
  const [end, setEnd] = useState<CalendarDate | null>(new CalendarDate(2026, 9, 30));
  const [hover, setHover] = useState<CalendarDate | null>(null);

  function pick(date: CalendarDate) {
    if (!start || end || compareDates(date, start) === 0) {
      setStart(date);
      setEnd(null);
      return;
    }
    if (compareDates(date, start) < 0) {
      setEnd(start);
      setStart(date);
      return;
    }
    setEnd(date);
  }

  const count = start && end ? nightsBetween(start, end) : null;

  return (
    <div className="nights-row" role="group" aria-label="Arrive and leave">
      <div className="nights-fields">
        <label className="nights-field" htmlFor="nights-from">
          <span>Arrive</span>
          <input
            id="nights-from"
            name="arrive"
            readOnly
            inputMode="none"
            autoComplete="off"
            spellCheck={false}
            placeholder="DD/MM/YYYY"
            value={start ? formatDate(start) : ""}
          />
        </label>
        <span className="nights-count" role="status">
          {count === null ? "Add leave" : nightsLabel(count)}
        </span>
        <label className="nights-field" htmlFor="nights-until">
          <span>Leave</span>
          <input
            id="nights-until"
            name="leave"
            readOnly
            inputMode="none"
            autoComplete="off"
            spellCheck={false}
            placeholder="DD/MM/YYYY"
            value={end ? formatDate(end) : ""}
          />
        </label>
      </div>
      <div className="nights-calendar">
        <CalendarPanel start={start} end={end} hover={hover} onPick={pick} onHover={setHover} />
      </div>
    </div>
  );
}

const DEPOSIT_TABS = [
  {
    id: "specimen-deposit-tab-part",
    panelId: "specimen-deposit-panel-part",
    label: "Deposit",
    info: "Pay part now. The remainder is due before you travel.",
  },
  {
    id: "specimen-deposit-tab-full",
    panelId: "specimen-deposit-panel-full",
    label: "Pay in full",
    info: "Pay the whole stay now. Nothing is left to pay later.",
  },
] as const;

function DepositTabs() {
  const [active, setActive] = useState(0);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  function select(index: number) {
    setActive(index);
    tabRefs.current[index]?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const key = event.key;
    if (key !== "ArrowRight" && key !== "ArrowLeft" && key !== "Home" && key !== "End") {
      return;
    }
    event.preventDefault();
    const rtl = getComputedStyle(event.currentTarget).direction === "rtl";
    const last = DEPOSIT_TABS.length - 1;
    if (key === "Home") {
      select(0);
      return;
    }
    if (key === "End") {
      select(last);
      return;
    }
    const forward = key === "ArrowRight" ? !rtl : rtl;
    select(forward ? (active === last ? 0 : active + 1) : active === 0 ? last : active - 1);
  }

  return (
    <div className="deposit-tabs">
      <div
        className="deposit-tablist"
        role="tablist"
        aria-label="How to pay"
        aria-orientation="horizontal"
        onKeyDown={onKeyDown}
      >
        {DEPOSIT_TABS.map((tab, index) => {
          const selected = active === index;
          return (
            <button
              key={tab.id}
              ref={(node) => {
                tabRefs.current[index] = node;
              }}
              type="button"
              role="tab"
              id={tab.id}
              className="deposit-tab"
              aria-selected={selected}
              aria-controls={tab.panelId}
              tabIndex={selected ? 0 : -1}
              onClick={() => select(index)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {DEPOSIT_TABS.map((tab, index) => {
        const selected = active === index;
        return (
          <div
            key={tab.panelId}
            role="tabpanel"
            id={tab.panelId}
            className="deposit-panel"
            aria-labelledby={tab.id}
            hidden={!selected}
            tabIndex={selected ? 0 : -1}
          >
            <p>{tab.info}</p>
          </div>
        );
      })}
    </div>
  );
}

function StayPhotos() {
  const [move, setMove] = useState<"previous" | "next" | "close" | null>(null);
  return (
    <div className="photo-viewer" data-move={move ?? undefined}>
      <img className="media-16x9" src={PHOTO} alt="" />
      <div className="photo-viewer-controls">
        <button
          type="button"
          className="photo-viewer-control photo-viewer-prev"
          aria-label="Previous"
          onClick={() => setMove("previous")}
        >
          <svg
            className="icon-back"
            viewBox="0 0 24 24"
            width="20"
            height="20"
            aria-hidden="true"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M9 6.5 14.5 12 9 17.5" />
          </svg>
        </button>
        <button
          type="button"
          className="photo-viewer-control photo-viewer-next"
          aria-label="Next"
          onClick={() => setMove("next")}
        >
          <svg
            className="icon-forward"
            viewBox="0 0 24 24"
            width="20"
            height="20"
            aria-hidden="true"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M9 6.5 14.5 12 9 17.5" />
          </svg>
        </button>
        <button
          type="button"
          className="photo-viewer-control photo-viewer-close"
          aria-label="Close"
          onClick={() => setMove("close")}
        >
          <svg
            viewBox="0 0 24 24"
            width="20"
            height="20"
            aria-hidden="true"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M6.5 6.5 17.5 17.5M17.5 6.5 6.5 17.5" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function MessageForm({ id }: { id: string }) {
  return (
    <>
      <Field id={`${id}-name`} label="Name" name={`${id}-name`} />
      <Field id={`${id}-email`} label="Email" name={`${id}-email`} />
      <Field id={`${id}-phone`} label="Phone" name={`${id}-phone`} />
      <Field id={`${id}-message`} label="Message" name={`${id}-message`} multiline />
      <Button variant="primary" type="button">
        Send
      </Button>
    </>
  );
}

export function CatalogFrames({ hasMapbox = false }: { hasMapbox?: boolean }) {
  return (
    <>
      <Frame title="Package">
        <div className="package-row">
          {(["Explorer", "Resident", "Sovereign"] as const).map((name) => (
            <article key={name} className="package-card">
              <img className="package-card-photo" src={PHOTO} alt="" />
              <div className="package-card-body">
                <div className="package-card-copy">
                  <h3 className="package-card-name">{name}</h3>
                  <p className="package-card-line">Private Colombia, one group.</p>
                </div>
                <p className="package-card-price">{formatAmount("AED", 1050)}</p>
                <Button variant="primary" type="button" className="package-card-action">
                  Request
                </Button>
              </div>
            </article>
          ))}
        </div>
      </Frame>
      <Frame title="Story">
        <img className="media-16x9" src={PHOTO} alt="" />
        <h3 className="display-name">Cartagena at dusk</h3>
        <p>One line. No comments.</p>
      </Frame>
      <Frame title="Destination">
        <div className="destination-card">
          <img src={PHOTO} alt="Cartagena, Colombia" />
          <div className="destination-card-panel">
            <h3>Cartagena</h3>
            <img src={PHOTO} alt="" />
            <p className="destination-card-line">
              Cartagena is ALMAR’s densest verified inventory: colonial houses in Getsemaní and the Historic Center, San Diego residences, Bocagrande beach houses, Barú villas, private islands, and marine charters.
            </p>
            <p className="destination-card-nights">3–7 nights</p>
          </div>
        </div>
      </Frame>
      <Frame title="Legal">
        <div className="legal-copy">
          <p>
            Booking terms sit in this column. The gold rule is under the title. This is fixture copy, not a contract.
          </p>
        </div>
      </Frame>
      <Frame title="FAQ">
        <Faq />
      </Frame>
      <Frame title="Maintenance">
        <p className="maintenance-bar">Booking is paused for maintenance.</p>
      </Frame>
      <Frame title="Cookie">
        <div className="cookie-bar">
          <Switch label="Necessary" checked disabled />
          <Switch label="Analytics" />
          <Switch label="Marketing" />
          <Button variant="primary" type="button">
            Save
          </Button>
        </div>
      </Frame>
      <Frame title="Map">
        <div className="map-panel">
          {hasMapbox ? (
            <img
              alt="Approximate map of Cartagena"
              src="/design/map"
              width={448}
              height={448}
              onError={(event) => {
                event.currentTarget.hidden = true;
              }}
            />
          ) : null}
          <p>Approximate</p>
        </div>
      </Frame>
      <Frame title="File upload">
        <div className="upload-drop">
          <p>Upload file</p>
          <Button variant="primary" type="button">
            Upload file
          </Button>
        </div>
      </Frame>
      <Frame title="Ops table">
        <table className="ops-table">
          <thead>
            <tr>
              <th>Trip</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Cartagena</td>
              <td>Confirmed</td>
            </tr>
            <tr>
              <td>Medellín</td>
              <td>Draft</td>
            </tr>
          </tbody>
        </table>
      </Frame>
      <Frame title="Currency">
        <OptionSelect label="Currency" options={["AED", "USD", "EUR"]} value="AED" />
      </Frame>
      <Frame title="Language">
        <OptionSelect label="Language" options={["English", "العربية", "Español"]} value="English" />
      </Frame>
      <Frame title="Sort">
        <OptionSelect label="Sort" options={["Price", "Date"]} value="Price" />
      </Frame>
      <Frame title="Filter">
        <Chip on>Villa</Chip>
        <Chip>House</Chip>
      </Frame>
      <Frame title="Consultation">
        <Chip on>14:00</Chip>
        <span className="guest-time">Guest 10:00</span>
        <Chip muted>09:00</Chip>
      </Frame>
      <Frame title="Booking steps">
        <ol className="booking-steps">
          <li className="is-done">Stay</li>
          <li className="is-current">Dates</li>
          <li>Guests</li>
        </ol>
      </Frame>
      <Frame title="Share">
        <ShareFrame />
      </Frame>
      <Frame title="Heart">
        <button type="button" className="heart-saved" aria-pressed="true">
          Remove saved stay
        </button>
      </Frame>
      <Frame title="Unsigned heart">
        <a className="heart-unsigned" href="#sign-in">
          Save this stay
        </a>
      </Frame>
      <Frame title="Photos">
        <StayPhotos />
      </Frame>
      <Frame title="Print">
        <Button variant="ghost" type="button">
          Print
        </Button>
      </Frame>
      <Frame title="Download">
        <Button variant="ghost" type="button">
          Download
        </Button>
      </Frame>
      <Frame title="Contact">
        <MessageForm id="contact-form" />
      </Frame>
      <Frame title="Plan with us">
        <MessageForm id="plan" />
      </Frame>
      <Frame title="List with us">
        <MessageForm id="list" />
      </Frame>
      <Frame title="Special requests">
        <Field id="requests" label="Special requests" name="requests" multiline optional />
      </Frame>
      <Frame title="Address">
        <Checkbox name="address-kind" label="Home" defaultChecked />
        <Checkbox name="address-kind" label="Work" />
        <Checkbox name="address-kind" label="Custom" />
        <p>Villa 12, Palm Jumeirah</p>
        <Button variant="ghost" type="button">
          Edit
        </Button>
      </Frame>
      <Frame title="Return address">
        <p>Villa 12, Palm Jumeirah</p>
        <Button variant="ghost" type="button">
          Change
        </Button>
      </Frame>
      <Frame title="Second city">
        <a href="https://wa.me/971563883302?text=ALMAR-104283">Add a second city</a>
      </Frame>
      <Frame title="WhatsApp trip">
        <a href="https://wa.me/971563883302?text=Cartagena%2C%20five%20nights%20ALMAR-104283">
          Cartagena, five nights ALMAR-104283
        </a>
      </Frame>
      <Frame title="Inclusions">
        <ul className="inclusion-list">
          <li>Airport meet</li>
          <li>
            Home pickup <span className="amount">{formatAmount("AED", 200)}</span>
          </li>
        </ul>
      </Frame>
      <Frame title="Package add-on">
        <p>Airport transfer</p>
        <p>Included</p>
      </Frame>
      <Frame title="Pets">
        <p>Pets are not allowed.</p>
        <p>Pets are allowed.</p>
        <p>Pet fee applies.</p>
      </Frame>
      <Frame title="Access">
        <p className="access-line">Exact address after confirmation.</p>
      </Frame>
      <Frame title="Too late">
        <p>23/09/2026 – 30/09/2026</p>
        <p>These dates are too late to book today.</p>
      </Frame>
      <Frame title="Nights">
        <NightsRange />
      </Frame>
      <Frame title="Back">
        <Link href="#content">Back</Link>
      </Frame>
      <Frame title="Experiences">
        <ul className="experience-results">
          {(
            [
              {
                title: "Yacht & Island Charters",
                body: "Private yachts and speedboats to the Rosario Islands, Barú, and hidden Caribbean coves with chef, crew, and snorkeling gear.",
                time: "Half, Full Day",
                img: "/assets/img/85bdc83c0860c091.webp",
                alt: "Yacht & Island Charters, ALMAR marine service in Colombia.",
              },
              {
                title: "Rosario Islands Escape",
                body: "Speedboat to pristine Caribbean islands with beach club access, snorkeling over coral reefs, and a private lunch on the sand.",
                time: "Full Day",
                img: "/assets/img/0dadd08a491bfc52.webp",
                alt: "Rosario Islands Escape, ALMAR marine service in Colombia.",
              },
              {
                title: "Cartagena Heritage Tours",
                body: "Private historian-led walks through the Walled City, Getsemaní street art, and exclusive after-hours access to colonial mansions.",
                time: "Half, Full Day",
                img: "/assets/img/2e8e18393ba7bc74.webp",
                alt: "Cartagena Heritage Tours, ALMAR culture service in Colombia.",
              },
            ] as const
          ).map((item) => (
            <li key={item.title}>
              <article className="experience-result">
                <img src={item.img} alt={item.alt} />
                <div className="experience-result-copy">
                  <h3>
                    <a href="/experiences">{item.title}</a>
                  </h3>
                  <p>{item.body}</p>
                  <p className="experience-result-time">{item.time}</p>
                </div>
              </article>
            </li>
          ))}
        </ul>
      </Frame>
      <Frame title="Empty rooms">
        <p>No stays for these dates</p>
      </Frame>
      <Frame title="Coupon">
        <Field id="coupon-code" label="Coupon" name="coupon" coupon />
      </Frame>
      <Frame title="Phone price bar">
        <div className="phone-bar">
          <span className="amount">{formatAmount("AED", 1050)}</span>
          <Button variant="primary" type="button">
            Continue
          </Button>
        </div>
      </Frame>
      <Frame title="Hold countdown">
        <HoldCountdown />
      </Frame>
      <Frame title="Damage hold">
        <p>
          Temporarily held <span className="amount">{formatAmount("AED", 500)}</span>
        </p>
      </Frame>
      <Frame title="Deposit">
        <DepositTabs />
      </Frame>
      <Frame title="Newsletter">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const email = String(new FormData(form).get("email") ?? "").trim();
            const status = form.querySelector("[data-notify-status]");
            if (status) {
              status.textContent = email
                ? `${email} will be notified.`
                : "Enter an email to be notified.";
            }
          }}
          style={{
            display: "grid",
            gap: "8px",
            justifyItems: "start",
            maxWidth: "36rem",
          }}
        >
          <label
            htmlFor="specimen-newsletter-email"
            style={{
              color: "var(--color-fg)",
              fontSize: "14px",
              fontWeight: 400,
              lineHeight: 1.4,
            }}
          >
            Email
          </label>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "stretch",
              gap: "8px",
              maxWidth: "100%",
            }}
          >
            <input
              id="specimen-newsletter-email"
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              placeholder="name@example.com"
              required
              style={{
                boxSizing: "border-box",
                flex: "1 1 16rem",
                width: "16rem",
                maxWidth: "100%",
                minWidth: 0,
                height: "44px",
                margin: 0,
                padding: "0 16px",
                border: "1px solid var(--color-border)",
                borderRadius: 0,
                background: "var(--color-surface)",
                color: "var(--color-fg)",
                fontFamily: "inherit",
                fontSize: "16px",
                fontWeight: 400,
                lineHeight: 1.4,
              }}
            />
            <Button
              variant="primary"
              type="submit"
              style={{
                boxSizing: "border-box",
                flex: "0 0 auto",
                width: "max-content",
                maxWidth: "100%",
                height: "44px",
                minHeight: "44px",
                paddingBlock: 0,
                borderRadius: 0,
              }}
            >
              Notify me
            </Button>
          </div>
          <p
            data-notify-status
            role="status"
            style={{
              margin: 0,
              minHeight: "1.5em",
              color: "var(--color-fg)",
              fontSize: "16px",
              lineHeight: 1.5,
            }}
          />
        </form>
      </Frame>
      <Frame title="Airport meet">
        <Checkbox label="Airport meet" defaultChecked disabled />
        <p>Included</p>
      </Frame>
      <Frame title="Home pickup">
        <Checkbox
          name="home-pickup-specimen"
          label={
            <>
              Home pickup <span className="amount">{formatAmount("AED", 200)}</span>
            </>
          }
        />
      </Frame>
      <Frame title="Driver assigned">
        <span className="status-chip is-driver-assigned">Driver assigned</span>
      </Frame>
      <Frame title="Flights booked">
        <span className="status-chip is-flights-booked">Flights booked</span>
      </Frame>
    </>
  );
}
