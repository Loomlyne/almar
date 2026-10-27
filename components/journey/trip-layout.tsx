import type { ReactNode } from "react";
import { StepRail, type StepNumber } from "./step-rail";
import type { JourneyCopy } from "./types";

// Plan 04-03 (signed 2026-10-25): the frame of /booking/trip. The title, the StepRail (rail from md, the phone bars
// below), the step in the main column and the cart beside it from md (the cart's own sticky rail). Below md, steps 1-3
// show the cart as its pinned dock, whose Continue replaces the step's own; on step 4 the cart sits in the page flow.
// The page and the harness scenes both use it, so the pictures are the page.

export type TripLayoutProps = {
  title: string;
  step: StepNumber;
  /** The StepRail's Change on a finished step. */
  onStepChange?: (step: StepNumber) => void;
  copy: JourneyCopy;
  children: ReactNode;
  /** The cart for the side rail (from md) and, on step 4, the page flow below md. */
  cart: ReactNode;
  /** The cart's phone dock (steps 1-3); absent on step 4. */
  cartDock?: ReactNode;
};

export function TripLayout({ title, step, onStepChange, copy, children, cart, cartDock }: TripLayoutProps) {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="m-0 font-display text-heading text-teal">{title}</h1>
      <StepRail current={step} onChange={onStepChange} copy={copy} className="hidden md:grid" />
      <StepRail current={step} copy={copy} layout="phone" className="md:hidden" />
      <div className="flex flex-col gap-8 md:flex-row md:items-start">
        <div className="min-w-0 flex-1">{children}</div>
        <div className={cartDock ? "hidden md:block md:shrink-0" : "w-full md:w-auto md:shrink-0"}>{cart}</div>
      </div>
      {cartDock ? (
        <div className="md:hidden">
          <div aria-hidden="true" className="h-dock" />
          {cartDock}
        </div>
      ) : null}
    </div>
  );
}
