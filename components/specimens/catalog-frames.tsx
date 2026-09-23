"use client";

import { useState, type ReactNode } from "react";
import { Button } from "../ui/button";
import { Chip } from "../ui/chip";
import { Field } from "../ui/field";
import { Link } from "../ui/link";
import { Radio } from "../ui/radio";
import { OptionSelect } from "../ui/select";
import { Switch } from "../ui/switch";
import { useToast } from "../ui/toast";
import { formatAmount } from "../../lib/format";

const PHOTO = "/assets/img/caedcb84dd0d35bb.webp";

function Frame({ title, children }: { title: string; children: ReactNode }) {
  const id = `specimen-${title.toLowerCase().replaceAll(" ", "-")}`;
  return (
    <section className="kit-section" id={id} aria-label={title}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function Faq() {
  const items = [
    ["What is included?", "Airport meet is included. Extras show a price."],
    ["When do I pay?", "A deposit holds the dates."],
  ] as const;
  const [open, setOpen] = useState(0);
  return (
    <div className="faq-list">
      {items.map(([question, answer], index) => (
        <div key={question}>
          <button
            type="button"
            className="faq-question"
            aria-expanded={open === index}
            onClick={() => setOpen(index)}
          >
            {question}
          </button>
          {open === index ? <p>{answer}</p> : null}
        </div>
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

export function CatalogFrames() {
  return (
    <>
      <Frame title="Package">
        <div className="package-row">
          {(["Explorer", "Resident", "Sovereign"] as const).map((name) => (
            <article key={name} className="package-card">
              <img className="media-16x9" src={PHOTO} alt="" />
              <h3 className="display-name">{name}</h3>
              <p>Private Colombia, one group.</p>
              <p className="amount">{formatAmount("AED", 1050)}</p>
              <Button variant="secondary" type="button">
                Request
              </Button>
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
          <img src={PHOTO} alt="" />
          <p>Cartagena</p>
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
          <span className="map-pin" aria-hidden="true" />
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
        <Button variant="ghost" type="button">
          Photos
        </Button>
        <div className="photo-viewer">
          <img className="media-16x9" src={PHOTO} alt="" />
          <Button variant="ghost" type="button">
            Previous
          </Button>
          <Button variant="ghost" type="button">
            Next
          </Button>
          <Button variant="primary" type="button">
            Close
          </Button>
        </div>
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
        <Radio name="address-kind" label="Home" defaultChecked />
        <Radio name="address-kind" label="Work" />
        <Radio name="address-kind" label="Custom" />
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
        <div className="nights-row">
          <Field id="nights-from" label="Arrive" name="arrive" defaultValue="23/09/2026" />
          <span className="nights-count">7</span>
          <Field id="nights-until" label="Leave" name="leave" defaultValue="30/09/2026" />
        </div>
      </Frame>
      <Frame title="Back">
        <Link href="#content">Back</Link>
      </Frame>
      <Frame title="Experiences">
        <Field id="experience-search" label="Search" name="experience-search" search />
        <Chip on>Boat</Chip>
        <p>Airport transfer</p>
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
        <p className="hold-clock">29:59</p>
      </Frame>
      <Frame title="Damage hold">
        <p>
          Temporarily held <span className="amount">{formatAmount("AED", 500)}</span>
        </p>
      </Frame>
      <Frame title="Deposit">
        <Radio name="deposit-specimen" label="Deposit AED 315" defaultChecked />
        <Radio name="deposit-specimen" label="Pay in full AED 1,050" />
      </Frame>
      <Frame title="Newsletter">
        <p>Newsletter</p>
      </Frame>
      <Frame title="Airport meet">
        <p>Airport meet</p>
      </Frame>
      <Frame title="Home pickup">
        <p>Home pickup</p>
      </Frame>
      <Frame title="Driver assigned">
        <span className="status-chip">Driver assigned</span>
      </Frame>
      <Frame title="Flights booked">
        <span className="status-chip">Flights booked</span>
      </Frame>
    </>
  );
}
