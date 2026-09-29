import type { ReactNode, SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & {
  size?: 16 | 20 | 24;
  title?: string;
};

function Icon({
  size = 24,
  title,
  children,
  ...rest
}: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      aria-label={title}
      {...rest}
    >
      {children}
    </svg>
  );
}

export function CameraIcon(props: IconProps) {
  return (
    <Icon fill="currentColor" {...props}>
      <path
        fillRule="evenodd"
        d="M8 7.2h1.2L10 5.5h4l.8 1.7H16a2 2 0 0 1 2 2v7.2a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V9.2a2 2 0 0 1 2-2zm4 2.2a3.2 3.2 0 1 0 .01 6.4A3.2 3.2 0 0 0 12 9.4zM16.2 9.2h1.2a.6.6 0 0 1 0 1.2h-1.2a.6.6 0 0 1 0-1.2z"
      />
    </Icon>
  );
}

export function LuggageIcon(props: IconProps) {
  return (
    <Icon fill="currentColor" {...props}>
      <path d="M9 6.2V4.8A1.2 1.2 0 0 1 10.2 3.6h3.6A1.2 1.2 0 0 1 15 4.8v1.4h1.2A1.8 1.8 0 0 1 18 8v9.2a1.8 1.8 0 0 1-1.8 1.8H7.8A1.8 1.8 0 0 1 6 17.2V8a1.8 1.8 0 0 1 1.8-1.8H9zm1.2-1.2v1.2h3.6V5H10.2zM8.4 9.2v7.2h1.1V9.2H8.4zm3 0v7.2h1.2V9.2h-1.2zm3.1 0v7.2H15.6V9.2h-1.1zM8.2 19.6a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm7.6 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2z" />
    </Icon>
  );
}

export function VipIcon(props: IconProps) {
  return (
    <Icon fill="currentColor" {...props}>
      <path
        fillRule="evenodd"
        d="M9 3.5a4.2 4.2 0 0 1 4.2 4.2V9H16a2 2 0 0 1 2 2v7.2A2 2 0 0 1 16 20.2H8a2 2 0 0 1-2-2V11a2 2 0 0 1 2-2h.8V7.7A4.2 4.2 0 0 1 9 3.5zm0 1.6a2.6 2.6 0 0 0-2.6 2.6V9h2.6V7.7A2.6 2.6 0 0 0 9 5.1zM8.6 13.2h1.3v3.4H8.6v-3.4zm2.2 0h1.5l.8 2.1.8-2.1h1.4l-1.5 3.4h-1.4l-1.6-3.4zm5.2 0h1.3v3.4h-1.3v-3.4z"
      />
    </Icon>
  );
}

export function YachtIcon(props: IconProps) {
  return (
    <Icon fill="currentColor" {...props}>
      <path d="M8 9.2 14.2 7.4 16 9.2H8zm-1.2 1.4h10.4l1.6 1.6H6.2l.6-1.6zm-2 3.2h16.2l-1.2 1.4H4.2l.6-1.4zM3.2 16.2c1.2.8 2.2.8 3.4 0s2.2-.8 3.4 0 2.2.8 3.4 0 2.2-.8 3.4 0 2-.8 3.2 0v1.2c-1.2-.6-2-.6-3.2 0s-2 .6-3.2 0-2-.6-3.2 0-2 .6-3.4 0-2.2-.6-3.4 0-2 .6-3.2 0v-1.2z" />
    </Icon>
  );
}

export function CheersIcon(props: IconProps) {
  return (
    <Icon fill="currentColor" {...props}>
      <path d="M11.2 3.2 10.4 5h1.1L11.2 3.2zm1.6.4.6 1.6h1.1l-.8-1.6h-.9zm-3.2.6.7 1.6h1.1l-.8-1.6h-1zM7.2 7.2 9.4 8.6 8.2 14.2 6.4 16.8 5.2 16.4 7.2 7.2zm9.6 0 2 9.2-1.2.4-1.8-2.6-1.2-5.6 2.2-1.4zM6.2 17.6h3.2v1.2H6.2v-1.2zm8.4 0h3.2v1.2h-3.2v-1.2z" />
    </Icon>
  );
}

export function PalmIcon(props: IconProps) {
  return (
    <Icon fill="currentColor" {...props}>
      <path d="M12 10.2c-2.4-3.2-5.6-4.2-8.2-3.2 2.2 1.6 3.6 3.4 4.2 5.4-2.8.2-5.2 1.4-6.8 3.2 3 .2 5.4-.6 7.2-2 .2 2.8-.2 5.2-1.4 7.2 1.6-1.8 2.8-4.4 3-7.2.2 2.8 1.4 5.4 3 7.2-1.2-2-1.6-4.4-1.4-7.2 1.8 1.4 4.2 2.2 7.2 2-1.6-1.8-4-3-6.8-3.2.6-2 2-3.8 4.2-5.4-2.6-1-5.8 0-8.2 3.2zM11.2 13.2h1.6V21h-1.6v-7.8zM10.4 21.2h3.2v1.2h-3.2v-1.2z" />
    </Icon>
  );
}

