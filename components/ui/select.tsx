"use client";

import { Select } from "radix-ui";
import { ChevronIcon } from "../icons/icons";

const DESTINATIONS = ["Cartagena", "Medellín", "Bogotá", "San Andrés", "Cocora Valley"] as const;

export function DestinationSelect() {
  return (
    <Select.Root>
      <Select.Trigger className="ui-select" aria-label="Where">
        <Select.Value placeholder="Where" />
        <Select.Icon className="ui-select-icon">
          <ChevronIcon size={16} />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content className="overlay-panel" position="popper">
          <Select.Viewport>
            {DESTINATIONS.map((name) => (
              <Select.Item key={name} value={name} className="ui-select-item">
                <Select.ItemText>{name}</Select.ItemText>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}

export function OptionSelect({
  label,
  options,
  value,
}: {
  label: string;
  options: readonly string[];
  value?: string;
}) {
  return (
    <Select.Root defaultValue={value ?? options[0]}>
      <Select.Trigger className="ui-select" aria-label={label}>
        <Select.Value />
        <Select.Icon className="ui-select-icon">
          <ChevronIcon size={16} />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content className="overlay-panel" position="popper">
          <Select.Viewport>
            {options.map((name) => (
              <Select.Item key={name} value={name} className="ui-select-item">
                <Select.ItemText>{name}</Select.ItemText>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}

export function EmptySelect() {
  return (
    <div className="empty-select">
      <Select.Root>
        <Select.Trigger className="ui-select" aria-label="Empty list">
          <Select.Value placeholder="Choose" />
          <Select.Icon className="ui-select-icon">
            <ChevronIcon size={16} />
          </Select.Icon>
        </Select.Trigger>
        <Select.Portal>
          <Select.Content className="overlay-panel">
            <p className="ui-select-empty">No options to show</p>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
    </div>
  );
}
