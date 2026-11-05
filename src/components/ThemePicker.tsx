import { useEffect, useId, useRef } from 'react';
import { Check, ChevronDown, Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from '../lib/useTheme';

const options = [
  { value: 'light', label: 'Light Mode', Icon: Sun },
  { value: 'dark', label: 'Dark Mode', Icon: Moon },
  { value: 'system', label: 'System Default', Icon: Monitor },
] as const;

export function ThemePicker() {
  const [preference, setPreference] = useTheme();
  const id = useId();
  const picker = useRef<HTMLDetailsElement>(null);
  const trigger = useRef<HTMLElement>(null);
  const current = options.find((option) => option.value === preference)!;

  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      if (picker.current && !picker.current.contains(event.target as Node))
        picker.current.open = false;
    };
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, []);

  return (
    <details
      className="theme-picker"
      ref={picker}
      onBlur={(event) => {
        // Label presses can blur the summary with no destination before the
        // radio receives its click. Hiding it here would cancel that selection.
        // Only a known outside focus target dismisses; outside pointer presses
        // are already handled by closeOutside.
        if (
          event.relatedTarget &&
          !event.currentTarget.contains(event.relatedTarget)
        )
          event.currentTarget.open = false;
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && picker.current?.open) {
          event.preventDefault();
          event.stopPropagation();
          picker.current.open = false;
          trigger.current?.focus();
        }
      }}
    >
      <summary
        ref={trigger}
        aria-label={`Appearance: ${current.label}`}
        title={`Appearance: ${current.label}`}
      >
        <current.Icon size={16} aria-hidden="true" />
        <span>{current.label}</span>
        <ChevronDown
          size={13}
          className="theme-chevron"
          aria-hidden="true"
        />
      </summary>
      <div className="theme-popover">
        <fieldset>
          <legend>Appearance</legend>
          {options.map(({ value, label, Icon }) => (
            <label
              className={`theme-option ${preference === value ? 'is-selected' : ''}`}
              key={value}
            >
              <input
                type="radio"
                name={`${id}-appearance`}
                value={value}
                checked={preference === value}
                onChange={() => {
                  setPreference(value);
                  if (picker.current) picker.current.open = false;
                  trigger.current?.focus();
                }}
              />
              <Icon size={17} aria-hidden="true" />
              <span>{label}</span>
              {preference === value && (
                <Check size={15} aria-hidden="true" />
              )}
            </label>
          ))}
        </fieldset>
      </div>
    </details>
  );
}
