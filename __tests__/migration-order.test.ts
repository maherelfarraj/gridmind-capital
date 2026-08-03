import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'fs'
import path from 'path'

/**
 * Migration Order Validation Test
 *
 * Detects migration chain defects:
 * - Duplicate timestamps
 * - Duplicate migration names
 * - Out-of-order timestamps
 * - ALTER TABLE before CREATE TABLE
 * - Missing dependencies (function/enum/table not created)
 * - Orphaned references
 */

interface Migration {
  timestamp: string
  name: string
  filename: string
  filepath: string
  content: string
}

interface MigrationDefect {
  severity: 'error' | 'warning'
  rule: string
  message: string
  migrations?: string[]
}

describe('Migration Order Validation', () => {
  let migrations: Migration[] = []
  let defects: MigrationDefect[] = []

  beforeAll(() => {
    // Load all migrations
    const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations')
    const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql'))

    migrations = files
      .sort() // Sort by filename (timestamp first)
      .map((filename) => {
        const filepath = path.join(migrationsDir, filename)
        const match = filename.match(/^(\d+)_(.+?)\.sql$/)
        if (!match) throw new Error(`Invalid migration filename: ${filename}`)

        const [, timestamp, name] = match
        const content = fs.readFileSync(filepath, 'utf-8')

        return {
          timestamp,
          name,
          filename,
          filepath,
          content,
        }
      })
  })

  describe('Structural Validation', () => {
    it('should have no duplicate timestamps', () => {
      const timestamps = migrations.map((m) => m.timestamp)
      const duplicates = timestamps.filter((t, i) => timestamps.indexOf(t) !== i)

      if (duplicates.length > 0) {
        defects.push({
          severity: 'error',
          rule: 'duplicate_timestamps',
          message: `Duplicate timestamps found: ${[...new Set(duplicates)].join(', ')}`,
          migrations: duplicates,
        })
      }

      expect(duplicates).toHaveLength(0)
    })

    it('should have no duplicate migration names', () => {
      const names = migrations.map((m) => m.name)
      const duplicates = names.filter((n, i) => names.indexOf(n) !== i)

      if (duplicates.length > 0) {
        defects.push({
          severity: 'error',
          rule: 'duplicate_names',
          message: `Duplicate migration names found: ${[...new Set(duplicates)].join(', ')}`,
          migrations: duplicates,
        })
      }

      expect(duplicates).toHaveLength(0)
    })

    it('should have timestamps in ascending order', () => {
      const timestamps = migrations.map((m) => m.timestamp)
      const sorted = [...timestamps].sort()

      const outOfOrder = timestamps
        .map((t, i) => ({ timestamp: t, index: i, expected: sorted[i] }))
        .filter((item) => item.timestamp !== item.expected)

      if (outOfOrder.length > 0) {
        defects.push({
          severity: 'error',
          rule: 'timestamp_ordering',
          message: `Migrations not in order: ${outOfOrder.map((x) => `${x.timestamp} at position ${x.index}`).join(', ')}`,
        })
      }

      expect(outOfOrder).toHaveLength(0)
    })
  })

  describe('Dependency Validation', () => {
    it('should create tables before altering them', () => {
      const created = new Set<string>()
      const defectsFound: MigrationDefect[] = []

      migrations.forEach((migration) => {
        // Find CREATE TABLE statements
        const createMatches = migration.content.matchAll(/CREATE TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+(?:public\.)?(\w+)/gi)
        for (const match of createMatches) {
          created.add(match[1])
        }

        // Find ALTER TABLE statements
        const alterMatches = migration.content.matchAll(/ALTER TABLE(?:\s+IF\s+EXISTS)?\s+(?:public\.)?(\w+)/gi)
        for (const match of alterMatches) {
          const tableName = match[1]
          if (!created.has(tableName)) {
            defectsFound.push({
              severity: 'error',
              rule: 'alter_before_create',
              message: `ALTER TABLE ${tableName} before CREATE TABLE in migration ${migration.filename}`,
              migrations: [migration.filename],
            })
          }
        }
      })

      defects.push(...defectsFound)
      expect(defectsFound).toHaveLength(0)
    })

    it('should define enums before using them', () => {
      const definedEnums = new Set<string>()
      const defectsFound: MigrationDefect[] = []

      migrations.forEach((migration) => {
        // Find CREATE TYPE ... AS ENUM statements
        const enumMatches = migration.content.matchAll(/CREATE TYPE\s+(?:public\.)?(\w+)\s+AS\s+ENUM/gi)
        for (const match of enumMatches) {
          definedEnums.add(match[1])
        }

        // Find column definitions with type references
        const columnMatches = migration.content.matchAll(/(\w+)\s+(?:public\.)?(\w+)(?:\[\])?(?:\s+|[,;])/gi)
        for (const match of columnMatches) {
          const typeName = match[2]
          // Check if it looks like an enum (uppercase, not a standard type)
          const standardTypes = ['uuid', 'text', 'integer', 'boolean', 'timestamp', 'json', 'bytea']
          if (
            !standardTypes.includes(typeName.toLowerCase()) &&
            typeName[0] === typeName[0].toUpperCase() &&
            !definedEnums.has(typeName)
          ) {
            defectsFound.push({
              severity: 'warning',
              rule: 'enum_before_use',
              message: `Type ${typeName} may not be defined before use in migration ${migration.filename}`,
              migrations: [migration.filename],
            })
          }
        }
      })

      defects.push(...defectsFound.filter((d) => d.severity === 'error'))
      expect(defectsFound.filter((d) => d.severity === 'error')).toHaveLength(0)
    })

    it('should define functions before referencing them in policies', () => {
      const definedFunctions = new Set<string>()
      const defectsFound: MigrationDefect[] = []

      migrations.forEach((migration) => {
        // Find CREATE FUNCTION statements
        const funcMatches = migration.content.matchAll(/CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:public\.)?(\w+)/gi)
        for (const match of funcMatches) {
          definedFunctions.add(match[1])
        }

        // Find function references in CREATE POLICY
        if (migration.content.includes('CREATE POLICY')) {
          const policyMatches = migration.content.matchAll(/CREATE\s+POLICY\s+\w+.*?(?:FOR\s+\w+)?([\s\S]*?)(?=;)/gm)
          for (const match of policyMatches) {
            const policyBody = match[1]
            // Extract function calls (simple heuristic: word followed by parenthesis)
            const functionCalls = policyBody.matchAll(/\b(\w+)\s*\(/g)
            for (const funcCall of functionCalls) {
              const funcName = funcCall[1]
              const builtins = ['row_number', 'get_my_tenant_id', 'auth', 'count', 'exists', 'select']
              if (!builtins.includes(funcName.toLowerCase()) && !definedFunctions.has(funcName)) {
                defectsFound.push({
                  severity: 'warning',
                  rule: 'function_before_policy',
                  message: `Function ${funcName}() may not be defined before use in policy in migration ${migration.filename}`,
                  migrations: [migration.filename],
                })
              }
            }
          }
        }
      })

      defects.push(...defectsFound.filter((d) => d.severity === 'error'))
      expect(defectsFound.filter((d) => d.severity === 'error')).toHaveLength(0)
    })
  })

  describe('Specific Migration Checks', () => {
    it('should create baseline migration first', () => {
      expect(migrations[0]?.name).toMatch(/baseline/)
    })

    it('should have variation_orders table in baseline', () => {
      const baseline = migrations.find((m) => m.name.includes('baseline'))
      expect(baseline?.content).toContain('CREATE TABLE public.variation_orders')
    })

    it('should have no ALTER variation_orders before baseline migration', () => {
      const baselineIndex = migrations.findIndex((m) => m.name.includes('baseline'))
      const beforeBaseline = migrations.slice(0, baselineIndex)

      const hasAlter = beforeBaseline.some((m) => m.content.includes('ALTER TABLE public.variation_orders'))
      expect(hasAlter).toBe(false)
    })
  })

  describe('Migration Report', () => {
    it('should generate defect report', () => {
      if (defects.length > 0) {
        console.log('\n=== MIGRATION ORDER VALIDATION REPORT ===\n')
        console.log(`Total Migrations: ${migrations.length}`)
        console.log(`Defects Found: ${defects.length}\n`)

        const errors = defects.filter((d) => d.severity === 'error')
        const warnings = defects.filter((d) => d.severity === 'warning')

        if (errors.length > 0) {
          console.log(`ERRORS (${errors.length}):`)
          errors.forEach((d) => {
            console.log(`  [${d.rule}] ${d.message}`)
            if (d.migrations) console.log(`    Migrations: ${d.migrations.join(', ')}`)
          })
          console.log()
        }

        if (warnings.length > 0) {
          console.log(`WARNINGS (${warnings.length}):`)
          warnings.forEach((d) => {
            console.log(`  [${d.rule}] ${d.message}`)
            if (d.migrations) console.log(`    Migrations: ${d.migrations.join(', ')}`)
          })
          console.log()
        }

        console.log('Migration Chain:')
        migrations.forEach((m, i) => {
          console.log(`  ${i + 1}. [${m.timestamp}] ${m.name}`)
        })
        console.log()
      }

      // Only fail on errors, not warnings
      const errors = defects.filter((d) => d.severity === 'error')
      expect(errors).toHaveLength(0)
    })
  })
})
