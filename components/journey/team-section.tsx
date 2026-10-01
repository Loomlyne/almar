import { useId } from "react";
import { MailIcon } from "../icons/icons";
import { Link } from "../ui/link";
import monogram from "../../brand/Logo Monogram/Curves_black.svg";
import type { TeamMember } from "./types";

export type TeamSectionProps = {
  /** Published members from Dashboard > Content > Team. Zero members renders nothing (D-55). */
  members: TeamMember[];
  title: string;
  /** Canvas and harness only: text-only cards with a monogram block instead of a photo (D-57). */
  placeholder?: boolean;
};

/** Meet-the-team grid. Data in, cards out; no social links (D-55, D-24). */
export function TeamSection({ members, title, placeholder = false }: TeamSectionProps) {
  const headId = useId();
  if (members.length === 0) return null;
  const mark = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(monogram)}`;

  return (
    <section aria-labelledby={headId} className="flex flex-col gap-8">
      <h2 id={headId} className="m-0 font-display text-heading text-teal text-balance">
        {title}
      </h2>
      <ul className="m-0 p-0 list-none grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {members.map((m) => (
          <li key={m.id} className="flex flex-col gap-6 max-w-md">
            {placeholder || !m.photo ? (
              <div
                data-team-placeholder=""
                className="bg-teal-tint aspect-2/3 flex items-center justify-center"
              >
                <img src={mark} alt="" className="block h-auto w-32 opacity-40" width={128} height={70} />
              </div>
            ) : (
              <img
                src={m.photo.src}
                alt={m.photo.alt}
                loading="lazy"
                className="w-full aspect-2/3 object-cover outline outline-1 -outline-offset-1 outline-ink/10"
              />
            )}
            <div className="flex flex-col gap-1">
              <h3 className="m-0 font-display text-title text-teal">{m.name}</h3>
              <p className="m-0 text-caption uppercase tracking-kicker ar:normal-case ar:tracking-normal text-muted">
                {m.role}
              </p>
              {m.email ? (
                <Link href={`mailto:${m.email}`} className="gap-2 text-label w-max">
                  <MailIcon size={16} className="shrink-0" />
                  {m.email}
                </Link>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
