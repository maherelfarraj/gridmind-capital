'use client'

import * as React from 'react'
import { Download, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useLocale } from 'next-intl'
import { elementToPdf } from '@/lib/pdf/element-to-pdf'

interface GatePackExportProps {
  /** The DOM element id containing the gate pack content to export */
  targetId: string
  /** Gate code e.g. "G2" */
  gateCode: string
  /** Project name */
  projectName?: string
  className?: string
}

/**
 * Client-side Gate Pack PDF export.
 *
 * Delegates to the shared elementToPdf helper, which handles multi-page
 * slicing and — when the active locale is 'ar' — applies direction:rtl plus
 * the Noto Sans Arabic font (loaded via next/font) before html2canvas capture
 * so Arabic text is correctly shaped in the exported PDF.
 */
export function GatePackExportButton({ targetId, gateCode, projectName, className }: GatePackExportProps) {
  const [loading, setLoading] = React.useState(false)
  const locale = useLocale()

  async function handleExport() {
    setLoading(true)
    try {
      const el = document.getElementById(targetId)
      if (!el) {
        setLoading(false)
        return
      }

      const isRtl   = locale === 'ar'
      const now     = new Date().toLocaleString(locale === 'ar' ? 'ar-u-nu-latn' : 'en-GB', {
        dateStyle: 'long',
        timeStyle: 'short',
      })
      const title   = isRtl
        ? `حزمة البوابة — ${gateCode}${projectName ? ` — ${projectName}` : ''}`
        : `Gate Pack — ${gateCode}${projectName ? ` — ${projectName}` : ''}`
      const subtitle = isRtl
        ? `تاريخ التصدير: ${now}   |   منصة GridMind Capital EPC`
        : `Exported: ${now}   |   GridMind Capital EPC Platform`

      const pdf = await elementToPdf(el, {
        headerTitle:    title,
        headerSubtitle: subtitle,
        locale,
      })

      const filename = `gate-pack-${gateCode}-${Date.now()}.pdf`
      pdf.save(filename)
    } catch (err) {
      console.error('[v0] GatePackExport error:', err)
    } finally {
      setLoading(false)
    }
  }

  const exportLabel = locale === 'ar' ? 'تصدير حزمة البوابة' : 'Export Gate Pack'
  const loadingLabel = locale === 'ar' ? 'جارٍ التوليد…' : 'Generating PDF…'

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      disabled={loading}
      className={cn(className)}
    >
      {loading
        ? <Loader2 size={14} className="me-1.5 animate-spin" aria-hidden />
        : <Download size={14} className="me-1.5" aria-hidden />
      }
      {loading ? loadingLabel : exportLabel}
    </Button>
  )
}
