import jsPDF from 'jspdf'
import autoTable, { type RowInput } from 'jspdf-autotable'

export interface ChecklistTemplateForPdf {
  name: string
  description?: string | null
  notes_template?: string | null
  signatories: string[]
  items: Array<{
    section: string | null
    item_no: number
    description: string
  }>
}

export interface ChecklistPdfMetadata {
  project?: string
  make?: string
  date?: string
  shopDrawingNo?: string
  boqLineItemNo?: string
  location?: string
  buildingFloor?: string
}

const SLATE_900: [number, number, number] = [15, 23, 42]
const SLATE_700: [number, number, number] = [51, 65, 85]
const SLATE_100: [number, number, number] = [241, 245, 249]
const SLATE_50: [number, number, number] = [248, 250, 252]
const SLATE_500: [number, number, number] = [100, 116, 139]
const SLATE_300: [number, number, number] = [203, 213, 225]
const BLUE_50: [number, number, number] = [219, 234, 254]
const BLUE_900: [number, number, number] = [30, 58, 138]

/**
 * Generate a portrait A4 PDF for a checklist template. Two modes:
 * - filled: metadata values appear next to labels
 * - blank: metadata fields print as labels with underlines for handwriting
 *
 * The Status and Remarks columns are always blank — the printout is meant
 * to be filled in / signed off in the field as evidence of execution.
 */
export function generateChecklistPdf(
  template: ChecklistTemplateForPdf,
  metadata: ChecklistPdfMetadata = {},
  options: { mode: 'filled' | 'blank' } = { mode: 'blank' }
): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 15
  const contentWidth = pageWidth - margin * 2
  const isFilled = options.mode === 'filled'

  // Header band
  doc.setFillColor(...SLATE_900)
  doc.rect(0, 0, pageWidth, 16, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.text(template.name.toUpperCase(), pageWidth / 2, 10, { align: 'center' })
  const generated = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.text(`Generated: ${generated}`, pageWidth - margin, 10, { align: 'right' })

  // Metadata grid: 2 columns × 4 rows
  let currentY = 22
  const labelValuePairs: Array<[string, string | undefined]> = [
    ['Project', metadata.project],
    ['Make', metadata.make],
    ['Shop Drawing No', metadata.shopDrawingNo],
    ['Date', metadata.date],
    ['BOQ Line Item No', metadata.boqLineItemNo],
    ['Location', metadata.location],
    ['Building & Floor', metadata.buildingFloor],
    ['', undefined],
  ]

  doc.setFontSize(9)
  doc.setTextColor(...SLATE_900)
  const colWidth = contentWidth / 2
  const rowHeight = 8
  for (let i = 0; i < labelValuePairs.length; i++) {
    const [label, value] = labelValuePairs[i]
    if (!label) continue
    const colIndex = i % 2
    const rowIndex = Math.floor(i / 2)
    const x = margin + colIndex * colWidth
    const y = currentY + rowIndex * rowHeight
    doc.setFont('helvetica', 'bold')
    doc.text(`${label}:`, x, y + 5)
    const valueX = x + 38
    const valueRight = x + colWidth - 4
    if (isFilled && value) {
      doc.setFont('helvetica', 'normal')
      doc.text(value, valueX, y + 5, { maxWidth: valueRight - valueX })
    } else {
      doc.setDrawColor(...SLATE_300)
      doc.setLineWidth(0.2)
      doc.line(valueX, y + 6, valueRight, y + 6)
    }
  }
  currentY += rowHeight * 4 + 4

  // Items table
  const head: RowInput[] = [
    [
      { content: 'S.No', styles: { halign: 'center' } },
      { content: 'Item Description', styles: { halign: 'left' } },
      { content: 'Status', styles: { halign: 'center' } },
      { content: 'Remarks', styles: { halign: 'left' } },
    ],
  ]

  const body: RowInput[] = []
  let lastSection: string | null | undefined
  for (const item of template.items) {
    if (item.section !== lastSection) {
      lastSection = item.section
      if (item.section) {
        body.push([
          {
            content: item.section,
            colSpan: 4,
            styles: {
              fillColor: BLUE_50,
              textColor: BLUE_900,
              fontStyle: 'bold',
              halign: 'left',
              fontSize: 9,
            },
          },
        ])
      }
    }
    body.push([
      { content: String(item.item_no), styles: { halign: 'center' } },
      item.description,
      '',
      '',
    ])
  }

  autoTable(doc, {
    startY: currentY,
    head,
    body,
    headStyles: {
      fillColor: SLATE_700,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
    },
    bodyStyles: {
      fontSize: 9,
      cellPadding: 2,
      valign: 'middle',
      minCellHeight: 7,
    },
    columnStyles: {
      0: { cellWidth: 14, halign: 'center' },
      1: { cellWidth: 95 },
      2: { cellWidth: 25, halign: 'center' },
      3: { cellWidth: 46 },
    },
    margin: { left: margin, right: margin, top: 18, bottom: 14 },
    didDrawPage: () => {
      const info = doc.getCurrentPageInfo()
      const total = doc.getNumberOfPages()
      doc.setFontSize(8)
      doc.setTextColor(...SLATE_500)
      doc.text(
        `${template.name}  |  Page ${info.pageNumber} of ${total}`,
        pageWidth / 2,
        pageHeight - 6,
        { align: 'center' }
      )
    },
  })

  let finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? currentY

  // Notes block (if template has a notes template)
  if (template.notes_template) {
    if (finalY > pageHeight - 50) {
      doc.addPage()
      finalY = 20
    }
    finalY += 8
    doc.setFillColor(...SLATE_50)
    doc.setDrawColor(...SLATE_300)
    doc.rect(margin, finalY, contentWidth, 18, 'FD')
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...SLATE_900)
    doc.text('Note:', margin + 3, finalY + 5)
    doc.setFont('helvetica', 'normal')
    doc.text(template.notes_template, margin + 3, finalY + 11, {
      maxWidth: contentWidth - 6,
    })
    finalY += 18
  }

  // Signatories table
  if (template.signatories.length > 0) {
    if (finalY > pageHeight - 60) {
      doc.addPage()
      finalY = 20
    }
    finalY += 10
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...SLATE_900)
    doc.text('Clearances Provided By', margin, finalY)
    finalY += 4

    autoTable(doc, {
      startY: finalY,
      head: [['Name', 'Date', 'Signature']],
      body: template.signatories.map((name) => [name, '', '']),
      headStyles: {
        fillColor: SLATE_100,
        textColor: SLATE_900,
        fontStyle: 'bold',
        fontSize: 9,
      },
      bodyStyles: {
        fontSize: 9,
        cellPadding: 3,
        minCellHeight: 11,
      },
      columnStyles: {
        0: { cellWidth: 90 },
        1: { cellWidth: 35, halign: 'center' },
        2: { cellWidth: 55 },
      },
      margin: { left: margin, right: margin },
    })
  }

  return doc
}
