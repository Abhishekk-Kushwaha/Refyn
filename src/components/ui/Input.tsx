import { InputHTMLAttributes } from 'react';
import clsx from 'clsx';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  label?: string;
}

export const Input = ({ className, error, label, id, ...props }: InputProps) => {
  const inputId = id || `input-${Math.random()}`;

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm font-medium text-text-primary mb-2"
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={clsx(
          'w-full h-11 px-3 py-2 bg-surface border border-border rounded-md text-text-primary placeholder:text-text-muted',
          'focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent',
          'transition-all duration-200',
          error && 'border-danger focus:ring-danger',
          className
        )}
        {...props}
      />
      {error && (
        <p className="text-sm text-danger mt-1">{error}</p>
      )}
    </div>
  );
};

export const Textarea = ({ className, error, label, id, ...props }: InputHTMLAttributes<HTMLTextAreaElement> & { error?: string; label?: string }) => {
  const textareaId = id || `textarea-${Math.random()}`;

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={textareaId}
          className="block text-sm font-medium text-text-primary mb-2"
        >
          {label}
        </label>
      )}
      <textarea
        id={textareaId}
        className={clsx(
          'w-full px-3 py-2 bg-surface border border-border rounded-md text-text-primary placeholder:text-text-muted',
          'focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent',
          'transition-all duration-200 min-h-24 resize-none',
          error && 'border-danger focus:ring-danger',
          className
        )}
        {...props}
      />
      {error && (
        <p className="text-sm text-danger mt-1">{error}</p>
      )}
    </div>
  );
};
