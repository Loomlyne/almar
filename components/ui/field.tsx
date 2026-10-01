import { useState, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";
import { cn } from "../../lib/cn";
import { Button } from "./button";

const INPUT =
  "ui-input block min-h-control w-full rounded-none border border-ink bg-surface px-4 py-2 font-body text-body text-ink md:text-label aria-invalid:border-error focus-visible:border-teal focus-visible:shadow-selected focus-visible:outline-none";

type Shared = {
  id: string;
  label: string;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  optional?: boolean;
  search?: boolean;
  coupon?: boolean;
  onApply?: () => void;
};

type FieldProps = Shared &
  Omit<InputHTMLAttributes<HTMLInputElement>, "id"> & {
    multiline?: false;
  };

type AreaProps = Shared &
  Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id"> & {
    multiline: true;
  };

export function Field(props: FieldProps | AreaProps) {
  const {
    id,
    label,
    hint,
    error,
    required,
    optional,
    search,
    coupon,
    onApply,
    multiline,
  } = props;
  const message = error || hint;
  const messageId = message ? `${id}-message` : undefined;
  const describedBy = messageId;

  return (
    <div className="field grid max-w-96 gap-2">
      <label className="field-label text-label text-ink" htmlFor={id}>
        {label}
        {required ? (
          <span className="text-ink" aria-hidden="true">
            {" "}
            *
          </span>
        ) : null}
        {optional ? (
          <span className="text-muted"> optional</span>
        ) : null}
      </label>
      <div className={coupon ? "field-coupon flex w-full max-w-96 flex-nowrap items-stretch gap-2" : undefined}>
        <Control
          {...props}
          describedBy={describedBy}
          invalid={Boolean(error)}
          search={search}
        />
        {coupon ? (
          <Button variant="secondary" className="ui-button-inline self-stretch whitespace-nowrap" onClick={onApply}>
            Apply
          </Button>
        ) : null}
      </div>
      {message ? (
        <p
          id={messageId}
          className={cn("m-0 text-label", error ? "field-error text-error" : "field-hint text-ink")}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}

function Control({
  describedBy,
  invalid,
  search,
  multiline,
  coupon,
  onApply,
  label,
  hint,
  error,
  required,
  optional,
  id,
  ...rest
}: (FieldProps | AreaProps) & {
  describedBy?: string;
  invalid: boolean;
}) {
  if (multiline) {
    const areaProps = rest as TextareaHTMLAttributes<HTMLTextAreaElement>;
    return (
      <div className="field-control relative">
        <textarea
          id={id}
          className={cn(INPUT, "min-h-24 field-sizing-content resize-y")}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          required={required}
          {...areaProps}
        />
      </div>
    );
  }

  const inputProps = rest as InputHTMLAttributes<HTMLInputElement>;
  if (inputProps.type === "password") {
    return <PasswordControl id={id} describedBy={describedBy} invalid={invalid} required={required} {...inputProps} />;
  }

  return (
    <div className={cn("field-control relative", coupon && "flex min-w-0 flex-1 items-stretch")}>
      {search ? <SearchIcon /> : null}
      <input
        id={id}
        className={cn(INPUT, search && "ps-control")}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        required={required}
        {...inputProps}
      />
    </div>
  );
}

function PasswordControl({
  id,
  describedBy,
  invalid,
  required,
  ...inputProps
}: InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  describedBy?: string;
  invalid: boolean;
}) {
  const [shown, setShown] = useState(false);
  return (
    <div className="field-control is-password relative">
      <input
        id={id}
        className={cn(INPUT, "pe-12")}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        required={required}
        {...inputProps}
        type={shown ? "text" : "password"}
      />
      <button
        type="button"
        className="absolute inset-e-1 top-1/2 grid size-control -translate-y-1/2 place-items-center border-0 bg-transparent p-0 text-ink"
        aria-label={shown ? "Hide password" : "Show password"}
        onClick={() => setShown((value) => !value)}
      >
        <EyeIcon masked={!shown} />
      </button>
    </div>
  );
}

function EyeIcon({ masked }: { masked: boolean }) {
  return (
    <svg
      className="size-5"
      viewBox="0 0 20 20"
      width="20"
      height="20"
      aria-hidden="true"
      fill="none"
    >
      <path
        d="M1.75 10S4.5 4.75 10 4.75 18.25 10 18.25 10 15.5 15.25 10 15.25 1.75 10 1.75 10Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <rect x="7.75" y="7.75" width="4.5" height="4.5" stroke="currentColor" strokeWidth="1.5" />
      {masked ? (
        <path
          d="M4 16 16 4"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      ) : null}
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg
      className="pointer-events-none absolute inset-s-3 top-1/2 size-5 -translate-y-1/2 text-ink"
      viewBox="0 0 20 20"
      width="20"
      height="20"
      aria-hidden="true"
      fill="none"
    >
      <rect x="3.75" y="3.75" width="9.5" height="9.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12.5 12.5 17 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
