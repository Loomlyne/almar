import { useState, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";

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
    <div className="field">
      <label className="field-label" htmlFor={id}>
        {label}
        {required ? (
          <span className="text-[var(--color-fg)]" aria-hidden="true">
            {" "}
            *
          </span>
        ) : null}
        {optional ? (
          <span className="text-[var(--color-muted-fg)]"> optional</span>
        ) : null}
      </label>
      <div className={coupon ? "field-coupon" : undefined}>
        <Control
          {...props}
          describedBy={describedBy}
          invalid={Boolean(error)}
          search={search}
        />
        {coupon ? (
          <button type="button" className="ui-button ui-button-inline bg-transparent text-[var(--color-link)] border-[var(--color-heading)]" onClick={onApply}>
            Apply
          </button>
        ) : null}
      </div>
      {message ? (
        <p
          id={messageId}
          className={error ? "field-error text-[var(--color-danger)]" : "field-hint"}
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
      <div className="field-control">
        <textarea
          id={id}
          className="ui-input"
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
    <div className={`field-control${search ? " is-search" : ""}`}>
      {search ? <SearchIcon /> : null}
      <input
        id={id}
        className="ui-input"
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
    <div className="field-control is-password">
      <input
        id={id}
        className="ui-input"
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        required={required}
        {...inputProps}
        type={shown ? "text" : "password"}
      />
      <button
        type="button"
        className="eye inset-inline-end"
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
      className="eye-icon"
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
      <circle cx="10" cy="10" r="2.25" stroke="currentColor" strokeWidth="1.5" />
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
      className="field-icon"
      viewBox="0 0 20 20"
      width="20"
      height="20"
      aria-hidden="true"
      fill="none"
    >
      <circle cx="8.5" cy="8.5" r="4.75" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12.5 12.5 17 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
