'use client'

import * as React from 'react'
import { X, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getProfileSettings, updateProfileSettings } from '@/app/actions/settings'
import { useToast } from '@/components/ui/toast'

interface ProfileEditModalProps {
  open: boolean
  onClose: () => void
}

export function ProfileEditModal({ open, onClose }: ProfileEditModalProps) {
  const { toast } = useToast()
  const [loading, setLoading] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [formData, setFormData] = React.useState({
    fullName: '',
  })

  // Load profile on mount
  React.useEffect(() => {
    if (!open) return
    
    async function loadProfile() {
      try {
        setLoading(true)
        const profile = await getProfileSettings()
        setFormData({
          fullName: profile.fullName,
        })
      } catch (err) {
        toast({
          title: 'Error',
          description: 'Failed to load profile',
          variant: 'danger',
        })
      } finally {
        setLoading(false)
      }
    }

    loadProfile()
  }, [open, toast])

  const handleSave = async () => {
    if (!formData.fullName.trim()) {
      toast({
        title: 'Validation error',
        description: 'Full name is required',
        variant: 'danger',
      })
      return
    }

    try {
      setSaving(true)
      const result = await updateProfileSettings({
        fullName: formData.fullName,
      })

      if (result?.error) {
        toast({
          title: 'Save failed',
          description: result.error,
          variant: 'danger',
        })
      } else {
        toast({
          title: 'Profile saved',
          description: 'Your profile has been updated successfully',
          variant: 'success',
        })
        onClose()
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to save profile',
        variant: 'danger',
      })
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/50"
        onClick={onClose}
        role="presentation"
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-sm rounded-xl border border-border bg-card shadow-lg">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <h2 className="text-lg font-semibold text-foreground">Edit Profile</h2>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Close"
            >
              <X className="size-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-4">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                {/* Full Name */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={formData.fullName}
                    onChange={(e) =>
                      setFormData({ ...formData, fullName: e.target.value })
                    }
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus:ring-1 focus:ring-ring/50"
                    placeholder="Enter your full name"
                    disabled={saving}
                  />
                </div>

                {/* Info text */}
                <p className="text-xs text-muted-foreground pt-2">
                  Only these fields can be edited. Some profile information is managed by administrators.
                </p>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="flex gap-3 border-t border-border px-6 py-4">
            <button
              onClick={onClose}
              disabled={saving}
              className="flex-1 rounded-lg border border-border bg-background text-foreground hover:bg-muted disabled:opacity-60 transition-colors py-2 font-medium text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || loading}
              className={cn(
                'flex-1 rounded-lg text-white font-medium text-sm py-2 transition-colors',
                'bg-primary hover:bg-primary/90 disabled:opacity-60'
              )}
            >
              {saving ? (
                <>
                  <Loader2 className="size-3.5 animate-spin inline mr-2" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
