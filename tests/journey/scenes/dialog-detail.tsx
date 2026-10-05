"use client";

import { useRef, useState } from "react";
import { MediaCard } from "../../../components/ui/card";
import { Dialog } from "../../../components/ui/dialog";
import type { Scenes } from "../scene-types";
import { IMAGES, harnessHref } from "./_images";

function Detail({
  locale,
  fromCard,
  openOnMount,
  media = true,
  paragraphs = 1,
  focusBefore,
}: {
  locale: string;
  fromCard?: boolean;
  openOnMount?: boolean;
  media?: boolean;
  paragraphs?: number;
  focusBefore?: boolean;
}) {
  const cardRef = useRef<HTMLButtonElement>(null);
  const beforeRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(Boolean(openOnMount));
  return (
    <div data-testid="harness-dialog-detail" className="mx-auto grid w-full max-w-menu gap-4 p-4">
      <button ref={beforeRef} type="button">
        [before]
      </button>
      {fromCard ? (
        <MediaCard
          image={IMAGES[0]}
          title="[Title]"
          detail="[Detail line]"
          onOpen={() => setOpen(true)}
          openRef={cardRef}
        />
      ) : null}
      <button type="button">[after]</button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        size="detail"
        title="[Title]"
        closeLabel="[Close]"
        kicker="[Experience · Place]"
        media={media ? <img src={IMAGES[0].src} alt="[Photo 1]" /> : undefined}
        returnFocusRef={focusBefore ? beforeRef : cardRef}
        footer={<a href={harnessHref(locale, "inquiry")}>[Request Inquiry]</a>}
      >
        {Array.from({ length: paragraphs }, (_, i) => (
          <p key={i}>{paragraphs === 1 ? "[Body text]" : `[Body line ${i + 1}]`}</p>
        ))}
      </Dialog>
    </div>
  );
}

export const scenes: Scenes = {
  "from-card": ({ locale }) => <Detail locale={locale} fromCard />,
  long: ({ locale }) => <Detail locale={locale} openOnMount paragraphs={40} focusBefore />,
  "no-media": ({ locale }) => <Detail locale={locale} openOnMount media={false} focusBefore />,
};
