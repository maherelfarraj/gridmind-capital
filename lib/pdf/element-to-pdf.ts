export interface ElementToPdfOptions {
  headerTitle?: string
  headerSubtitle?: string
  /**
   * BCP-47 locale of the generating user.
   * When 'ar', html2canvas captures with direction:rtl and the Arabic font
   * already loaded by next/font (--font-arabic CSS variable), and the jsPDF
   * header text is right-aligned.
   */
  locale?: string
}

/**
 * Shared client-side helper: capture a DOM element with html2canvas and
 * render it into a multi-page A4 jsPDF document. Returns the jsPDF instance
 * so callers can either `.save(name)` it or extract a base64 data URL for
 * upload. Images inside the element must set crossOrigin="anonymous" and be
 * served with CORS headers so html2canvas can rasterise them (useCORS).
 *
 * When locale='ar':
 *  - Temporarily applies direction:rtl + font-family:var(--font-arabic) to
 *    the target element so that html2canvas captures correctly-shaped Arabic.
 *    (next/font has already loaded Noto Sans Arabic onto the page as
 *    --font-arabic, so no extra network request is required.)
 *  - The PDF header title/subtitle are right-aligned.
 */
export async function elementToPdf(
  el: HTMLElement,
  opts: ElementToPdfOptions = {},
): Promise<import('jspdf').jsPDF> {
  const isRtl = opts.locale === 'ar'

  // Temporarily inject a <style> for Arabic capture so that:
  // 1. html2canvas sees the element with direction:rtl and the Arabic font.
  // 2. We revert cleanly after capture regardless of success/failure.
  let injectedStyle: HTMLStyleElement | null = null
  const prevDirection  = el.style.direction
  const prevFontFamily = el.style.fontFamily

  if (isRtl) {
    // Apply inline so they win over Tailwind classes without a style tag.
    el.style.direction  = 'rtl'
    el.style.fontFamily = "var(--font-arabic, 'Noto Sans Arabic'), 'Segoe UI', Arial, sans-serif"

    // Also inject a sheet that cascades into all descendants (table cells, etc.)
    injectedStyle = document.createElement('style')
    injectedStyle.id = '__pdf-rtl-inject__'
    injectedStyle.textContent = `
      #__pdf_capture_target__ * {
        direction: rtl;
        font-family: var(--font-arabic, 'Noto Sans Arabic'), 'Segoe UI', Arial, sans-serif !important;
      }
    `
    // Temporarily give the element an id we can target
    const prevId = el.id
    el.id = '__pdf_capture_target__'
    document.head.appendChild(injectedStyle)
    // Restore id after a microtask so the CSS has time to apply before capture
    await new Promise<void>((r) => requestAnimationFrame(() => { el.id = prevId; r() }))
  }

  let canvas: HTMLCanvasElement
  try {
    const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
      import('html2canvas'),
      import('jspdf'),
    ])

    canvas = await html2canvas(el, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
    })

    // Revert injected RTL styles now that capture is complete.
    if (isRtl) {
      el.style.direction  = prevDirection
      el.style.fontFamily = prevFontFamily
      if (injectedStyle) document.head.removeChild(injectedStyle)
    }

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const pageWidth  = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const margin     = 10
    const imgWidth   = pageWidth - margin * 2
    const imgHeight  = (canvas.height / canvas.width) * imgWidth

    let yStart = margin
    if (opts.headerTitle) {
      pdf.setFontSize(11)
      pdf.setFont('helvetica', 'bold')
      if (isRtl) {
        // Right-align header for RTL PDFs
        pdf.text(opts.headerTitle, pageWidth - margin, 12, { align: 'right' })
      } else {
        pdf.text(opts.headerTitle, margin, 12)
      }
      if (opts.headerSubtitle) {
        pdf.setFontSize(8)
        pdf.setFont('helvetica', 'normal')
        pdf.setTextColor(120)
        if (isRtl) {
          pdf.text(opts.headerSubtitle, pageWidth - margin, 18, { align: 'right' })
        } else {
          pdf.text(opts.headerSubtitle, margin, 18)
        }
        pdf.setTextColor(0)
      }
      yStart = 24
    }

    let yPos      = yStart
    let remaining = imgHeight

    while (remaining > 0) {
      const sliceHeight = Math.min(remaining, pageHeight - yPos - margin)
      const srcY        = ((imgHeight - remaining) / imgHeight) * canvas.height
      const srcH        = (sliceHeight / imgHeight) * canvas.height

      const sliceCanvas = document.createElement('canvas')
      sliceCanvas.width  = canvas.width
      sliceCanvas.height = srcH
      const ctx = sliceCanvas.getContext('2d')!
      ctx.drawImage(canvas, 0, -srcY)
      pdf.addImage(sliceCanvas.toDataURL('image/png'), 'PNG', margin, yPos, imgWidth, sliceHeight)

      remaining -= sliceHeight
      if (remaining > 0) {
        pdf.addPage()
        yPos = margin
      }
    }

    return pdf
  } catch (err) {
    // Always revert styles on error.
    if (isRtl) {
      el.style.direction  = prevDirection
      el.style.fontFamily = prevFontFamily
      if (injectedStyle && injectedStyle.parentNode) document.head.removeChild(injectedStyle)
    }
    throw err
  }
}

/** Convenience: capture an element and return a base64 PDF data URL. */
export async function elementToPdfDataUrl(
  el: HTMLElement,
  opts?: ElementToPdfOptions,
): Promise<string> {
  const pdf = await elementToPdf(el, opts)
  return pdf.output('datauristring')
}
