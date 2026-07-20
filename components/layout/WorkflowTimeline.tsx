/**
 * Re-export shim — canonical source lives at:
 * components/workflow/workflow-timeline.tsx
 *
 * Import from either path; they resolve identically:
 *   import { WorkflowTimeline } from '@/components/layout/WorkflowTimeline'
 *   import { WorkflowTimeline } from '@/components/workflow/workflow-timeline'
 */
export {
  WorkflowTimeline,
  MOCK_WORKFLOW_LOGS,
} from '@/components/workflow/workflow-timeline'

export type {
  WorkflowAction,
  WorkflowLogEntry,
  WorkflowTimelineProps,
  FilterOption,
} from '@/components/workflow/workflow-timeline'
