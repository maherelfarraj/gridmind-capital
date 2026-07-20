/**
 * components/layout/HelpHubPanel.tsx
 *
 * Re-export shim — single import path for all consumers.
 * Source of truth: components/help/help-hub-panel.tsx
 *
 * Usage:
 *   import { HelpHubPanel } from '@/components/layout/HelpHubPanel'
 *   import type { HelpTopic, HelpHubPanelProps, HelpModuleKey, UserRole } from '@/components/layout/HelpHubPanel'
 */

export {
  HelpHubPanel,
} from '@/components/help/help-hub-panel'

export type {
  HelpTopic,
  HelpModuleKey,
  HelpModule,
  UserRole,
  HelpHubPanelProps,
} from '@/components/help/help-hub-panel'
