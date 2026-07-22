'use client'

import * as React from 'react'
import { Download, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

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
 * Captures the element with the given `targetId` via html2canvas,
 * then writes it into a jsPDF document and triggers download.
 */
export function GatePackExportButton({ targetId, gateCode, projectName, className }: GatePackExportProps) {
  const [loading, setLoading] = React.useState(false)

  async function handleExport() {
    setLoading(true)
    try {
      const el = document.getElementById(targetId)
      if (!el) {
        console.error('[v0] GatePackExport: element not found:', targetId)
        setLoading(false)
        return
      }

      // Dynamic imports — only loaded when user clicks
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ])

      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      })

      const imgData = canvas.toDataURL('image/png')
      const pdf     = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

      const pageWidth  = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const imgRatio   = canvas.height / canvas.width
      const imgWidth   = pageWidth - 20
      const imgHeight  = imgWidth * imgRatio

      // Header metadata
      const now   = new Date().toLocaleString('en-GB', { dateStyle: 'long', timeStyle: 'short' })
      const title = `Gate Pack — ${gateCode}${projectName ? ` — ${projectName}` : ''}`
      pdf.setFontSize(11)
      pdf.setFont('helvetica', 'bold')
      pdf.text(title, 10, 12)
      pdf.setFontSize(8)
      pdf.setFont('helvetica', 'normal')
      pdf.setTextColor(120)
      pdf.text(`Exported: ${now}   |   GridMind Capital EPC Platform`, 10, 18)
      pdf.setTextColor(0)

      // If content spans multiple pages
      let yPos = 24
      let remaining = imgHeight

      while (remaining > 0) {
        const sliceHeight = Math.min(remaining, pageHeight - yPos - 10)
        const srcY        = (imgHeight - remaining) / imgHeight * canvas.height
        const srcH        = sliceHeight / imgHeight * canvas.height

        // Crop the slice from canvas
        const sliceCanvas           = document.createElement('canvas')
        sliceCanvas.width           = canvas.width
        sliceCanvas.height          = srcH
        const ctx                   = sliceCanvas.getContext('2d')!
        ctx.drawImage(canvas, 0, -srcY)
        const sliceData             = sliceCanvas.toDataURL('image/png')

        pdf.addImage(sliceData, 'PNG', 10, yPos, imgWidth, sliceHeight)
        remaining -= sliceHeight

        if (remaining > 0) {
          pdf.addPage()
          yPos = 10
        }
      }

      const filename = `gate-pack-${gateCode}-${Date.now()}.pdf`
      pdf.save(filename)
    } catch (err) {
      console.error('[v0] GatePackExport error:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      disabled={loading}
      className={cn(className)}
    >
      {loading
        ? <Loader2 size={14} className="mr-1.5 animate-spin" />
        : <Download size={14} className="mr-1.5" />
      }
      {loading ? 'Generating PDF…' : 'Export Gate Pack'}
    </Button>
  )
}