export function GuestIcon(props: IconProps) {
  return (
    <Icon fill="currentColor" {...props}>
      <path d="M12 4.2a3.2 3.2 0 1 1 0 6.4 3.2 3.2 0 0 1 0-6.4zM5.2 18.8a6.8 6.8 0 0 1 13.6 0v1H5.2v-1z" />
    </Icon>
  );
}

export function PlaneIcon(props: IconProps) {
  return (
    <Icon fill="currentColor" {...props}>
      <path d="M3.2 13.2 10 11.2 14.8 4.8c.6-.8 1.8-.6 2.2.2l2.2 4.6c.2.6 0 1.2-.6 1.4L14 12.6l1.6 5.2-1.8 1-2.4-4.6-3.2 1.2-.8-1.6 2.6-1.6-6.8-1z" />
    </Icon>
  );
}

export function StayIcon(props: IconProps) {
  return (
    <Icon fill="currentColor" {...props}>
      <path
        fillRule="evenodd"
        d="M4 10.2 12 5.2l8 5v1.2H4v-1.2zm1.2 2.2h2.2v6.4H5.2v-6.4zm11.4 0h2.2v6.4h-2.2v-6.4zM9.2 12.4h5.6v6.4H9.2v-6.4zm1.2 1.4v3.6h3.2v-3.6h-3.2zM8.2 8.6h1.4v1.6H8.2V8.6zm3.1 0h1.4v1.6h-1.4V8.6zm3.1 0H16v1.6h-1.6V8.6z"
      />
    </Icon>
  );
}

export function PinIcon(props: IconProps) {
  return (
    <Icon fill="currentColor" {...props}>
      <path
        fillRule="evenodd"
        d="M12 3.2a5.2 5.2 0 0 1 5.2 5.2c0 3.6-5.2 9.4-5.2 9.4S6.8 12 6.8 8.4A5.2 5.2 0 0 1 12 3.2zm0 2.4a2.2 2.2 0 1 0 0 4.4 2.2 2.2 0 0 0 0-4.4zM6.4 18.6h11.2v1.6H6.4v-1.6z"
      />
    </Icon>
  );
}

export function CarIcon(props: IconProps) {
  return (
    <Icon fill="currentColor" {...props}>
      <path
        fillRule="evenodd"
        d="M5.2 11.2 6.8 7.6A2 2 0 0 1 8.6 6.4h6.8a2 2 0 0 1 1.8 1.2l1.6 3.6H20v5.2h-1.6v1.6H16v-1.6H8v1.6H5.6v-1.6H4v-5.2h1.2zm2.2-3.2 1 2.8h7.2l1-2.8H7.4zM7.2 13.2a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm9.6 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2z"
      />
    </Icon>
  );
}

export function ShieldIcon(props: IconProps) {
  return (
    <Icon fill="currentColor" {...props}>
      <path
        fillRule="evenodd"
        d="M12 3.2 19 6v5.2c0 4.2-2.8 7.2-7 8.8-4.2-1.6-7-4.6-7-8.8V6l7-2.8zm-1.2 9.2-2-2 1.1-1.1 1.9 1.9 3.6-3.6 1.1 1.1-4.7 4.7z"
      />
    </Icon>
  );
}

export function LotusIcon(props: IconProps) {
  return (
    <Icon fill="currentColor" {...props}>
      <path d="M12 4.2c.8 2.4.8 4.6 0 6.8 1.6-1.2 3.4-1.6 5.4-.8-1.6 1.2-2.4 2.8-2.4 4.8 2-.4 3.8.2 5.4 1.6-2.2.4-4 .2-5.6-.6-.2 2 .2 3.8 1.2 5.4-1.8-1.2-3-2.8-3.6-4.8-.6 2-1.8 3.6-3.6 4.8 1-1.6 1.4-3.4 1.2-5.4-1.6.8-3.4 1-5.6.6 1.6-1.4 3.4-2 5.4-1.6 0-2-.8-3.6-2.4-4.8 2-.8 3.8-.4 5.4.8-.8-2.2-.8-4.4 0-6.8z" />
    </Icon>
  );
}

