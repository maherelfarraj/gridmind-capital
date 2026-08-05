'use client'

import { useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AlertCircle, DollarSign, FileText, CheckCircle2, Clock } from 'lucide-react'
import { G3FormData } from '@/lib/gates/g3-requirements'
import { submitG3FormAction } from '@/app/actions/g3-submissions'

type Props = {
  projectId: string
  projectName: string
  existingSubmission: { formData: G3FormData | null; status: string } | null
}

export function G3CommercialForm({ projectId, projectName, existingSubmission }: Props) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const formData = existingSubmission?.formData
  const isApproved = existingSubmission?.status === 'approved'
  const completionPercentage = formData ? 75 : 0 // Simplified for display

  const handleSubmit = async () => {
    if (!formData) {
      setMessage({ type: 'error', text: 'No form data available' })
      return
    }

    setIsSubmitting(true)
    try {
      const result = await submitG3FormAction(projectId, formData)
      if (result.error) {
        setMessage({ type: 'error', text: result.error })
      } else {
        setMessage({ type: 'success', text: 'G3 submission completed. Pending approval.' })
      }
    } catch (err) {
      setMessage({ type: 'error', text: `Submission failed: ${err instanceof Error ? err.message : 'Unknown error'}` })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader className="pb-3 flex-row items-center gap-3">
          <DollarSign className="w-5 h-5 text-slate-600" />
          <CardTitle>G3: Commercial & Financial Close</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span>Project: {projectName}</span>
            <span className="text-slate-600">
              Completion: {completionPercentage}%
            </span>
          </div>
          {isApproved && (
            <div className="flex items-center gap-2 text-green-700 bg-green-50 p-2 rounded text-sm">
              <CheckCircle2 className="w-4 h-4" />
              Gate Approved — Project Advanced to G4
            </div>
          )}
        </CardContent>
      </Card>



      {/* Budget Summary */}
      <Card>
        <CardHeader className="pb-3 flex-row items-center gap-3">
          <DollarSign className="w-5 h-5 text-slate-600" />
          <CardTitle>Budget Tracking</CardTitle>
        </CardHeader>
        <CardContent>
          {formData?.budget && formData.budget.length > 0 ? (
            <div className="space-y-2 text-sm">
              {formData.budget.map((b) => (
                <div key={b.id} className="flex justify-between">
                  <span>{b.category}</span>
                  <span className="text-slate-600">
                    {b.budgetedAmount ? `$${b.budgetedAmount.toLocaleString()}` : 'Not set'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">No budget data</p>
          )}
        </CardContent>
      </Card>

      {/* Contracts */}
      <Card>
        <CardHeader className="pb-3 flex-row items-center gap-3">
          <FileText className="w-5 h-5 text-slate-600" />
          <CardTitle>Key Contracts</CardTitle>
        </CardHeader>
        <CardContent>
          {formData?.contracts && formData.contracts.length > 0 ? (
            <div className="space-y-2 text-sm">
              {formData.contracts.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-2">
                  <span className="flex-1">{c.contractType}</span>
                  {c.signedDate ? (
                    <span className="flex items-center gap-1 text-green-700">
                      <CheckCircle2 className="w-4 h-4" />
                      Signed
                    </span>
                  ) : (
                    <span className="text-slate-400">Not signed</span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">No contracts</p>
          )}
        </CardContent>
      </Card>

      {/* Financing */}
      <Card>
        <CardHeader className="pb-3 flex-row items-center gap-3">
          <Clock className="w-5 h-5 text-slate-600" />
          <CardTitle>Financing</CardTitle>
        </CardHeader>
        <CardContent>
          {formData?.financing && formData.financing.length > 0 ? (
            <div className="space-y-2 text-sm">
              {formData.financing.map((f) => (
                <div key={f.id} className="flex justify-between">
                  <span>{f.source || 'Unnamed'}</span>
                  <span className="text-slate-600">
                    {f.amount ? `$${f.amount.toLocaleString()}` : 'Not set'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">No financing lines</p>
          )}
        </CardContent>
      </Card>

      {/* Approvals */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Executive Sign-offs</CardTitle>
        </CardHeader>
        <CardContent>
          {formData?.approvals && formData.approvals.length > 0 ? (
            <div className="space-y-2 text-sm">
              {formData.approvals.map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-2">
                  <span>{a.approvalType}</span>
                  {a.signedDate ? (
                    <span className="flex items-center gap-1 text-green-700">
                      <CheckCircle2 className="w-4 h-4" />
                      Signed
                    </span>
                  ) : (
                    <span className="text-slate-400">Not signed</span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">No approvals</p>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-3">
        {!isApproved && (
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !formData}
            className="flex-1"
          >
            {isSubmitting ? 'Submitting...' : 'Submit G3 for Approval'}
          </Button>
        )}
      </div>

      {/* Message */}
      {message && (
        <div
          className={`p-3 rounded text-sm ${
            message.type === 'success'
              ? 'bg-green-50 text-green-800'
              : 'bg-red-50 text-red-800'
          }`}
        >
          {message.text}
        </div>
      )}
    </div>
  )
}
