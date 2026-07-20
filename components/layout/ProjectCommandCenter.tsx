/**
 * Re-export shim — canonical source lives at:
 * components/project/project-command-center.tsx
 *
 * Import from here when following the deployment checklist path:
 *   import { ProjectCommandCenter } from '@/components/layout/ProjectCommandCenter'
 */
export {
  ProjectCommandCenter,
  adaptProjectRaw,
} from '@/components/project/project-command-center'

export type {
  ProjectCommandCenterProps,
  ProjectData,
  ProjectRaw,
  ProjectStatus,
} from '@/components/project/project-command-center'
