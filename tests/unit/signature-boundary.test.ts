import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Structural guards for the signature-storage boundary.
 *
 * These assert properties that unit tests on a single module cannot: that a
 * dangerous export is gone from the WHOLE repository, that no second bucket name
 * has reappeared, and that the approval detail page does not request signatures
 * for an approval kind that has no signature surface.
 *
 * A structural guard is the right tool here because each defect is an absence —
 * and an absence is only provable by searching everywhere it could reappear.
 */

const ROOT = join(__dirname, '..', '..')
const SCAN_DIRS = ['app', 'lib', 'components', 'hooks', 'tests']
const SKIP_DIRS = new Set(['node_modules', '.next', '.git', 'dist', 'build'])

function collectSourceFiles(dir: string, out: string[] = []): string[] {
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return out
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry)) continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      collectSourceFiles(full, out)
    } else if (/\.(ts|tsx)$/.test(entry)) {
      out.push(full)
    }
  }
  return out
}

const sourceFiles = SCAN_DIRS.flatMap((d) => collectSourceFiles(join(ROOT, d)))
const withSource = sourceFiles.map((path) => ({ path, text: readFileSync(path, 'utf8') }))

// This file legitimately names the symbols it forbids, so exclude itself.
const others = withSource.filter((f) => !f.path.endsWith('signature-boundary.test.ts'))

describe('removeStagedGateSignature is fully removed', () => {
  it('has ZERO references anywhere in the repository', () => {
    const offenders = others
      .filter((f) => f.text.includes('removeStagedGateSignature'))
      .map((f) => f.path.replace(ROOT + '/', ''))
    // An exported delete-by-path server action is an arbitrary-path deletion
    // primitive reachable from any client. It must not exist, and no caller,
    // mock, or comment may keep the name alive as a re-entry point.
    expect(offenders).toEqual([])
  })

  it('scanned a realistic number of files (the scan itself is not vacuous)', () => {
    // Guards against a broken walker silently making every absence "pass".
    expect(others.length).toBeGreaterThan(50)
  })
})

describe('the retired signature-cleanup module is gone', () => {
  it('has ZERO imports of lib/approvals/signature-cleanup', () => {
    const offenders = others
      .filter((f) => f.text.includes('approvals/signature-cleanup'))
      .map((f) => f.path.replace(ROOT + '/', ''))
    expect(offenders).toEqual([])
  })
})

describe('one canonical bucket owner', () => {
  it('only the canonical module names a signature bucket', () => {
    // `app/actions/signatures.ts` previously declared its own BUCKET, which
    // drifted from the cleanup path's bucket and broke deletion entirely.
    const signaturesAction = withSource.find((f) =>
      f.path.endsWith(join('app', 'actions', 'signatures.ts')),
    )
    expect(signaturesAction).toBeDefined()
    expect(signaturesAction!.text).not.toMatch(/const\s+BUCKET\s*=/)
  })

  it('the canonical module declares the documents bucket exactly once', () => {
    const canonical = withSource.find((f) =>
      f.path.endsWith(join('lib', 'approvals', 'signature-storage.ts')),
    )
    expect(canonical).toBeDefined()
    const declarations = canonical!.text.match(/SIGNATURE_BUCKET\s*=\s*'[^']+'/g) ?? []
    expect(declarations).toEqual(["SIGNATURE_BUCKET = 'documents'"])
  })
})

describe('approval detail page — signatures are not requested for unsupported types', () => {
  const page = withSource.find((f) =>
    f.path.endsWith(join('approvals', '[id]', 'page.tsx')),
  )

  it('found the page', () => {
    expect(page).toBeDefined()
  })

  it('gates the signature fetch on gate|opportunity, not on "not not_found"', () => {
    // The old key was `routed.kind !== 'not_found'`, which INCLUDES
    // 'unsupported' — a purchase_order or change_order would issue a privileged
    // signature read for a view that renders no signatures at all.
    expect(page!.text).not.toMatch(/kind\s*!==\s*'not_found'/)
    expect(page!.text).toMatch(/routed\?\.kind === 'gate' \|\| routed\?\.kind === 'opportunity'/)
  })

  it('the SWR key is null unless the kind can render signatures', () => {
    expect(page!.text).toMatch(/id && canLoadSignatures \?/)
  })
})
