import { Zap, Stamp, CheckCircle2 } from 'lucide-react'
import type { Role } from '@/lib/db/types'
import type { RoleSignoffDuty } from '@/lib/db/queries'

interface RoleDetailProps {
  role: Role & { department_code: string; department_name: string }
  signoffDuties: RoleSignoffDuty[]
  raciDuties: { gate_code: string; deliverable_title: string; letter: string; sort_order: number }[]
}

const LETTER_STYLES: Record<string, string> = {
  A: 'bg-primary/15 text-primary border-primary/30',
  'A/R': 'bg-primary/15 text-primary border-primary/30',
  R: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
  C: 'bg-muted text-muted-foreground border-border',
  I: 'bg-muted text-muted-foreground border-border',
}

function LetterBadge({ letter }: { letter: string }) {
  return (
    <span
      className={`inline-flex min-w-[2.25rem] items-center justify-center rounded border px-1.5 py-0.5 font-mono text-[11px] font-semibold ${
        LETTER_STYLES[letter] ?? LETTER_STYLES.I
      }`}
    >
      {letter}
    </span>
  )
}

export function RoleDetail({ role, signoffDuties, raciDuties }: RoleDetailProps) {
  const approverCount = signoffDuties.filter((d) => d.is_approver).length

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <header className="flex flex-col gap-3 rounded-lg border border-border bg-card p-5">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-mono text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {role.code}
          </span>
          <h1 className="text-lg font-semibold text-foreground">{role.title}</h1>
          {role.is_bess_critical && (
            <span
              className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-500"
              title="BESS-critical role"
            >
              <Zap size={12} aria-hidden="true" />
              BESS-critical
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
          <span>
            Department: <span className="text-foreground">{role.department_name}</span>
          </span>
          <span>
            Gate sign-offs: <span className="text-foreground">{signoffDuties.length}</span>
          </span>
          <span>
            As approver: <span className="text-foreground">{approverCount}</span>
          </span>
        </div>
        {role.mission && (
          <p className="text-pretty text-sm leading-relaxed text-muted-foreground">{role.mission}</p>
        )}
      </header>

      {/* Gate sign-off duties */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Stamp size={16} className="text-primary" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-foreground">Gate sign-off duties</h2>
        </div>
        {signoffDuties.length === 0 ? (
          <p className="rounded-lg border border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
            This role holds no gate sign-off duties.
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th scope="col" className="px-4 py-3 font-medium">Gate</th>
                  <th scope="col" className="px-4 py-3 font-medium">Milestone</th>
                  <th scope="col" className="px-4 py-3 text-center font-medium">RACI</th>
                  <th scope="col" className="px-4 py-3 text-center font-medium">Approver</th>
                </tr>
              </thead>
              <tbody>
                {signoffDuties.map((d) => (
                  <tr key={d.gate_code} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-foreground">
                      {d.gate_code}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{d.gate_name}</td>
                    <td className="px-4 py-3 text-center">
                      <LetterBadge letter={d.letter} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      {d.is_approver ? (
                        <span className="inline-flex items-center gap-1 text-primary">
                          <CheckCircle2 size={15} aria-hidden="true" />
                          <span className="sr-only">Yes</span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* RACI duties */}
      {raciDuties.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-foreground">
            RACI deliverable duties
            <span className="ms-2 font-normal text-muted-foreground">({raciDuties.length})</span>
          </h2>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[520px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th scope="col" className="px-4 py-3 font-medium">Gate</th>
                  <th scope="col" className="px-4 py-3 font-medium">Deliverable</th>
                  <th scope="col" className="px-4 py-3 text-center font-medium">RACI</th>
                </tr>
              </thead>
              <tbody>
                {raciDuties.map((d, i) => (
                  <tr key={`${d.gate_code}-${i}`} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-foreground">
                      {d.gate_code}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{d.deliverable_title}</td>
                    <td className="px-4 py-3 text-center">
                      <LetterBadge letter={d.letter} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}
