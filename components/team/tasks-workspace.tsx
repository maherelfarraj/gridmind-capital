'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, MessageSquare, X, User, Shield, AlertTriangle, CheckCircle2, Sparkles } from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import {
  createTask,
  updateTaskStatus,
  addTaskComment,
  listTaskComments,
  resolveTaskSmartDefault,
} from '@/app/actions/team'
import type { TaskRow, MyTaskRow } from '@/lib/db/queries'
import type { Role, VPersonTaskLoad } from '@/lib/db/types'

type Person = { id: string; full_name: string; role: string | null }
type DeliverableOpt = { id: string; name: string; gate_code: string | null }
type RoleFull = Role & { department_name: string; department_code: string }

const COLUMNS = [
  { key: 'todo', label: 'To Do' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'blocked', label: 'Blocked' },
  { key: 'done', label: 'Done' },
] as const

const PRIORITY_STYLE: Record<string, string> = {
  high: 'bg-destructive/15 text-destructive',
  medium: 'bg-primary/15 text-primary',
  low: 'bg-muted text-muted-foreground',
}

const VIEWS = [
  { key: 'mine', label: 'My Tasks' },
  { key: 'board', label: 'Board' },
  { key: 'assign', label: 'Assign' },
] as const
type ViewKey = (typeof VIEWS)[number]['key']

function startOfToday() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

