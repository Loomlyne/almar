"use client";

import { Button } from "../ui/button";
import { DateRangeField } from "../ui/calendar";
import { DestinationSelect } from "../ui/select";
import { GuestSteppers } from "../ui/stepper";

export function HeroBooker() {
  return (
    <form className="hero-booker" onSubmit={(event) => event.preventDefault()}>
      <DestinationSelect />
      <DateRangeField />
      <GuestSteppers />
      <Button variant="secondary" type="submit">
        Search
      </Button>
    </form>
  );
}
