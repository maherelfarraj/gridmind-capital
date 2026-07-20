'use client'

import * as React from 'react'
import { ProjectCommandCenter, type ProjectData } from './project-command-center'
import { Button } from '@/components/ui/button'

const DEMO_PROJECT: ProjectData = {
  id:          'proj-srs-400',
  name:        'Sirius 400MW Solar Farm',
  code:        'SRS-400',
  client:      'Helios Energy Partners',
  status:      'active',
  phase:       'g5',
  gate:        5,
  gateName:    'Construction Ready',
  budgetUsd:   480_000_000,
  startDate:   '2023-03-15',
  targetCod:   '2026-06-30',
  location:    'Atacama Desert, Chile',
  commentCount: 7,
}

export function ProjectCommandCenterDemo() {
  const [loading, setLoading] = React.useState(false)
  const [project, setProject] = React.useState<ProjectData | null>(DEMO_PROJECT)

  function simulateLoading() {
    setProject(null)
    setLoading(true)
    setTimeout(() => {
      setLoading(false)
      setProject(DEMO_PROJECT)
    }, 2000)
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          ProjectCommandCenter
        </h2>
        <Button
          variant="outline"
          size="sm"
          onClick={simulateLoading}
          loading={loading}
          className="ml-auto"
        >
          Simulate Loading
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setProject(project ? null : DEMO_PROJECT)}
        >
          {project ? 'Clear Data' : 'Restore Data'}
        </Button>
      </div>

      {/* Live component */}
      <ProjectCommandCenter
        project={project}
        loading={loading}
        onBack={() => alert('Back to projects')}
        onComments={() => alert('Open comments')}
        onDocuments={() => alert('Open documents')}
        onEdit={() => alert('Open edit form')}
        className="rounded-xl"
      />

      {/* Variants label */}
      <div className="mt-8 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Status variants
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(
            [
              { ...DEMO_PROJECT, id: 'v1', status: 'active',    name: 'Active Project'    },
              { ...DEMO_PROJECT, id: 'v2', status: 'at-risk',   name: 'At-Risk Project'   },
              { ...DEMO_PROJECT, id: 'v3', status: 'on-hold',   name: 'On-Hold Project'   },
              { ...DEMO_PROJECT, id: 'v4', status: 'planning',  name: 'Planning Project'  },
              { ...DEMO_PROJECT, id: 'v5', status: 'completed', name: 'Completed Project' },
              { ...DEMO_PROJECT, id: 'v6', status: 'cancelled', name: 'Cancelled Project' },
            ] as ProjectData[]
          ).map((p) => (
            <ProjectCommandCenter
              key={p.id}
              project={p}
              className="rounded-xl"
            />
          ))}
        </div>
      </div>
    </div>
  )
}