export function TasksWorkspace({
  projects,
  selectedId,
  myTasks,
  boardTasks,
  people,
  roles,
  deliverables,
  taskLoad,
  canAssign,
}: {
  projects: { id: string; code: string; name: string }[]
  selectedId: string | null
  myTasks: MyTaskRow[]
  boardTasks: TaskRow[]
  people: Person[]
  roles: RoleFull[]
  deliverables: DeliverableOpt[]
  taskLoad: VPersonTaskLoad[]
  canAssign: boolean
}) {
  const [view, setView] = useState<ViewKey>('mine')

  return (
    <div className="flex flex-col gap-5">
      <div className="flex gap-1 rounded-lg border border-border bg-card p-1 w-fit">
        {VIEWS.filter((v) => v.key !== 'assign' || canAssign).map((v) => (
          <button
            key={v.key}
            type="button"
            onClick={() => setView(v.key)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              view === v.key
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      {view === 'mine' && <MyTasksView tasks={myTasks} />}
      {view === 'board' && (
        <BoardView
          projectId={selectedId}
          tasks={boardTasks}
          people={people}
          roles={roles}
          deliverables={deliverables}
          canAssign={canAssign}
        />
      )}
      {view === 'assign' && canAssign && (
        <AssignView
          projectId={selectedId}
          people={people}
          roles={roles}
          deliverables={deliverables}
          taskLoad={taskLoad}
          boardTasks={boardTasks}
        />
      )}
    </div>
  )
}

/* ── MY TASKS ─────────────────────────────────────────────── */

function MyTasksView({ tasks }: { tasks: MyTaskRow[] }) {
  const router = useRouter()
  const { toast } = useToast()
  const [pending, startTransition] = useTransition()

  const groups = useMemo(() => {
    const today = startOfToday()
    const endOfWeek = new Date(today)
    endOfWeek.setDate(endOfWeek.getDate() + (7 - today.getDay()))
    const g: Record<string, MyTaskRow[]> = { Overdue: [], Today: [], 'This week': [], Later: [] }
    for (const t of tasks) {
      if (!t.due_date) {
        g['Later'].push(t)
        continue
      }
      const due = new Date(t.due_date)
      due.setHours(0, 0, 0, 0)
      if (due < today) g['Overdue'].push(t)
      else if (due.getTime() === today.getTime()) g['Today'].push(t)
      else if (due <= endOfWeek) g['This week'].push(t)
      else g['Later'].push(t)
    }
    return g
  }, [tasks])

  function complete(id: string) {
    const task = tasks.find((t) => t.id === id)
    if (!task) return
    startTransition(async () => {
      const res = await updateTaskStatus({ taskId: id, status: 'done', projectId: task.project_id })
      if (res.error) toast({ title: res.error, variant: 'danger' })
      else {
        toast({ title: 'Task completed', variant: 'success' })
        router.refresh()
      }
    })
  }

  if (tasks.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-10 text-center">
        <CheckCircle2 className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">You have no open tasks. Nice work.</p>
      </div>
    )
  }

  const GROUP_STYLE: Record<string, string> = {
    Overdue: 'text-destructive',
    Today: 'text-primary',
    'This week': 'text-foreground',
    Later: 'text-muted-foreground',
  }

  return (
    <div className="flex flex-col gap-6">
      {(['Overdue', 'Today', 'This week', 'Later'] as const).map((key) =>
        groups[key].length === 0 ? null : (
          <section key={key}>
            <h2 className={`mb-2 text-xs font-semibold uppercase tracking-wide ${GROUP_STYLE[key]}`}>
              {key} · {groups[key].length}
            </h2>
            <div className="flex flex-col gap-2">
              {groups[key].map((t) => (
                <div
                  key={t.id}
                  className="flex items-start gap-3 rounded-lg border border-border bg-card p-3"
                >
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => complete(t.id)}
                    aria-label={`Complete ${t.title}`}
                    className="mt-0.5 h-5 w-5 shrink-0 rounded-full border-2 border-muted-foreground/40 hover:border-primary hover:bg-primary/10 disabled:opacity-50"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-foreground">{t.title}</span>
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${PRIORITY_STYLE[t.priority]}`}>
                        {t.priority}
                      </span>
                      {t.deliverable_title && (
                        <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-secondary-foreground">
                          {t.deliverable_gate ? `G${t.deliverable_gate} · ` : ''}
                          {t.deliverable_title}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {t.project_code} · {t.project_name}
                      {t.due_date ? ` · due ${new Date(t.due_date).toLocaleDateString()}` : ''}
                      {t.comment_count > 0 ? ` · ${t.comment_count} comment${t.comment_count > 1 ? 's' : ''}` : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ),
      )}
    </div>
  )
}

/* ── BOARD ────────────────────────────────────────────────── */

function BoardView({
  projectId,
  tasks,
  people,
  roles,
  deliverables,
  canAssign,
}: {
  projectId: string | null
  tasks: TaskRow[]
  people: Person[]
  roles: RoleFull[]
  deliverables: DeliverableOpt[]
  canAssign: boolean
}) {
  const router = useRouter()
  const { toast } = useToast()
  const [pending, startTransition] = useTransition()
  const [showNew, setShowNew] = useState(false)
  const [commentFor, setCommentFor] = useState<TaskRow | null>(null)

  if (!projectId) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
        Select a project to view its task board.
      </div>
    )
  }

  function move(task: TaskRow, status: string) {
    startTransition(async () => {
      const res = await updateTaskStatus({ taskId: task.id, status, projectId: projectId! })
      if (res.error) {
        toast({ title: res.error, variant: 'danger' })
        if (status === 'blocked') setCommentFor(task)
      } else router.refresh()
    })
  }

  const byStatus = (s: string) => tasks.filter((t) => t.status === s)

  return (
    <div className="flex flex-col gap-4">
      {canAssign && (
        <button
          type="button"
          onClick={() => setShowNew(true)}
          className="inline-flex w-fit items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> New task
        </button>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map((col) => {
          const items = byStatus(col.key)
          return (
            <div key={col.key} className="flex flex-col gap-2 rounded-lg border border-border bg-muted/30 p-3">
              <h3 className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {col.label}
                <span className="rounded bg-card px-1.5 py-0.5 text-[10px]">{items.length}</span>
              </h3>
              {items.map((t) => (
                <div key={t.id} className="rounded-md border border-border bg-card p-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-medium text-foreground">{t.title}</span>
                    <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${PRIORITY_STYLE[t.priority]}`}>
                      {t.priority}
                    </span>
                  </div>
                  {t.deliverable_title && (
                    <span className="mt-1 inline-block rounded bg-secondary px-1.5 py-0.5 text-[10px] text-secondary-foreground">
                      {t.deliverable_title}
                    </span>
                  )}
                  <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
                    {t.assignee_person_name ? (
                      <span className="inline-flex items-center gap-1">
                        <User className="h-3 w-3" /> {t.assignee_person_name}
                      </span>
                    ) : t.assignee_role_code ? (
                      <span className="inline-flex items-center gap-1">
                        <Shield className="h-3 w-3" /> {t.assignee_role_code}
                      </span>
                    ) : (
                      <span>Unassigned</span>
                    )}
                    <button
                      type="button"
                      onClick={() => setCommentFor(t)}
                      className="ml-auto inline-flex items-center gap-1 hover:text-foreground"
                    >
                      <MessageSquare className="h-3 w-3" /> {t.comment_count}
                    </button>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {COLUMNS.filter((c) => c.key !== t.status).map((c) => (
                      <button
                        key={c.key}
                        type="button"
                        disabled={pending}
                        onClick={() => move(t, c.key)}
                        className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
                      >
                        {c.key === 'blocked' ? 'Block' : c.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {items.length === 0 && (
                <p className="py-4 text-center text-xs text-muted-foreground">No tasks</p>
              )}
            </div>
          )
        })}
      </div>

      {showNew && (
        <NewTaskDialog
          projectId={projectId}
          people={people}
          roles={roles}
          deliverables={deliverables}
          onClose={() => setShowNew(false)}
        />
      )}
      {commentFor && (
        <CommentDialog task={commentFor} projectId={projectId} onClose={() => setCommentFor(null)} />
      )}
    </div>
  )
}

/* ── ASSIGN (PM/PD) ───────────────────────────────────────── */

function AssignView({
  projectId,
  people,
  roles,
  deliverables,
  taskLoad,
  boardTasks,
}: {
  projectId: string | null
  people: Person[]
  roles: RoleFull[]
  deliverables: DeliverableOpt[]
  taskLoad: VPersonTaskLoad[]
  boardTasks: TaskRow[]
}) {
  const [newFor, setNewFor] = useState<Person | null>(null)

  if (!projectId) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
        Select a project to assign work.
      </div>
    )
  }

  // Members with a project_team seat (people who appear as assignees or in taskLoad).
  const loadByPerson = new Map(taskLoad.map((l) => [l.person_id, l]))
  const memberIds = new Set<string>([
    ...taskLoad.map((l) => l.person_id),
    ...boardTasks.map((t) => t.assignee_person_id).filter(Boolean) as string[],
  ])
  const members = people.filter((p) => memberIds.has(p.id))
  const list = members.length > 0 ? members : people

  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Member</th>
              <th className="px-3 py-2 font-medium">Role</th>
              <th className="px-3 py-2 text-center font-medium">To do</th>
              <th className="px-3 py-2 text-center font-medium">In progress</th>
              <th className="px-3 py-2 text-center font-medium">Blocked</th>
              <th className="px-3 py-2 text-center font-medium">Overdue</th>
              <th className="px-3 py-2 text-right font-medium">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {list.map((p) => {
              const load = loadByPerson.get(p.id)
              return (
                <tr key={p.id} className="bg-card">
                  <td className="px-3 py-2 font-medium text-foreground">{p.full_name}</td>
                  <td className="px-3 py-2 text-muted-foreground">{p.role ?? '—'}</td>
                  <td className="px-3 py-2 text-center">{load?.todo ?? 0}</td>
                  <td className="px-3 py-2 text-center">{load?.in_progress ?? 0}</td>
                  <td className={`px-3 py-2 text-center ${(load?.blocked ?? 0) > 0 ? 'text-destructive font-semibold' : ''}`}>
                    {load?.blocked ?? 0}
                  </td>
                  <td className={`px-3 py-2 text-center ${(load?.overdue ?? 0) > 0 ? 'text-destructive font-semibold' : ''}`}>
                    {load?.overdue ?? 0}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => setNewFor(p)}
                      className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-accent hover:text-accent-foreground"
                    >
                      <Plus className="h-3 w-3" /> Assign task
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {newFor && (
        <NewTaskDialog
          projectId={projectId}
          people={people}
          roles={roles}
          deliverables={deliverables}
          defaultPersonId={newFor.id}
          onClose={() => setNewFor(null)}
        />
      )}
    </div>
  )
}

/* ── New task dialog (shared) ─────────────────────────────── */

function NewTaskDialog({
  projectId,
  people,
  roles,
  deliverables,
  defaultPersonId,
  onClose,
}: {
  projectId: string
  people: Person[]
  roles: RoleFull[]
  deliverables: DeliverableOpt[]
  defaultPersonId?: string
  onClose: () => void
}) {
  const router = useRouter()
  const { toast } = useToast()
  const [pending, startTransition] = useTransition()
  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState('medium')
  const [dueDate, setDueDate] = useState('')
  const [deliverableId, setDeliverableId] = useState('')
  const [roleId, setRoleId] = useState('')
  const [personId, setPersonId] = useState(defaultPersonId ?? '')
  const [hint, setHint] = useState<string | null>(null)

  function onDeliverableChange(id: string) {
    setDeliverableId(id)
    setHint(null)
    if (!id) return
    // Live RACI smart-default preview.
    startTransition(async () => {
      const res = await resolveTaskSmartDefault({ projectId, deliverableId: id })
      if (res.roleId) {
        setRoleId((cur) => cur || res.roleId!)
        if (res.personId && !defaultPersonId) setPersonId((cur) => cur || res.personId!)
        setHint(
          `Smart-default: ${res.roleCode ?? 'role'}${res.personName ? ` · ${res.personName}` : ' · no one staffed'}`,
        )
      } else {
        setHint('No Responsible/Accountable on this deliverable yet.')
      }
    })
  }

  function submit() {
    if (!title.trim()) {
      toast({ title: 'Task title is required.', variant: 'danger' })
      return
    }
    startTransition(async () => {
      const res = await createTask({
        projectId,
        title,
        priority,
        dueDate: dueDate || null,
        deliverableId: deliverableId || null,
        assigneeRoleId: roleId || null,
        assigneePersonId: personId || null,
      })
      if (res.error) toast({ title: res.error, variant: 'danger' })
      else {
        toast({ title: 'Task created', variant: 'success' })
        onClose()
        router.refresh()
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-lg border border-border bg-card p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">New task</h3>
          <button type="button" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        <div className="flex flex-col gap-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Task title"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Priority
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
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
                className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
              />
            </label>
          </div>

          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Deliverable (RACI smart-default)
            <select
              value={deliverableId}
              onChange={(e) => onDeliverableChange(e.target.value)}
              className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
            >
              <option value="">None</option>
              {deliverables.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.gate_code ? `${d.gate_code} · ` : ''}
                  {d.name}
                </option>
              ))}
            </select>
          </label>

          {hint && (
            <p className="inline-flex items-center gap-1 text-xs text-primary">
              <Sparkles className="h-3 w-3" /> {hint}
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Role
              <select
                value={roleId}
                onChange={(e) => setRoleId(e.target.value)}
                className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
              >
                <option value="">—</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.code}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Person
              <select
                value={personId}
                onChange={(e) => setPersonId(e.target.value)}
                className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
              >
                <option value="">—</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <button
            type="button"
            disabled={pending}
            onClick={submit}
            className="mt-1 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {pending ? 'Creating…' : 'Create task'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Comment dialog (shared) ──────────────────────────────── */

function CommentDialog({
  task,
  projectId,
  onClose,
}: {
  task: TaskRow
  projectId: string
  onClose: () => void
}) {
  const router = useRouter()
  const { toast } = useToast()
  const [pending, startTransition] = useTransition()
  const [comments, setComments] = useState<
    { id: string; body: string; author_name: string | null; created_at: string }[] | null
  >(null)
  const [body, setBody] = useState('')

  useEffect(() => {
    listTaskComments(task.id).then(setComments)
  }, [task.id])

  function add() {
    if (!body.trim()) return
    startTransition(async () => {
      const res = await addTaskComment({ taskId: task.id, body, projectId })
      if (res.error) toast({ title: res.error, variant: 'danger' })
      else {
        setBody('')
        const fresh = await listTaskComments(task.id)
        setComments(fresh)
        toast({ title: 'Comment added', variant: 'success' })
        router.refresh()
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="flex max-h-[80vh] w-full max-w-md flex-col rounded-lg border border-border bg-card p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">{task.title}</h3>
          <button type="button" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        <p className="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground">
          <AlertTriangle className="h-3 w-3 text-primary" />
          A comment is required before a task can be marked blocked.
        </p>

        <div className="flex-1 space-y-2 overflow-y-auto">
          {comments === null ? (
            <p className="text-xs text-muted-foreground">Loading…</p>
          ) : comments.length === 0 ? (
            <p className="text-xs text-muted-foreground">No comments yet.</p>
          ) : (
            comments.map((c) => (
              <div key={c.id} className="rounded-md border border-border bg-muted/30 p-2">
                <p className="text-sm text-foreground">{c.body}</p>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {c.author_name ?? 'Someone'} · {new Date(c.created_at).toLocaleString()}
                </p>
              </div>
            ))
          )}
        </div>

        <div className="mt-3 flex gap-2">
          <input
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing && e.keyCode !== 229) add()
            }}
            placeholder="Add a comment…"
            className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
          <button
            type="button"
            disabled={pending}
            onClick={add}
            className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            Post
          </button>
        </div>
      </div>
    </div>
  )
}
