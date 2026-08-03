import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * These tests never connect to a database. They parse the ACTUAL policy
 * predicates out of the P0 migration file and evaluate them with a small
 * SQL three-valued-logic interpreter, so a semantic regression in the
 * migration fails the suite rather than a hand-copied restatement of it.
 */

const MIGRATION = join(
  process.cwd(),
  'supabase/migrations/20260801095527_p0_identity_and_dml_lockdown.sql',
)

const sql = readFileSync(MIGRATION, 'utf8')

// ---------------------------------------------------------------------------
// Extraction: pull the USING (...) predicate for a named policy
// ---------------------------------------------------------------------------

function extractUsing(policyName: string): string {
  const start = sql.indexOf(`CREATE POLICY ${policyName}`)
  if (start === -1) throw new Error(`policy not found: ${policyName}`)
  const usingIdx = sql.indexOf('USING (', start)
  if (usingIdx === -1) throw new Error(`USING not found for ${policyName}`)

  let depth = 0
  let i = usingIdx + 'USING '.length
  const open = i
  for (; i < sql.length; i++) {
    if (sql[i] === '(') depth++
    else if (sql[i] === ')') {
      depth--
      if (depth === 0) break
    }
  }
  return sql
    .slice(open + 1, i)
    .replace(/--[^\n]*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// ---------------------------------------------------------------------------
// Three-valued logic
// ---------------------------------------------------------------------------

type TV = true | false | null

const and3 = (a: TV, b: TV): TV =>
  a === false || b === false ? false : a === null || b === null ? null : true
const or3 = (a: TV, b: TV): TV =>
  a === true || b === true ? true : a === null || b === null ? null : false
const not3 = (a: TV): TV => (a === null ? null : !a)

interface Caller {
  /** result of public.get_my_tenant_id() — NULL when inactive/tenantless/unprovisioned */
  tenantId: string | null
  /** result of public.is_external_role() */
  isExternal: boolean
  /** project ids with a live row in external_access */
  granted: string[]
}

interface Row {
  id?: string
  tenant_id?: string | null
  project_id?: string
}

/** rows visible to the EXISTS subquery over public.projects */
interface World {
  projects: Row[]
}

// ---------------------------------------------------------------------------
// Atom table. Every atom the migration is allowed to use must be listed here;
// anything else makes the predicate unparseable and fails the test.
// ---------------------------------------------------------------------------

type AtomFn = (c: Caller, target: Row, inner: Row | null) => TV

const eqTenant = (rowTenant: string | null | undefined, c: Caller): TV =>
  c.tenantId === null || rowTenant === null || rowTenant === undefined
    ? null
    : rowTenant === c.tenantId

const ATOMS: Record<string, AtomFn> = {
  'tenant_id = public.get_my_tenant_id()': (c, t) => eqTenant(t.tenant_id, c),
  'p.tenant_id = public.get_my_tenant_id()': (c, _t, i) => eqTenant(i?.tenant_id, c),
  'p.id = phase_gates.project_id': (_c, t, i) => i?.id === t.project_id,
  'public.is_external_role()': (c) => c.isExternal,
  'public.has_external_access(projects.id)': (c, t) => c.granted.includes(t.id ?? ''),
  'public.has_external_access(p.id)': (c, _t, i) => c.granted.includes(i?.id ?? ''),
}

// ---------------------------------------------------------------------------
// Tiny recursive-descent evaluator over: ( ) NOT AND OR EXISTS <atom>
// ---------------------------------------------------------------------------

const EXISTS_RE = /EXISTS \( SELECT 1 FROM public\.projects p WHERE /

function evaluate(pred: string, c: Caller, target: Row, world: World, inner: Row | null = null): TV {
  // Resolve EXISTS subqueries first, innermost text located by scanning parens.
  const m = EXISTS_RE.exec(pred)
  if (m) {
    const openIdx = pred.indexOf('(', m.index)
    let depth = 0
    let j = openIdx
    for (; j < pred.length; j++) {
      if (pred[j] === '(') depth++
      else if (pred[j] === ')') {
        depth--
        if (depth === 0) break
      }
    }
    const body = pred.slice(m.index + m[0].length, j).trim()
    const anyRow = world.projects.some(
      (row) => evaluate(body, c, target, world, row) === true,
    )
    const replaced = `${pred.slice(0, m.index)}${anyRow ? '__TRUE__' : '__FALSE__'}${pred.slice(j + 1)}`
    return evaluate(replaced, c, target, world, inner)
  }

  // Substitute atoms with placeholders.
  let work = pred
  const values: TV[] = []
  const literals: Array<[string, TV]> = [
    ['__TRUE__', true],
    ['__FALSE__', false],
  ]
  for (const [text, tv] of literals) {
    while (work.includes(text)) {
      work = work.replace(text, `#${values.length}`)
      values.push(tv)
    }
  }
  // Longest atom first so no atom is a prefix of another.
  for (const key of Object.keys(ATOMS).sort((a, b) => b.length - a.length)) {
    while (work.includes(key)) {
      work = work.replace(key, `#${values.length}`)
      values.push(ATOMS[key](c, target, inner))
    }
  }

  const residue = work.replace(/#\d+|AND|OR|NOT|[()\s]/g, '')
  if (residue.length > 0) {
    throw new Error(`unrecognized predicate fragment: "${residue}" in: ${pred}`)
  }

  const tokens = work.match(/#\d+|AND|OR|NOT|\(|\)/g) ?? []
  let pos = 0
  const peek = () => tokens[pos]

  function parsePrimary(): TV {
    const t = tokens[pos]
    if (t === '(') {
      pos++
      const v = parseOr()
      pos++ // ')'
      return v
    }
    if (t === 'NOT') {
      pos++
      return not3(parsePrimary())
    }
    pos++
    return values[Number(t.slice(1))]
  }
  function parseAnd(): TV {
    let v = parsePrimary()
    while (peek() === 'AND') {
      pos++
      v = and3(v, parsePrimary())
    }
    return v
  }
  function parseOr(): TV {
    let v = parseAnd()
    while (peek() === 'OR') {
      pos++
      v = or3(v, parseAnd())
    }
    return v
  }

  return parseOr()
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const T1 = 'tenant-1'
const T2 = 'tenant-2'
const P_GRANTED = 'project-granted'
const P_UNGRANTED = 'project-ungranted'
const P_OTHER_TENANT = 'project-other-tenant'

const world: World = {
  projects: [
    { id: P_GRANTED, tenant_id: T1 },
    { id: P_UNGRANTED, tenant_id: T1 },
    { id: P_OTHER_TENANT, tenant_id: T2 },
  ],
}

const internal: Caller = { tenantId: T1, isExternal: false, granted: [] }
const subcontractor: Caller = { tenantId: T1, isExternal: true, granted: [P_GRANTED] }
const clientViewer: Caller = { tenantId: T1, isExternal: true, granted: [P_GRANTED] }
/** inactive or tenantless => get_my_tenant_id() is NULL */
const inactiveExternal: Caller = { tenantId: null, isExternal: true, granted: [P_GRANTED] }
const tenantlessExternal: Caller = { tenantId: null, isExternal: true, granted: [] }

const projectsPred = extractUsing('projects_select_tenant')
const approvalsPred = extractUsing('approvals_select_tenant')
const gatesPred = extractUsing('phase_gates_select_tenant')

const canReadProject = (c: Caller, id: string, tenant: string) =>
  evaluate(projectsPred, c, { id, tenant_id: tenant }, world) === true

const canReadApproval = (c: Caller, tenant: string) =>
  evaluate(approvalsPred, c, { id: 'approval-1', tenant_id: tenant }, world) === true

const canReadGate = (c: Caller, projectId: string) =>
  evaluate(gatesPred, c, { id: 'gate-1', project_id: projectId }, world) === true

// ---------------------------------------------------------------------------

describe('P0 core SELECT policies — external-user project scoping', () => {
  it('1. internal same-tenant user can read tenant projects', () => {
    expect(canReadProject(internal, P_GRANTED, T1)).toBe(true)
    expect(canReadProject(internal, P_UNGRANTED, T1)).toBe(true)
  })

  it('2. internal user cannot read another tenant', () => {
    expect(canReadProject(internal, P_OTHER_TENANT, T2)).toBe(false)
    expect(canReadApproval(internal, T2)).toBe(false)
  })

  it('3. subcontractor can read an explicitly assigned project', () => {
    expect(canReadProject(subcontractor, P_GRANTED, T1)).toBe(true)
  })

  it('4. subcontractor cannot read an unassigned same-tenant project', () => {
    expect(canReadProject(subcontractor, P_UNGRANTED, T1)).toBe(false)
  })

  it('5. client_viewer can read an explicitly assigned project', () => {
    expect(canReadProject(clientViewer, P_GRANTED, T1)).toBe(true)
  })

  it('6. client_viewer cannot read an unassigned same-tenant project', () => {
    expect(canReadProject(clientViewer, P_UNGRANTED, T1)).toBe(false)
  })

  it('7. external user cannot read approvals, granted project or not', () => {
    expect(canReadApproval(subcontractor, T1)).toBe(false)
    expect(canReadApproval(clientViewer, T1)).toBe(false)
    expect(canReadApproval(internal, T1)).toBe(true)
  })

  it('8. external user reads phase_gates only for an assigned project', () => {
    expect(canReadGate(subcontractor, P_GRANTED)).toBe(true)
    expect(canReadGate(subcontractor, P_UNGRANTED)).toBe(false)
    expect(canReadGate(clientViewer, P_GRANTED)).toBe(true)
    expect(canReadGate(clientViewer, P_UNGRANTED)).toBe(false)
    expect(canReadGate(internal, P_UNGRANTED)).toBe(true)
    expect(canReadGate(internal, P_OTHER_TENANT)).toBe(false)
  })

  it('9. inactive external user reads nothing', () => {
    expect(canReadProject(inactiveExternal, P_GRANTED, T1)).toBe(false)
    expect(canReadApproval(inactiveExternal, T1)).toBe(false)
    expect(canReadGate(inactiveExternal, P_GRANTED)).toBe(false)
  })

  it('10. tenantless external user reads nothing', () => {
    expect(canReadProject(tenantlessExternal, P_GRANTED, T1)).toBe(false)
    expect(canReadApproval(tenantlessExternal, T1)).toBe(false)
    expect(canReadGate(tenantlessExternal, P_GRANTED)).toBe(false)
  })
})

describe('P0 migration structural invariants', () => {
  const stripped = sql.replace(/--[^\n]*/g, '')

  it('creates exactly five policies', () => {
    expect(stripped.match(/CREATE POLICY/g)?.length).toBe(5)
  })

  it('creates no additional permissive external policy that would OR-widen', () => {
    expect(stripped).not.toMatch(/CREATE POLICY \w*external/i)
  })

  it('uses the canonical external helpers, schema-qualified', () => {
    expect(stripped).toContain('public.is_external_role()')
    expect(stripped).toContain('public.has_external_access(')
    // no second external-access model invented
    expect(stripped).not.toMatch(/CREATE (OR REPLACE )?FUNCTION public\.(is_external_role|has_external_access)/)
  })

  it('grants EXECUTE on the helpers to authenticated only', () => {
    expect(stripped).toMatch(/REVOKE EXECUTE ON FUNCTION public\.is_external_role\(\)\s+FROM PUBLIC, anon;/)
    expect(stripped).toMatch(/REVOKE EXECUTE ON FUNCTION public\.has_external_access\(uuid\)\s+FROM PUBLIC, anon;/)
    expect(stripped).toMatch(/GRANT\s+EXECUTE ON FUNCTION public\.is_external_role\(\)\s+TO authenticated;/)
    expect(stripped).toMatch(/GRANT\s+EXECUTE ON FUNCTION public\.has_external_access\(uuid\)\s+TO authenticated;/)
  })

  it('does not grant browser DML on any non-core table', () => {
    const grants = stripped.match(/GRANT [^;]*TO (anon|authenticated)[^;]*;/g) ?? []
    for (const g of grants) {
      if (!/ON (TABLE|FUNCTION)/.test(g)) continue
      if (/ON FUNCTION/.test(g)) continue
      expect(g).toMatch(/public\.(profiles|projects|approvals|phase_gates)/)
    }
  })
})
