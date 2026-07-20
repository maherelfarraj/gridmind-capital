import * as React from 'react'
import { Button as ButtonPrimitive } from '@base-ui/react/button'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
  [
    "group/button inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-transparent",
    "bg-clip-padding font-sans text-sm font-medium whitespace-nowrap",
    "transition-all duration-150 ease-out outline-none select-none",
    "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50",
    "active:not-aria-[haspopup]:scale-[0.98]",
    "disabled:pointer-events-none disabled:opacity-40",
    "aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  ],
  {
    variants: {
      variant: {
        /** Primary CTA — navy bg, accent foreground */
        default:
          'bg-primary text-primary-foreground shadow-sm hover:opacity-90',

        /** Bordered, transparent background */
        outline:
          'border-border bg-background text-foreground hover:bg-muted hover:text-foreground aria-expanded:bg-muted dark:border-input dark:bg-input/30 dark:hover:bg-input/50',

        /** Muted secondary surface */
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-secondary/80',

        /** Ghost — no border, subtle hover */
        ghost:
          'bg-transparent text-foreground hover:bg-muted dark:hover:bg-muted/50',

        /** Soft destructive */
        destructive:
          'bg-[#ef4444]/10 text-[#ef4444] hover:bg-[#ef4444]/20 focus-visible:border-[#ef4444]/40 dark:bg-[#ef4444]/20 dark:hover:bg-[#ef4444]/30',

        /** Text / anchor link */
        link:
          'bg-transparent text-primary underline-offset-4 hover:underline px-0 h-auto',

        /** Stage-gate CTA — glowing accent */
        gate:
          'bg-[#64ffda] text-[#0a192f] font-semibold shadow-[0_0_0_1px_#64ffda,0_4px_16px_rgba(100,255,218,0.25)] hover:shadow-[0_0_0_1px_#64ffda,0_4px_28px_rgba(100,255,218,0.45)]',

        /** Affirmative success */
        success:
          'bg-[#22c55e] text-white shadow-sm hover:bg-[#16a34a]',

        /** Advisory / caution */
        warning:
          'bg-[#f59e0b] text-white shadow-sm hover:bg-[#d97706]',

        /** Hard danger (filled, ring) */
        danger:
          'bg-[#ef4444] text-white ring-1 ring-[#ef4444]/50 shadow-sm hover:bg-[#dc2626]',
      },
      size: {
        xs:      'h-6  gap-1   rounded-md  px-2    text-xs  [&_svg:not([class*="size-"])]:size-3',
        sm:      'h-7  gap-1   rounded-md  px-2.5  text-xs  [&_svg:not([class*="size-"])]:size-3.5',
        default: 'h-9  gap-1.5            px-4    text-sm',
        lg:      'h-10 gap-2              px-5    text-sm',
        xl:      'h-12 gap-2              px-7    text-base [&_svg:not([class*="size-"])]:size-5',
        icon:    'size-9',
        'icon-sm':  'size-7  rounded-md',
        'icon-lg':  'size-11 [&_svg:not([class*="size-"])]:size-5',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

export interface ButtonProps
  extends ButtonPrimitive.Props,
    VariantProps<typeof buttonVariants> {
  loading?: boolean
}

function Button({
  className,
  variant = 'default',
  size = 'default',
  loading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <>
          <svg
            className="animate-spin size-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12" cy="12" r="10"
              stroke="currentColor" strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          {children}
        </>
      ) : (
        children
      )}
    </ButtonPrimitive>
  )
}

export { Button, buttonVariants }
