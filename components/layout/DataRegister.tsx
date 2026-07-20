/**
 * components/layout/DataRegister.tsx
 *
 * Public re-export shim — canonical source lives at:
 *   components/ui/data-register.tsx
 *
 * Import from here in app code:
 *   import { DataRegister } from '@/components/layout/DataRegister'
 *   import type { ColumnDef, DataRegisterProps } from '@/components/layout/DataRegister'
 */

export {
  DataRegister,
} from '@/components/ui/data-register'

export type {
  ColumnAlign,
  ColumnType,
  FilterOption,
  ColumnDef,
  ActionDef,
  DataRegisterProps,
} from '@/components/ui/data-register'

// Also export the spec Project type and data for consumers that use the flat shape
export type { Project } from '@/components/projects/projects-list-page'