export function HeadsetIcon(props: IconProps) {
  return (
    <Icon fill="currentColor" {...props}>
      <path d="M6.4 11.2a5.6 5.6 0 0 1 11.2 0H16a3.2 3.2 0 0 0-6.2-1.2H8.2A4.4 4.4 0 0 0 4 14.4v.8h2.4v-4zm11.2 0V16h2.4v-.8a4.4 4.4 0 0 0-2.4-4zM5.2 14.2h2.4v4.2H6.4a1.2 1.2 0 0 1-1.2-1.2v-3zm11.2 0h2.4v3a1.2 1.2 0 0 1-1.2 1.2h-1.2v-4.2zM13.2 18.4a2 2 0 0 1-2.4 1.6 2 2 0 0 1-1.2-2.2h1.2a.8.8 0 0 0 1.4.4l1 .2z" />
    </Icon>
  );
}

export function ChevronIcon(props: IconProps) {
  return (
    <Icon fill="none" stroke="currentColor" strokeWidth={1.5} {...props}>
      <path d="M9 6.5 14.5 12 9 17.5" />
    </Icon>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <Icon fill="none" stroke="currentColor" strokeWidth={1.5} {...props}>
      <path d="M6.5 6.5 17.5 17.5M17.5 6.5 6.5 17.5" />
    </Icon>
  );
}

export function EyeIcon(props: IconProps) {
  return (
    <Icon fill="none" stroke="currentColor" strokeWidth={1.5} {...props}>
      <path d="M2.8 12S6 6.8 12 6.8 21.2 12 21.2 12 18 17.2 12 17.2 2.8 12 2.8 12z" />
      <rect x="9.8" y="9.8" width="4.4" height="4.4" />
    </Icon>
  );
}

export function LockIcon(props: IconProps) {
  return (
    <Icon fill="none" stroke="currentColor" strokeWidth={1.5} {...props}>
      <rect x="6" y="10.5" width="12" height="8.5" />
      <path d="M8.5 10.5V8.2a3.5 3.5 0 0 1 7 0v2.3" />
    </Icon>
  );
}

export function HeartIcon(props: IconProps) {
  return (
    <Icon fill="currentColor" {...props}>
      <path d="M12 19.2s-6.4-3.8-6.4-8.2A3.4 3.4 0 0 1 12 8.6a3.4 3.4 0 0 1 6.4 2.4c0 4.4-6.4 8.2-6.4 8.2z" />
    </Icon>
  );
}

export function WhatsAppIcon(props: IconProps) {
  return (
    <Icon fill="none" stroke="currentColor" strokeWidth={1.5} {...props}>
      <path d="M12 4.5a7.5 7.5 0 0 0-6.5 11.2L4.5 19.5l3.9-1A7.5 7.5 0 1 0 12 4.5z" />
      <path
        fill="currentColor"
        stroke="none"
        d="M9 9.3c0-.4.4-.7.8-.7h.6c.3 0 .6.2.7.5l.5 1.3c.1.3 0 .6-.2.8l-.6.6c.4 1 1.2 1.8 2.2 2.2l.6-.6c.2-.2.5-.3.8-.2l1.3.5c.3.1.5.4.5.7v.6c0 .4-.3.8-.7.8-3 .2-6-2.8-5.8-5.8z"
      />
    </Icon>
  );
}

export function SpinnerIcon(props: IconProps) {
  return (
    <Icon fill="none" stroke="currentColor" strokeWidth={1.5} className="ui-spinner" {...props}>
      <path d="M12 4.5a7.5 7.5 0 1 1-6.4 3.6" />
    </Icon>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <Icon fill="none" stroke="currentColor" strokeWidth={1.5} {...props}>
      <path d="M5.5 12.5 10 17 18.5 7.5" />
    </Icon>
  );
}

export function AlertCircleIcon(props: IconProps) {
  return (
    <Icon fill="none" stroke="currentColor" strokeWidth={1.5} {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5v5.5M12 15.8v.7" />
    </Icon>
  );
}

export function MailIcon(props: IconProps) {
  return (
    <Icon fill="none" stroke="currentColor" strokeWidth={1.5} {...props}>
      <rect x="3.5" y="6" width="17" height="12" />
      <path d="m3.5 7 8.5 6.5L20.5 7" />
    </Icon>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <Icon fill="none" stroke="currentColor" strokeWidth={1.5} {...props}>
      <circle cx="10.5" cy="10.5" r="6" />
      <path d="m15 15 5 5" />
    </Icon>
  );
}

export function ArrowIcon(props: IconProps) {
  return (
    <Icon fill="none" stroke="currentColor" strokeWidth={1.5} {...props}>
      <path d="M4.5 12h15M13.5 6l6 6-6 6" />
    </Icon>
  );
}
