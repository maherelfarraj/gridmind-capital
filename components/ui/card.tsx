import * as React from 'react'
import { cn } from '@/lib/utils'

/* ── Card ─────────────────────────────────────── */
const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    /** Adds a subtle accent glow on the left edge */
    accent?: boolean
    /** Reduces padding for compact layouts */
    compact?: boolean
  }
>(({ className, accent = false, compact = false, ...props }, ref) => (
  <div
    ref={ref}
    data-slot="card"
    className={cn(
      'relative flex flex-col rounded-xl border border-border bg-card text-card-foreground',
      'shadow-[0_1px_4px_rgba(0,0,0,0.08)] dark:shadow-[0_1px_8px_rgba(0,0,0,0.3)]',
      'transition-shadow duration-150',
      accent && 'border-l-2 border-l-[#64ffda] pl-0',
      compact ? 'gap-2' : 'gap-0',
      className,
    )}
    {...props}
  />
))
Card.displayName = 'Card'

/* ── CardHeader ───────────────────────────────── */
const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-slot="card-header"
    className={cn(
      'flex flex-col gap-1.5 px-6 pt-6',
      className,
    )}
    {...props}
  />
))
CardHeader.displayName = 'CardHeader'

/* ── CardTitle ────────────────────────────────── */
const CardTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    data-slot="card-title"
    className={cn(
      'font-sans text-base font-semibold leading-tight tracking-tight text-card-foreground',
      className,
    )}
    {...props}
  />
))
CardTitle.displayName = 'CardTitle'

/* ── CardDescription ──────────────────────────── */
const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    data-slot="card-description"
    className={cn('text-sm leading-relaxed text-muted-foreground', className)}
    {...props}
  />
))
CardDescription.displayName = 'CardDescription'

/* ── CardContent ──────────────────────────────── */
const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-slot="card-content"
    className={cn('px-6 py-4', className)}
    {...props}
  />
))
CardContent.displayName = 'CardContent'

/* ── CardFooter ───────────────────────────────── */
const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-slot="card-footer"
    className={cn(
      'flex items-center gap-3 px-6 pb-6 pt-2',
      className,
    )}
    {...props}
  />
))
CardFooter.displayName = 'CardFooter'

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter }
