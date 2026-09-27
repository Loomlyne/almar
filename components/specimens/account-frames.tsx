"use client";

import type { ReactNode } from "react";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { Field } from "../ui/field";

function Frame({ title, children }: { title: string; children: ReactNode }) {
  const id = title.toLowerCase().replaceAll(" ", "-");
  return (
    <section className="kit-section" id={id} aria-label={title}>
      <header className="kit-head">
        <h2>{title}</h2>
      </header>
      {children}
    </section>
  );
}

export function AccountFrames() {
  return (
    <>
      <Frame title="Sign-in">
        <Field id="sign-in-email" label="Email" name="sign-in-email" />
        <Button variant="primary" type="button">
          Sign in
        </Button>
      </Frame>
      <Frame title="Ops sign-in">
        <Field id="ops-email" label="Email" name="ops-email" />
        <Button variant="primary" type="button">
          Sign in
        </Button>
      </Frame>
      <Frame title="Account menu">
        <nav className="account-menu" aria-label="Account">
          <ul>
            <li>
              <a href="#booking-list">Bookings</a>
            </li>
            <li>
              <a href="#account">Account</a>
            </li>
          </ul>
          <Button variant="ghost" type="button" className="account-menu-sign-out">
            Sign out
          </Button>
        </nav>
      </Frame>
      <Frame title="Account">
        <Field id="account-name" label="Name" name="account-name" />
        <Field id="account-email" label="Email" name="account-email" />
        <Field id="account-phone" label="Phone" name="account-phone" />
        <Button variant="primary" type="button">
          Save
        </Button>
      </Frame>
      <Frame title="Change email">
        <Field id="change-email" label="Email" name="change-email" />
        <Button variant="primary" type="button">
          Save
        </Button>
        <p>Check your email.</p>
      </Frame>
      <Frame title="Change phone">
        <Field id="change-phone" label="Phone" name="change-phone" />
        <Button variant="primary" type="button">
          Save
        </Button>
      </Frame>
      <Frame title="Reset password">
        <Field id="new-password" label="New password" name="new-password" type="password" />
        <Field id="confirm-password" label="Confirm password" name="confirm-password" type="password" />
        <Button variant="primary" type="button">
          Save
        </Button>
      </Frame>
      <Frame title="Forgot password">
        <Field id="forgot-email" label="Email" name="forgot-email" />
        <p>Sent. No link on screen.</p>
      </Frame>
      <Frame title="Check your email">
        <p>Check your email.</p>
        <Button variant="secondary" type="button">
          Resend
        </Button>
      </Frame>
      <Frame title="Sign out">
        <p>Sign out of this account? You will need to sign in again to open bookings.</p>
        <div className="sign-out-actions">
          <Button variant="danger" type="button">
            Sign out
          </Button>
          <Button variant="secondary" type="button">
            Cancel
          </Button>
        </div>
      </Frame>
      <Frame title="Delete account">
        <Button variant="danger" type="button">
          Delete account
        </Button>
        <Button variant="secondary" type="button">
          Cancel
        </Button>
      </Frame>
      <Frame title="Cancel booking">
        <Button variant="danger" type="button">
          Cancel booking
        </Button>
        <Button variant="secondary" type="button">
          Cancel
        </Button>
      </Frame>
      <Frame title="Session expired">
        <p>This session has ended.</p>
        <Button variant="primary" type="button">
          Sign in
        </Button>
      </Frame>
      <Frame title="Booking terms">
        <Checkbox label="I accept the booking terms" required />
        <a href="#booking-terms">booking terms</a>
      </Frame>
      <Frame title="Marketing emails">
        <Checkbox label="Send marketing emails" />
      </Frame>
      <Frame title="Booker not staying">
        <Checkbox label="I am not staying" />
      </Frame>
      <Frame title="Guest names">
        <Field id="adult-1-first" label="Adult 1 first name" name="adult-1-first" required />
        <Field id="adult-1-last" label="Adult 1 last name" name="adult-1-last" required />
      </Frame>
      <Frame title="Passport">
        <p>Upload file</p>
      </Frame>
      <Frame title="UAE airport">
        <Checkbox name="airport" label="Dubai" defaultChecked />
        <Checkbox name="airport" label="Abu Dhabi" />
        <Checkbox name="airport" label="Sharjah" />
      </Frame>
      <Frame title="Saved card">
        <p>Visa · 4242</p>
        <Button variant="ghost" type="button">
          Change
        </Button>
      </Frame>
      <Frame title="Stripe">
        <Field id="card-number" label="Card number" name="card-number" />
        <Button variant="primary" type="button">
          Pay
        </Button>
      </Frame>
      <Frame title="Pay success">
        <p>Your trip is confirmed.</p>
        <p className="amount">ALMAR-104283</p>
      </Frame>
      <Frame title="Hold expired">
        <p>This hold has ended. Choose a stay to start again.</p>
        <Button variant="primary" type="button">
          Choose a stay
        </Button>
      </Frame>
      <Frame title="Create an account later">
        <a href="#account">Create an account later</a>
      </Frame>
      <Frame title="Pay the difference">
        <Button variant="primary" type="button">
          Pay the difference
        </Button>
      </Frame>
      <Frame title="Pay the remainder">
        <Button variant="primary" type="button">
          Pay the remainder
        </Button>
      </Frame>
      <Frame title="Currency on pay">
        <p>The hold restarts.</p>
        <p className="amount">AED 1,050</p>
      </Frame>
      <Frame title="Status">
        <div className="status-chip-list">
          <span className="status-chip is-draft">Draft</span>
          <span className="status-chip is-deposit-paid">Deposit paid</span>
          <span className="status-chip is-confirmed">Confirmed</span>
          <span className="status-chip is-in-trip">In trip</span>
          <span className="status-chip is-completed">Completed</span>
          <span className="status-chip is-cancelled">Cancelled</span>
          <span className="status-chip is-driver-assigned">Driver assigned</span>
          <span className="status-chip is-flights-booked">Flights booked</span>
        </div>
      </Frame>
      <Frame title="Booking header">
        <p>Cartagena, five nights</p>
        <p className="amount">ALMAR-104283</p>
        <span className="status-chip is-confirmed">Confirmed</span>
        <span className="hold-clock">29:59</span>
      </Frame>
      <Frame title="Booking list">
        <p>Cartagena</p>
        <p>23/09/2026 – 30/09/2026</p>
        <span className="status-chip is-confirmed">Confirmed</span>
        <p className="amount">ALMAR-104283</p>
      </Frame>
    </>
  );
}
