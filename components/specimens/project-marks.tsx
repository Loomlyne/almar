import type { SVGProps } from "react";

type MarkProps = SVGProps<SVGSVGElement>;

function Mark(props: MarkProps) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
      {props.children}
    </svg>
  );
}

export function BedMark() {
  return (
    <Mark>
      <path d="M4 17.5V12a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v5.5M4 17.5h16M7 10V8.5A1.5 1.5 0 0 1 8.5 7H11v3" />
    </Mark>
  );
}

export function GuestMark() {
  return (
    <Mark>
      <circle cx="12" cy="8" r="2.25" />
      <path d="M6.5 17.5a5.5 5.5 0 0 1 11 0" />
    </Mark>
  );
}

export function CalendarMark() {
  return (
    <Mark>
      <rect x="4.5" y="5.5" width="15" height="14" />
      <path d="M4.5 9.5h15M8 3.5v3M16 3.5v3" />
    </Mark>
  );
}

export function PlaneMark() {
  return (
    <Mark>
      <path d="M4 13.5 10.5 12 14 6.5c.4-.7 1.4-.5 1.6.3l1.6 3.4c.2.4 0 .9-.4 1.1L13.5 13l1.2 4-1.4.7-1.8-3.5-2.4.9-.6-1.2 2-1.2L4 13.5z" />
    </Mark>
  );
}

export function CarMark() {
  return (
    <Mark>
      <path d="M5 15.5h14l-1.2-4.2a1.5 1.5 0 0 0-1.4-1H7.6a1.5 1.5 0 0 0-1.4 1L5 15.5z" />
      <path d="M6.5 15.5v1.5M17.5 15.5v1.5M8 12.5h8" />
      <circle cx="8" cy="15.5" r="0.8" fill="currentColor" stroke="none" />
      <circle cx="16" cy="15.5" r="0.8" fill="currentColor" stroke="none" />
    </Mark>
  );
}

export function MeetMark() {
  return (
    <Mark>
      <circle cx="9" cy="8" r="2" />
      <circle cx="15.5" cy="8.5" r="1.6" />
      <path d="M4.5 17.5a4.5 4.5 0 0 1 9 0M13 17.5a3.6 3.6 0 0 1 6.2-2.4" />
    </Mark>
  );
}

export function MailMark() {
  return (
    <Mark>
      <rect x="3.5" y="6" width="17" height="12" />
      <path d="M4 7l8 6 8-6" />
    </Mark>
  );
}

export function FacebookMark() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path fill="currentColor" d="M14.5 8.5V6.8c0-.7.5-1 1.1-1H17V3.2h-1.8C12.8 3.2 12 4.6 12 6.6v1.9H10v2.6h2V21h2.5v-9.9h2.1l.4-2.6h-2.5z" />
    </svg>
  );
}

export function InstagramMark() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path fill="currentColor" d="M7.5 3h9A4.5 4.5 0 0 1 21 7.5v9a4.5 4.5 0 0 1-4.5 4.5h-9A4.5 4.5 0 0 1 3 16.5v-9A4.5 4.5 0 0 1 7.5 3zm9 1.8h-9A2.7 2.7 0 0 0 4.8 7.5v9a2.7 2.7 0 0 0 2.7 2.7h9a2.7 2.7 0 0 0 2.7-2.7v-9a2.7 2.7 0 0 0-2.7-2.7zM12 8.2A3.8 3.8 0 1 1 8.2 12 3.8 3.8 0 0 1 12 8.2zm0 1.6A2.2 2.2 0 1 0 14.2 12 2.2 2.2 0 0 0 12 9.8zM16.7 6.4a1 1 0 1 1-1 1 1 1 0 0 1 1-1z" />
    </svg>
  );
}

export function YouTubeMark() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path fill="currentColor" d="M22.5 7.2a2.8 2.8 0 0 0-2-2C18.8 4.8 12 4.8 12 4.8s-6.8 0-8.5.4a2.8 2.8 0 0 0-2 2A29 29 0 0 0 1.1 12a29 29 0 0 0 .4 4.8 2.8 2.8 0 0 0 2 2c1.7.4 8.5.4 8.5.4s6.8 0 8.5-.4a2.8 2.8 0 0 0 2-2 29 29 0 0 0 .4-4.8 29 29 0 0 0-.4-4.8zM9.8 15.1V8.9L15.5 12z" />
    </svg>
  );
}

export function TikTokMark() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path fill="currentColor" d="M14.2 3.2c.5 2.4 2 4.1 4.3 4.5v2.6a6.6 6.6 0 0 1-4.3-1.5v6.7a5.4 5.4 0 1 1-5.4-5.4c.3 0 .6 0 .9.1v2.8a2.6 2.6 0 1 0 1.8 2.5V3.2z" />
    </svg>
  );
}
