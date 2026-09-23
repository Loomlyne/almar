import type { InputHTMLAttributes, ReactNode } from "react";

type ChoiceProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: ReactNode;
};

export function Checkbox({ label, className = "", ...rest }: ChoiceProps) {
  return (
    <label className={`choice ${className}`}>
      <input type="checkbox" className="choice-input" {...rest} />
      <span className="choice-mark" aria-hidden="true" />
      <span>{label}</span>
    </label>
  );
}
