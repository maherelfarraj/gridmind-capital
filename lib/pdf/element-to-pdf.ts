/**
 * Shared client-side helper: capture a DOM element with html2canvas and
 * render it into a multi-page A4 jsPDF document. Returns the jsPDF instance
 * so callers can either `.save(name)` it or extract a base64 data URL for
 * upload. Images inside the element must set crossOrigin="anonymous" and be
 * served with CORS headers so html2canvas can rasterise them (useCORS).
 */
export async function elementToPdf(
  el: HTMLElement,
  opts: { headerTitle?: string; headerSubtitle?: string } = {},
): Promise<import('jspdf').jsPDF> {
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

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const imgWidth = pageWidth - 20
  const imgHeight = (canvas.height / canvas.width) * imgWidth

  let yStart = 10
  if (opts.headerTitle) {
    pdf.setFontSize(11)
    pdf.setFont('helvetica', 'bold')
    pdf.text(opts.headerTitle, 10, 12)
    if (opts.headerSubtitle) {
      pdf.setFontSize(8)
      pdf.setFont('helvetica', 'normal')
      pdf.setTextColor(120)
      pdf.text(opts.headerSubtitle, 10, 18)
      pdf.setTextColor(0)
    }
    yStart = 24
  }

  let yPos = yStart
  let remaining = imgHeight

  while (remaining > 0) {
    const sliceHeight = Math.min(remaining, pageHeight - yPos - 10)
    const srcY = ((imgHeight - remaining) / imgHeight) * canvas.height
    const srcH = (sliceHeight / imgHeight) * canvas.height

    const sliceCanvas = document.createElement('canvas')
    sliceCanvas.width = canvas.width
    sliceCanvas.height = srcH
    const ctx = sliceCanvas.getContext('2d')!
    ctx.drawImage(canvas, 0, -srcY)
    pdf.addImage(sliceCanvas.toDataURL('image/png'), 'PNG', 10, yPos, imgWidth, sliceHeight)

    remaining -= sliceHeight
    if (remaining > 0) {
      pdf.addPage()
      yPos = 10
    }
  }

  return pdf
}

/** Convenience: capture an element and return a base64 PDF data URL. */
export async function elementToPdfDataUrl(
  el: HTMLElement,
  opts?: { headerTitle?: string; headerSubtitle?: string },
): Promise<string> {
  const pdf = await elementToPdf(el, opts)
  return pdf.output('datauristring')
}
