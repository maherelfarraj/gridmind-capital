'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, MessageSquare, X, User, Shield } from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import {
  createTask,
  updateTaskStatus,
  addTaskComment,
  listTaskComments,
} from '@/app/actions/team'
import type { TaskRow } from '@/lib/db/queries'
import type { Role } from '@/lib/db/types'

type Person = { id: string; full_name: string; role: string | null }

const COLUMNS: { key: string; label: string }[] = [
  { key: 'todo', label: 'To Do' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'blocked', label: 'Blocked' },
  { key: 'done', label: 'Done' },
]

const PRIORITY_STYLE: Record<string, string> = {
  high: 'bg-destructive/15 text-destructive',
  medium: 'bg-primary/15 text-primary',
  low: 'bg-muted text-muted-foreground',
}

export function TasksBoard({
  projectId,
  tasks,
  people,
  roles,
}: {
  projectId: string
  tasks: TaskRow[]
  people: Person[]
  roles: (Role & { department_name: string; department_code: string })[]
}) {
  const router = useRouter()
  const { toast } = useToast()
  const [pending, startTransition] = useTransition()
  const [showCreate, setShowCreate] = useState(false)
  const [openComments, setOpenComments] = useState<string | null>(null)

  function move(taskId: string, status: string) {
    startTransition(async () => {
      const res = await updateTaskStatus({ taskId, status, projectId })
      if (res.error) toast({ title: 'Could not update task', description: res.error, variant: 'danger' })
      else router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> New task
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map((col) => {
          const colTasks = tasks.filter((t) => t.status === col.key)
          return (
            <div key={col.key} className="flex flex-col gap-3 rounded-lg border border-border bg-card/50 p-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-foreground">{col.label}</h2>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {colTasks.length}
                </span>
              </div>

              {colTasks.length === 0 && (
                <p className="py-6 text-center text-xs text-muted-foreground">No tasks</p>
              )}

              {colTasks.map((t) => (
                <div key={t.id} className="flex flex-col gap-2 rounded-md border border-border bg-card p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-foreground text-pretty">{t.title}</p>
                    <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase ${PRIORITY_STYLE[t.priority] ?? PRIORITY_STYLE.medium}`}>
                      {t.priority}
                    </span>
                  </div>

                  {t.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{t.description}</p>
                  )}

                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {t.assignee_person_name && (
                      <span className="inline-flex items-center gap-1">
                        <User className="h-3 w-3" /> {t.assignee_person_name}
                      </span>
                    )}
                    {!t.assignee_person_name && t.assignee_role_code && (
                      <span className="inline-flex items-center gap-1">
                        <Shield className="h-3 w-3" /> {t.assignee_role_code}
                      </span>
                    )}
                    {t.due_date && <span>Due {t.due_date}</span>}
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1">
                    <select
                      value={t.status}
                      disabled={pending}
                      onChange={(e) => move(t.id, e.target.value)}
                      className="rounded border border-border bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                      aria-label="Change task status"
                    >
                      {COLUMNS.map((c) => (
                        <option key={c.key} value={c.key}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => setOpenComments(t.id)}
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <MessageSquare className="h-3.5 w-3.5" /> {t.comment_count}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        })}
      </div>

      {showCreate && (
        <CreateTaskDialog
          projectId={projectId}
          people={people}
          roles={roles}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false)
            router.refresh()
          }}
        />
      )}

      {openComments && (
        <CommentsDialog
          taskId={openComments}
          projectId={projectId}
          onClose={() => setOpenComments(null)}
        />
      )}
    </div>
  )
}

function CreateTaskDialog({
  projectId,
  people,
  roles,
  onClose,
  onCreated,
}: {
  projectId: string
  people: Person[]
  roles: (Role & { department_name: string; department_code: string })[]
  onClose: () => void
  onCreated: () => void
}) {
  const { toast } = useToast()
  const [pending, startTransition] = useTransition()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState('medium')
  const [dueDate, setDueDate] = useState('')
  const [assignee, setAssignee] = useState('') // "person:<id>" | "role:<id>" | ""

  function submit() {
    if (!title.trim()) {
      toast({ title: 'Title required', variant: 'warning' })
      return
    }
    const assigneePersonId = assignee.startsWith('person:') ? assignee.slice(7) : null
    const assigneeRoleId = assignee.startsWith('role:') ? assignee.slice(5) : null
    startTransition(async () => {
      const res = await createTask({
        projectId,
        title,
        description,
        priority,
        dueDate: dueDate || null,
        assigneePersonId,
        assigneeRoleId,
      })
      if (res.error) toast({ title: 'Could not create task', description: res.error, variant: 'danger' })
      else {
        toast({ title: 'Task created', variant: 'success' })
        onCreated()
      }
    })
  }

  return (
    <Modal title="New task" onClose={onClose}>
      <div className="flex flex-col gap-3">
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Task title"
          className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description (optional)"
          rows={3}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Priority
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Due date
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
        </div>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Assign to
          <select
            value={assignee}
            onChange={(e) => setAssignee(e.target.value)}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Unassigned</option>
            <optgroup label="People">
              {people.map((p) => (
                <option key={p.id} value={`person:${p.id}`}>
                  {p.full_name}
                </option>
              ))}
            </optgroup>
            <optgroup label="Roles">
              {roles.map((r) => (
                <option key={r.id} value={`role:${r.id}`}>
                  {r.code} — {r.title}
                </option>
              ))}
            </optgroup>
          </select>
        </label>
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-foreground">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={pending}
            className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {pending ? 'Creating…' : 'Create task'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

function CommentsDialog({
  taskId,
  projectId,
  onClose,
}: {
  taskId: string
  projectId: string
  onClose: () => void
}) {
  const { toast } = useToast()
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [comments, setComments] = useState<
    { id: string; body: string; author_name: string | null; created_at: string }[] | null
  >(null)
  const [body, setBody] = useState('')

  useEffect(() => {
    let active = true
    listTaskComments(taskId)
      .then((c) => active && setComments(c))
      .catch(() => active && setComments([]))
    return () => {
      active = false
    }
  }, [taskId])

  function submit() {
    if (!body.trim()) return
    startTransition(async () => {
      const res = await addTaskComment({ taskId, body, projectId })
      if (res.error) toast({ title: 'Could not add comment', description: res.error, variant: 'danger' })
      else {
        setBody('')
        const fresh = await listTaskComments(taskId)
        setComments(fresh)
        router.refresh()
      }
    })
  }

  return (
    <Modal title="Comments" onClose={onClose}>
      <div className="flex max-h-[50vh] flex-col gap-3 overflow-y-auto">
        {comments === null && <p className="text-sm text-muted-foreground">Loading…</p>}
        {comments?.length === 0 && <p className="text-sm text-muted-foreground">No comments yet.</p>}
        {comments?.map((c) => (
          <div key={c.id} className="rounded-md border border-border bg-card p-3">
            <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{c.author_name ?? 'Unknown'}</span>
              <span>{new Date(c.created_at).toLocaleString()}</span>
            </div>
            <p className="text-sm text-foreground">{c.body}</p>
          </div>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing && e.keyCode !== 229) submit()
          }}
          placeholder="Add a comment…"
          className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <button
          onClick={submit}
          disabled={pending}
          className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </Modal>
  )
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string
  children: React.ReactNode
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-lg border border-border bg-card p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-foreground">{title}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
