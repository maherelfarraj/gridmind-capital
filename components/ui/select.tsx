'use client'

import * as React from 'react'
import { Select as SelectPrimitive } from '@base-ui/react/select'
import { cn } from '@/lib/utils'

/* ── Types ──────────────────────────────────── */
export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
  group?: string
}

export interface SelectProps {
  options: SelectOption[]
  value?: string
  defaultValue?: string
  onValueChange?: (value: string | null) => void
  placeholder?: string
  label?: string
  helperText?: string
  error?: string
  disabled?: boolean
  required?: boolean
  fullWidth?: boolean
  className?: string
  id?: string
}

/* ── Chevron icon ───────────────────────────── */
function ChevronIcon({ open }: { open?: boolean }) {
  return (
    <svg
      className={cn(
        'size-4 shrink-0 text-muted-foreground transition-transform duration-150',
        open && 'rotate-180',
      )}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 6l4 4 4-4" />
    </svg>
  )
}

/* ── Check icon ─────────────────────────────── */
function CheckIcon() {
  return (
    <svg
      className="size-3.5 text-[#64ffda]"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 8l4 4 6-7" />
    </svg>
  )
}

/* ── Select ─────────────────────────────────── */
function Select({
  options,
  value,
  defaultValue,
  onValueChange,
  placeholder = 'Select an option',
  label,
  helperText,
  error,
  disabled,
  required,
  fullWidth = false,
  className,
  id,
}: SelectProps) {
  const selectId = id ?? React.useId()
  const hasError = Boolean(error)

  // Group options
  const groups = React.useMemo(() => {
    const grouped: Record<string, SelectOption[]> = { '': [] }
    for (const opt of options) {
      const g = opt.group ?? ''
      if (!grouped[g]) grouped[g] = []
      grouped[g].push(opt)
    }
    return grouped
  }, [options])

  return (
    <div className={cn('flex flex-col gap-1.5', fullWidth ? 'w-full' : 'w-auto', className)}>
      {label && (
        <label
          htmlFor={selectId}
          className={cn(
            'font-sans text-sm font-medium text-foreground select-none',
            disabled && 'opacity-50',
          )}
        >
          {label}
          {required && (
            <span className="ml-1 text-[#ef4444]" aria-hidden="true">*</span>
          )}
        </label>
      )}

      <SelectPrimitive.Root
        value={value}
        defaultValue={defaultValue}
        onValueChange={onValueChange}
        disabled={disabled}
        aria-required={required}
        aria-invalid={hasError}
        aria-describedby={
          error ? `${selectId}-error` : helperText ? `${selectId}-helper` : undefined
        }
      >
        {/* Trigger */}
        <SelectPrimitive.Trigger
          id={selectId}
          className={cn(
            'flex w-full items-center justify-between rounded-lg border bg-input/30 px-3 py-2',
            'font-sans text-sm text-foreground',
            'transition-colors duration-150 outline-none cursor-pointer',
            'focus:border-ring focus:ring-2 focus:ring-ring/30',
            'disabled:pointer-events-none disabled:opacity-40',
            hasError
              ? 'border-[#ef4444] focus:border-[#ef4444] focus:ring-[#ef4444]/20'
              : 'border-border hover:border-ring/50',
            // NOTE: render selected label manually — Base UI's SelectPrimitive.Value
            // does not resolve ItemText on SSR/hydration before items mount.
            'data-[popup-open]:border-ring data-[popup-open]:ring-2 data-[popup-open]:ring-ring/30',
          )}
        >
          {/* Resolve label from options array so initial value always displays correctly */}
          {(() => {
            const currentValue = value ?? defaultValue
            const found = options.find(o => o.value === currentValue)
            return found
              ? <span>{found.label}</span>
              : <span className="text-muted-foreground">{placeholder}</span>
          })()}
          {/* Keep SelectPrimitive.Value hidden so Base UI still tracks selection internally */}
          <SelectPrimitive.Value className="sr-only" />
          <SelectPrimitive.Icon>
            <ChevronIcon />
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>

        {/* Popup */}
        <SelectPrimitive.Portal>
          <SelectPrimitive.Positioner sideOffset={6}>
            <SelectPrimitive.Popup
              className={cn(
                'z-50 min-w-[var(--anchor-width)] rounded-xl border border-border bg-popover',
                'p-1 shadow-[0_8px_30px_rgba(0,0,0,0.18)] outline-none',
                'data-[ending-style]:opacity-0 data-[ending-style]:scale-[0.98]',
                'data-[starting-style]:opacity-0 data-[starting-style]:translate-y-1',
                'transition-[opacity,transform] duration-[160ms] ease-[cubic-bezier(0.16,1,0.3,1)]',
              )}
            >
              <SelectPrimitive.List>
                {Object.entries(groups).map(([groupName, groupOptions]) => {
                  if (groupOptions.length === 0) return null
                  return groupName ? (
                    <SelectPrimitive.Group key={groupName}>
                      <SelectPrimitive.GroupLabel className="px-3 pb-1 pt-2 font-sans text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {groupName}
                      </SelectPrimitive.GroupLabel>
                      {groupOptions.map((opt) => (
                        <SelectItem key={opt.value} option={opt} />
                      ))}
                    </SelectPrimitive.Group>
                  ) : (
                    <React.Fragment key="ungrouped">
                      {groupOptions.map((opt) => (
                        <SelectItem key={opt.value} option={opt} />
                      ))}
                    </React.Fragment>
                  )
                })}
              </SelectPrimitive.List>
            </SelectPrimitive.Popup>
          </SelectPrimitive.Positioner>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>

      {/* Error */}
      {error && (
        <p
          id={`${selectId}-error`}
          className="flex items-center gap-1.5 text-xs text-[#ef4444]"
        >
          <svg className="size-3.5 shrink-0" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm-.75 4a.75.75 0 011.5 0v3.5a.75.75 0 01-1.5 0V5zm.75 6.5a.875.875 0 110-1.75.875.875 0 010 1.75z" />
          </svg>
          {error}
        </p>
      )}

      {/* Helper */}
      {!error && helperText && (
        <p id={`${selectId}-helper`} className="text-xs text-muted-foreground">
          {helperText}
        </p>
      )}
    </div>
  )
}

