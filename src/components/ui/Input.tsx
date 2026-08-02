import { InputHTMLAttributes, TextareaHTMLAttributes, useId } from 'react';
import clsx from 'clsx';

/**
 * Field styling is shared so an <Input> and a <Textarea> sitting in the same
 * form never differ by a pixel.
 *
 * The focus treatment moved from `focus:` to `focus-visible:` and from a
 * ring-plus-transparent-border to a solid accent border with a soft halo — the
 * old version collapsed the border to transparent on focus, which made the
 * field jump.
 */
const fieldClasses = [
  'w-full rounded-lg border border-border bg-surface-raised px-3.5 py-2.5',
  'font-body text-sm text-text-primary placeholder:text-text-faint',
  'transition-[border-color,box-shadow,background] duration-150',
  'hover:border-border-strong',
  'focus-visible:border-accent focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/15',
  'disabled:cursor-not-allowed disabled:opacity-50',
];

const labelClasses =
  'mb-2 block font-body text-[0.8125rem] font-semibold text-text-primary';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  label?: string;
}

export const Input = ({ className, error, label, id, ...props }: InputProps) => {
  // useId is stable across renders. `Math.random()` regenerated the id on every
  // render, so the label's htmlFor pointed at an element that no longer existed.
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className={labelClasses}>
          {label}
        </label>
      )}
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={clsx(
          fieldClasses,
          'h-11',
          error && 'border-danger focus-visible:border-danger focus-visible:ring-danger/15',
          className
        )}
        {...props}
      />
      {error && (
        <p id={errorId} className="mt-1.5 font-body text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
};

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string;
  label?: string;
}

export const Textarea = ({ className, error, label, id, ...props }: TextareaProps) => {
  const generatedId = useId();
  const textareaId = id ?? generatedId;
  const errorId = `${textareaId}-error`;

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={textareaId} className={labelClasses}>
          {label}
        </label>
      )}
      <textarea
        id={textareaId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={clsx(
          fieldClasses,
          'min-h-28 resize-y leading-relaxed',
          error && 'border-danger focus-visible:border-danger focus-visible:ring-danger/15',
          className
        )}
        {...props}
      />
      {error && (
        <p id={errorId} className="mt-1.5 font-body text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
};
