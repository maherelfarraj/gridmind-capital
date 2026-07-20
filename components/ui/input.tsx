'use client'

import * as React from 'react'
import { Field } from '@base-ui/react/field'
import { Input as InputPrimitive } from '@base-ui/react/input'
import { cn } from '@/lib/utils'

/* ── Types ──────────────────────────────────── */
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  helperText?: string
  error?: string
  /** Icon rendered on the left inside the input */
  leadingIcon?: React.ReactNode
  /** Icon or content rendered on the right inside the input */
  trailingIcon?: React.ReactNode
  /** Show required asterisk */
  required?: boolean
  /** Full-width wrapper */
  fullWidth?: boolean
}

/* ── Component ──────────────────────────────── */
const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      label,
      helperText,
      error,
      leadingIcon,
      trailingIcon,
      required,
      fullWidth = false,
      id,
      disabled,
      ...props
    },
    ref,
  ) => {
    const inputId = id ?? React.useId()
    const hasError = Boolean(error)

    return (
      <Field.Root
        invalid={hasError}
        disabled={disabled}
        className={cn('flex flex-col gap-1.5', fullWidth ? 'w-full' : 'w-auto')}
      >
        {label && (
          <Field.Label
            htmlFor={inputId}
            className={cn(
              'font-sans text-sm font-medium text-foreground select-none',
              disabled && 'opacity-50',
            )}
          >
            {label}
            {required && (
              <span className="ml-1 text-[#ef4444]" aria-hidden="true">*</span>
            )}
          </Field.Label>
        )}

        {/* Input wrapper — handles icon positioning */}
        <div className="relative flex items-center">
          {leadingIcon && (
            <span
              className="pointer-events-none absolute left-3 flex items-center text-muted-foreground [&_svg]:size-4"
              aria-hidden="true"
            >
              {leadingIcon}
            </span>
          )}

          <InputPrimitive
            ref={ref}
            id={inputId}
            aria-required={required}
            aria-describedby={
              error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined
            }
            className={cn(
              // Base
              'flex w-full rounded-lg border bg-input/30 px-3 py-2',
              'font-sans text-sm text-foreground placeholder:text-muted-foreground',
              'transition-colors duration-150',
              // Focus
              'outline-none focus:border-ring focus:ring-2 focus:ring-ring/30',
              // Error
              hasError
                ? 'border-[#ef4444] focus:border-[#ef4444] focus:ring-[#ef4444]/20'
                : 'border-border hover:border-ring/50',
              // Disabled
              'disabled:pointer-events-none disabled:opacity-40',
              // Icon padding
              leadingIcon && 'pl-9',
              trailingIcon && 'pr-9',
              className,
            )}
            {...props}
          />

          {trailingIcon && (
            <span
              className="absolute right-3 flex items-center text-muted-foreground [&_svg]:size-4"
              aria-hidden="true"
            >
              {trailingIcon}
            </span>
          )}
        </div>

        {/* Error message */}
        {error && (
          <Field.Error
            id={`${inputId}-error`}
            className="flex items-center gap-1.5 text-xs text-[#ef4444]"
          >
            <svg className="size-3.5 shrink-0" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm-.75 4a.75.75 0 011.5 0v3.5a.75.75 0 01-1.5 0V5zm.75 6.5a.875.875 0 110-1.75.875.875 0 010 1.75z" />
            </svg>
            {error}
          </Field.Error>
        )}

        {/* Helper text */}
        {!error && helperText && (
          <p id={`${inputId}-helper`} className="text-xs text-muted-foreground">
            {helperText}
          </p>
        )}
      </Field.Root>
    )
  },
)
Input.displayName = 'Input'

/* ── Bare input (no wrapper) ─────────────────── */
const BareInput = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      'flex w-full rounded-lg border border-border bg-input/30 px-3 py-2',
      'font-sans text-sm text-foreground placeholder:text-muted-foreground',
      'outline-none transition-colors duration-150',
      'focus:border-ring focus:ring-2 focus:ring-ring/30',
      'disabled:pointer-events-none disabled:opacity-40',
      className,
    )}
    {...props}
  />
))
BareInput.displayName = 'BareInput'

export { Input, BareInput }
