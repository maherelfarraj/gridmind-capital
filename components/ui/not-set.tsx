import { cn } from '@/lib/utils'
import { NOT_SET_LABEL } from '@/lib/format-nullable'

/**
 * Muted "Not set" placeholder for a NULL nullable field.
 *
 * Deliberately visually distinct from a real figure so a missing budget can
 * never be mistaken for "$0". Pair with the `formatMoney`/`formatCapacity`
 * helpers, which return the same label for non-JSX contexts (aria-label,
 * emails, CSV).
 */
export function NotSet({ className }: { className?: string }) {
  return (
    <span className={cn('font-normal text-muted-foreground', className)}>
      {NOT_SET_LABEL}
    </span>
  )
}
