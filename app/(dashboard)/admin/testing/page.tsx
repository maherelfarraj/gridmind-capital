'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { getProjects, resetProjectToPhase } from '@/app/actions/projects'
import { getProjectGateState } from '@/app/actions/phase-gates'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface TestProject {
  id: string
  code: string
  name: string
  current_phase: number
  status: string
}

export default function AdminTestingPage() {
  const router = useRouter()
  const [projects, setProjects] = React.useState<TestProject[]>([])
  const [loading, setLoading] = React.useState(true)
  const [resetting, setResetting] = React.useState<string | null>(null)

  React.useEffect(() => {
    loadProjects()
  }, [])

  async function loadProjects() {
    try {
      const data = await getProjects()
      const testProjects = data.map(p => ({
        id: p.id,
        code: p.code,
        name: p.name,
        current_phase: p.current_phase ?? 0,
        status: p.status,
      }))
      setProjects(testProjects.slice(0, 16)) // Show first 16 projects
      setLoading(false)
    } catch (error) {
      console.error('Failed to load projects:', error)
      setLoading(false)
    }
  }

  async function handleFreshStart(projectId: string, projectCode: string) {
    const confirmed = window.confirm(
      `Fresh start will reset ${projectCode} to G0. All approvals and signatures will be cleared. Continue?`
    )
    
    if (!confirmed) return

    setResetting(projectId)
    try {
      // Reset project to phase 0
      await resetProjectToPhase(projectId, 0)
      
      // Reload projects to show updated state
      await loadProjects()
    } catch (error) {
      console.error('Reset failed:', error)
    } finally {
      setResetting(null)
    }
  }

  if (loading) {
    return <div className="p-8">Loading projects...</div>
  }

  return (
    <div className="space-y-8 p-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Admin Testing Dashboard</h1>
        <p className="text-muted-foreground mt-2">Multi-project testing and fresh start controls (Admin only)</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Test Projects</CardTitle>
          <CardDescription>All {projects.length} projects with phase state and controls</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4">Project Code</th>
                  <th className="text-left py-3 px-4">Name</th>
                  <th className="text-left py-3 px-4">Phase</th>
                  <th className="text-left py-3 px-4">Status</th>
                  <th className="text-left py-3 px-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((project) => (
                  <tr key={project.id} className="border-b hover:bg-muted/50" data-testid="project-row">
                    <td className="py-3 px-4 font-mono text-sm">{project.code}</td>
                    <td className="py-3 px-4">{project.name}</td>
                    <td className="py-3 px-4">
                      <span
                        className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium bg-blue-100 text-blue-700"
                        data-testid={`project-phase-${project.id}`}
                      >
                        G{project.current_phase}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm">
                      <span className={`capitalize ${project.status === 'active' ? 'text-green-600' : 'text-gray-500'}`}>
                        {project.status}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => router.push(`/projects/${project.id}`)}
                        >
                          View
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleFreshStart(project.id, project.code)}
                          disabled={resetting === project.id}
                          data-testid={`fresh-start-${project.code.toLowerCase()}`}
                        >
                          {resetting === project.id ? 'Resetting...' : 'Fresh Start'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-blue-900">Testing Guide</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-blue-800">
          <p><strong>Fresh Start:</strong> Resets project to G0 with all approvals cleared. Use for testing new gate flows.</p>
          <p><strong>View Project:</strong> Navigate to project detail page to perform gate advancement testing.</p>
          <p><strong>Multi-Project:</strong> All 16 projects are available for concurrent testing.</p>
          <p><strong>Vocabulary Check:</strong> Verify stepper, panel, and registry badge all show real phase_names from database.</p>
        </CardContent>
      </Card>
    </div>
  )
}
