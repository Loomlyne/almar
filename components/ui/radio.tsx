import type { InputHTMLAttributes, ReactNode } from "react";

type RadioProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: ReactNode;
};

export function Radio({ label, className = "", ...rest }: RadioProps) {
  return (
    <label className={`choice ${className}`}>
      <input type="radio" className="choice-input" {...rest} />
      <span className="choice-mark choice-mark-round" aria-hidden="true" />
      <span>{label}</span>
    </label>
  );
}
