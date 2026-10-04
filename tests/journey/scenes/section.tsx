"use client";

import { Section, SectionHead } from "../../../components/ui/section";
import { Button } from "../../../components/ui/button";
import type { Scenes } from "../scene-types";

const INTRO = "[Intro text for the section, one or two sentences.]";

export const scenes: Scenes = {
  full: () => (
    <div data-testid="harness-section" className="p-4">
      <Section kicker="[Kicker]" heading="[Heading]" intro={INTRO}>
        <p className="m-0">[Section body]</p>
      </Section>
    </div>
  ),
  head: () => (
    <div data-testid="harness-section" className="p-4">
      <SectionHead kicker="[Kicker]" heading="[Heading]" headingLevel={3} intro={INTRO} />
    </div>
  ),
  action: () => (
    <div data-testid="harness-section" className="p-4">
      <SectionHead
        heading="[Heading]"
        action={<Button variant="secondary">[View all]</Button>}
      />
    </div>
  ),
};
