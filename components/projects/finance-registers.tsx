'use client'

import { ShieldCheck, Landmark } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { GuaranteesRegister } from '@/components/projects/guarantees-register'
import { RetentionRegister } from '@/components/projects/retention-register'

export function FinanceRegisters({ projectId }: { projectId: string }) {
  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-balance">Finance Registers</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Bank guarantees &amp; bonds and the retention register — with expiry tracking, discharge, and release workflows.
        </p>
      </header>

      <Tabs defaultValue="guarantees">
        <TabsList>
          <TabsTrigger value="guarantees"><ShieldCheck className="size-4" /> Guarantees</TabsTrigger>
          <TabsTrigger value="retention"><Landmark className="size-4" /> Retention</TabsTrigger>
        </TabsList>
        <TabsContent value="guarantees" className="pt-6">
          <GuaranteesRegister projectId={projectId} />
        </TabsContent>
        <TabsContent value="retention" className="pt-6">
          <RetentionRegister projectId={projectId} />
        </TabsContent>
      </Tabs>
    </main>
  )
}
