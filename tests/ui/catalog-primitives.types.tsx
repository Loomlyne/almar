// tsc-only contract for the slice 2 primitives (plan 03.3-11). Not matched by Playwright or node --test:
// `npx tsc --noEmit` compiles it, and an unused @ts-expect-error is itself an error, so each line below
// pins a combination the types must refuse. Nothing here runs.
import { useRef } from "react";
import { MediaCard } from "../../components/ui/card";
import { Dialog } from "../../components/ui/dialog";
import { ChipGroup } from "../../components/ui/chip-group";
import { Chip } from "../../components/ui/chip";
import { CheckboxGroup } from "../../components/ui/checkbox-group";
import { CountBadge } from "../../components/ui/count-badge";

const image = { src: "/x.webp", alt: "x" };

export function Valid() {
  const cardRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      <MediaCard image={image} title="t" onOpen={() => undefined} openRef={cardRef} />
      <MediaCard image={image} title="t" href="/x" />
      <Dialog
        size="detail"
        title="t"
        closeLabel="c"
        media={<img src="/x.webp" alt="x" />}
        kicker="k"
        returnFocusRef={cardRef}
      />
      <ChipGroup orientation="vertical" label="l" options={[]} value="" onChange={() => undefined} />
      <Chip onRemove={() => undefined} removeLabel="Remove x: x">
        x
      </Chip>
      <CheckboxGroup legend="l" options={[]} value={[]} onChange={() => undefined} />
      <CountBadge count={2} />
      <CountBadge count={2} label="2 filters on" />
    </>
  );
}

export function Refused() {
  const cardRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      {/* @ts-expect-error href and onOpen together */}
      <MediaCard image={image} title="t" href="/x" onOpen={() => undefined} />
      {/* @ts-expect-error openRef without onOpen */}
      <MediaCard image={image} title="t" openRef={cardRef} />
      {/* @ts-expect-error onRemove without removeLabel */}
      <Chip onRemove={() => undefined}>x</Chip>
      {/* @ts-expect-error onRemove with on */}
      <Chip on onRemove={() => undefined} removeLabel="r">
        x
      </Chip>
      {/* @ts-expect-error unknown orientation */}
      <ChipGroup orientation="diagonal" label="l" options={[]} value="" onChange={() => undefined} />
      {/* @ts-expect-error unknown size */}
      <Dialog size="huge" title="t" closeLabel="c" />
    </>
  );
}