/* ── SelectItem ─────────────────────────────── */
function SelectItem({ option }: { option: SelectOption }) {
  return (
    <SelectPrimitive.Item
      value={option.value}
      disabled={option.disabled}
      className={cn(
        'flex cursor-pointer items-center justify-between rounded-lg px-3 py-2',
        'font-sans text-sm text-popover-foreground',
        'outline-none transition-colors duration-100',
        'hover:bg-accent hover:text-accent-foreground',
        'data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground',
        'data-[selected]:text-[#64ffda]',
        'disabled:pointer-events-none disabled:opacity-40',
      )}
    >
      <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator className="ml-2 flex items-center">
        <CheckIcon />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  )
}

export { Select }

/* ─────────────────────────────────────────────────────────────────────────────
   shadcn/ui-compatible named exports
   These let consumers import { SelectTrigger, SelectValue, SelectContent,
   SelectItem } from '@/components/ui/select' without breaking the existing
   Select wrapper above. They are thin React forwarding stubs that delegate
   to the Base UI primitives already used internally.
──────────────────────────────────────────────────────────────────────────────*/

/** Root wrapper — use `<Select>` directly for the full controlled component,
 *  or `<SelectRoot>` when composing primitives manually. */
const SelectRoot = SelectPrimitive.Root

/** Trigger button that opens the dropdown. */
const SelectTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      'flex w-full items-center justify-between rounded-lg border border-border bg-input/30 px-3 py-2',
      'font-sans text-sm text-foreground transition-colors duration-150 outline-none cursor-pointer',
      'focus:border-ring focus:ring-2 focus:ring-ring/30 disabled:pointer-events-none disabled:opacity-40',
      'hover:border-ring/50 data-[popup-open]:border-ring data-[popup-open]:ring-2 data-[popup-open]:ring-ring/30',
      className,
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon><ChevronIcon /></SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
))
SelectTrigger.displayName = 'SelectTrigger'

/** Displays the currently selected value or placeholder. */
const SelectValue = React.forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement> & { placeholder?: string }
>(({ placeholder, ...props }, _ref) => (
  <SelectPrimitive.Value
    placeholder={placeholder ? <span className="text-muted-foreground">{placeholder}</span> : undefined}
    {...props}
  />
))
SelectValue.displayName = 'SelectValue'

/** Dropdown content container. */
const SelectContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, _ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Positioner sideOffset={6}>
      <SelectPrimitive.Popup
        className={cn(
          'z-50 min-w-[var(--anchor-width)] rounded-xl border border-border bg-popover',
          'p-1 shadow-[0_8px_30px_rgba(0,0,0,0.18)] outline-none',
          'data-[ending-style]:opacity-0 data-[ending-style]:scale-[0.98]',
          'data-[starting-style]:opacity-0 data-[starting-style]:translate-y-1',
          'transition-[opacity,transform] duration-[160ms] ease-[cubic-bezier(0.16,1,0.3,1)]',
          className,
        )}
        {...props}
      >
        <SelectPrimitive.List>{children}</SelectPrimitive.List>
      </SelectPrimitive.Popup>
    </SelectPrimitive.Positioner>
  </SelectPrimitive.Portal>
))
SelectContent.displayName = 'SelectContent'

/** Individual option item inside `<SelectContent>`. */
const SelectItemPrimitive = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { value: string; disabled?: boolean }
>(({ className, children, value, disabled, ...props }, _ref) => (
  <SelectPrimitive.Item
    value={value}
    disabled={disabled}
    className={cn(
      'flex cursor-pointer items-center justify-between rounded-lg px-3 py-2',
      'font-sans text-sm text-popover-foreground outline-none transition-colors duration-100',
      'hover:bg-accent hover:text-accent-foreground',
      'data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground',
      'data-[selected]:text-[#64ffda] disabled:pointer-events-none disabled:opacity-40',
      className,
    )}
    {...props}
  >
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    <SelectPrimitive.ItemIndicator className="ml-2 flex items-center">
      <CheckIcon />
    </SelectPrimitive.ItemIndicator>
  </SelectPrimitive.Item>
))
SelectItemPrimitive.displayName = 'SelectItem'

export {
  SelectRoot,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItemPrimitive as SelectItem,
}
