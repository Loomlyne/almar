"use client";

import type { ReactNode } from "react";
import { Select } from "radix-ui";
import { ChevronIcon } from "../icons/icons";

const DESTINATIONS = ["Cartagena", "Medellín", "Bogotá", "San Andrés", "Cocora Valley"] as const;

function SelectMenu({ children, attached = false }: { children: ReactNode; attached?: boolean }) {
  return (
    <Select.Portal>
      <Select.Content
        className={attached ? "overlay-panel ui-select-menu ui-select-attached" : "overlay-panel ui-select-menu"}
        position="popper"
        side="bottom"
        align="start"
        sideOffset={attached ? 0 : 4}
        avoidCollisions={!attached}
        collisionPadding={attached ? 0 : undefined}
      >
        <Select.Viewport>{children}</Select.Viewport>
      </Select.Content>
    </Select.Portal>
  );
}

export function DestinationSelect({
  invalid = false,
  describedBy,
  value,
  boxed = false,
}: {
  invalid?: boolean;
  describedBy?: string;
  value?: string;
  boxed?: boolean;
} = {}) {
  return (
    <Select.Root defaultValue={value}>
      <Select.Trigger
        className={boxed ? "ui-select ui-select-boxed" : "ui-select"}
        aria-label="Where"
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
      >
        <Select.Value placeholder="Select a destination" />
        <Select.Icon className="ui-select-icon">
          <ChevronIcon size={16} />
        </Select.Icon>
      </Select.Trigger>
      <SelectMenu attached>
        {DESTINATIONS.map((name) => (
          <Select.Item key={name} value={name} className="ui-select-item">
            <Select.ItemText>{name}</Select.ItemText>
          </Select.Item>
        ))}
      </SelectMenu>
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

export function EmptySelect({
  invalid = false,
  describedBy,
}: {
  invalid?: boolean;
  describedBy?: string;
} = {}) {
  return (
    <Select.Root>
      <Select.Trigger
        className="ui-select ui-select-boxed"
        aria-label="Empty list"
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
      >
        <Select.Value placeholder="Choose" />
        <Select.Icon className="ui-select-icon">
          <ChevronIcon size={16} />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content className="overlay-panel ui-select-menu">
          <p className="ui-select-empty">No options to show</p>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}

export function SelectSpecimen() {
  return (
    <div className="ui-select-specimen">
      <div className="ui-select-field">
        <span className="field-label">Where</span>
        <div className="ui-select-stack">
          <DestinationSelect value="Cartagena" />
          <div className="ui-select-menu ui-select-preview" aria-hidden="true">
            {DESTINATIONS.map((name) => (
              <div key={name} className={name === "Cartagena" ? "ui-select-item is-current" : "ui-select-item"}>
                {name}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="ui-select-field">
        <span className="field-label">Choose</span>
        <EmptySelect invalid describedBy="select-choose-error" />
        <p id="select-choose-error" className="field-error ui-select-error">
          Choose a destination.
        </p>
      </div>
    </div>
  );
}
