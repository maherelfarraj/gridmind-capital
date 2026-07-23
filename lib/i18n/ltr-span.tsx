/**
 * LtrSpan — wraps content that must always read left-to-right even when the
 * page direction is RTL: project codes, VO/NCR numbers, monetary amounts,
 * version strings, email addresses, file paths, and similar identifiers.
 *
 * Usage:
 *   import { LtrSpan } from '@/lib/i18n/ltr-span'
 *   <LtrSpan>{row.code}</LtrSpan>
 *   <LtrSpan>{formatCurrency(amount)}</LtrSpan>
 */

import * as React from 'react'
import { cn } from '@/lib/utils'

interface LtrSpanProps extends React.HTMLAttributes<HTMLSpanElement> {
  children: React.ReactNode
}

export function LtrSpan({ children, className, ...props }: LtrSpanProps) {
  return (
    <span
      dir="ltr"
      className={cn('inline-block', className)}
      {...props}
    >
      {children}
    </span>
  )
}

/**
 * Convenience wrapper for numeric / currency cells in data tables.
 * Combines dir="ltr" with tabular-nums so columns align correctly.
 */
export function NumericCell({ children, className, ...props }: LtrSpanProps) {
  return (
    <span
      dir="ltr"
      data-numeric="true"
      className={cn('inline-block tabular-nums', className)}
      {...props}
    >
      {children}
    </span>
  )
}
