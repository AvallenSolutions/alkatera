'use client';

import { cn } from '@/lib/utils';

interface MonoSwitchOption<T extends string> {
  value: T;
  label: string;
}

interface MonoSwitchProps<T extends string> {
  options: readonly MonoSwitchOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  /** Accessible name for the group, e.g. "View". */
  label?: string;
}

/**
 * Mono caps + a 3px rule, for switching a view that lives in local state.
 *
 * `MonoTabs` is the navigation form of the same idiom: it renders Links and
 * reads the pathname. Anything that only flips a piece of component state
 * (list against portfolio, archived shown or hidden) was hand-rolling this
 * markup instead, which is how the products list ended up with a bordered
 * button in leftover neon lime sitting beside two proper mono tabs.
 */
export function MonoSwitch<T extends string>({
  options,
  value,
  onChange,
  className,
  label,
}: MonoSwitchProps<T>) {
  return (
    <div className={cn('flex items-center gap-5', className)} role="group" aria-label={label}>
      {options.map((option) => {
        const isActive = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={isActive}
            className={cn(
              'relative whitespace-nowrap py-2 font-mono text-[10px] font-bold uppercase tracking-[0.22em] transition-opacity duration-150 ease-studio',
              isActive ? 'opacity-100' : 'opacity-60 hover:opacity-100',
            )}
          >
            {option.label}
            {isActive ? (
              <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-[3px] bg-room-accent" />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

interface MonoToggleProps {
  /** The word the control shows. It does not change with state; the rule does. */
  label: string;
  pressed: boolean;
  onChange: (pressed: boolean) => void;
  className?: string;
}

/** A single mono word that switches something on and off, same rule as the tabs. */
export function MonoToggle({ label, pressed, onChange, className }: MonoToggleProps) {
  return (
    <button
      type="button"
      onClick={() => onChange(!pressed)}
      aria-pressed={pressed}
      className={cn(
        'relative whitespace-nowrap py-2 font-mono text-[10px] font-bold uppercase tracking-[0.22em] transition-opacity duration-150 ease-studio',
        pressed ? 'opacity-100' : 'opacity-60 hover:opacity-100',
        className,
      )}
    >
      {label}
      {pressed ? (
        <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-[3px] bg-room-accent" />
      ) : null}
    </button>
  );
}
