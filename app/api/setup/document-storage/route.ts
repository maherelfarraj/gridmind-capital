/**
 * GET /api/setup/document-storage
 * Idempotent DDL: creates document_files table + ensures storage bucket.
 * Call once after deploy: fetch('/api/setup/document-storage')
 */
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ensureStorageBucket } from '@/app/actions/storage'

export async function GET() {
  const supabase = createAdminClient()

  const ddl = `
    CREATE TABLE IF NOT EXISTS document_files (
      id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id     uuid        NOT NULL,
      project_id    uuid        REFERENCES projects(id) ON DELETE SET NULL,
      project_code  text,
      storage_path  text        NOT NULL,
      file_name     text        NOT NULL,
      title         text,
      code          text,
      category      text        NOT NULL DEFAULT 'general',
      size_bytes    bigint,
      mime_type     text,
      uploaded_by   text,
      status        text        NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft','ifr','ifa','ifc','superseded')),
      created_at    timestamptz NOT NULL DEFAULT now(),
      updated_at    timestamptz NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_document_files_tenant
      ON document_files(tenant_id);

    CREATE INDEX IF NOT EXISTS idx_document_files_project
      ON document_files(project_id);
  `

  const { error } = await supabase.rpc('exec_sql', { sql: ddl }).single().catch(() => ({ error: null }))

  // Fallback: try direct query if exec_sql RPC doesn't exist
  if (error) {
    // The table may already exist — check
    const { error: checkError } = await supabase.from('document_files').select('id').limit(1)
    if (checkError && checkError.code === '42P01') {
      return NextResponse.json({ ok: false, error: 'Table does not exist and could not be created. Run the DDL manually in Supabase SQL Editor.', ddl }, { status: 500 })
    }
  }

  await ensureStorageBucket()

  return NextResponse.json({ ok: true, message: 'document_files table and documents bucket ready.' })
}
