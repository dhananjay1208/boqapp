/**
 * Build a single merged PDF containing all uploaded material compliance documents.
 *
 * Uses jsPDF for the cover + section pages and pdf-lib to merge real PDF files in.
 * Follows the same merge pattern as src/app/reports/mir/page.tsx.
 *
 * Files that are images (jpg/png) are embedded as full pages. Files in formats we
 * can't render (doc/docx/xls/xlsx) get a placeholder page with the filename.
 */
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { supabase } from './supabase'
import { DOC_TYPE_LABELS, type DocType, type MaterialComplianceDoc } from './material-compliance'

interface MaterialLite {
  id: string
  category: string
  name: string
  unit: string
}

interface UploadedItem {
  material: MaterialLite
  docType: DocType
  doc: MaterialComplianceDoc
}

interface Stats {
  uploaded: number
  pending: number
  na: number
  total: number
}

const BUCKET = 'compliance-docs'

function extOf(name: string | null | undefined): string {
  if (!name) return ''
  const i = name.lastIndexOf('.')
  return i >= 0 ? name.slice(i + 1).toLowerCase() : ''
}

async function fetchBytes(filePath: string): Promise<Uint8Array | null> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(filePath, 600)
  if (error || !data) return null
  const res = await fetch(data.signedUrl)
  if (!res.ok) return null
  return new Uint8Array(await res.arrayBuffer())
}

function buildCoverPdf(items: UploadedItem[], stats: Stats): Uint8Array {
  const doc = new jsPDF()

  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.text('Documents Compliance Report', 105, 30, { align: 'center' })

  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  doc.text(`Generated: ${today}`, 105, 40, { align: 'center' })

  autoTable(doc, {
    startY: 55,
    head: [['', 'Count']],
    body: [
      ['Materials under compliance', String(stats.total / 2 || 0)],
      ['Documents uploaded', String(stats.uploaded)],
      ['Documents pending', String(stats.pending)],
      ['Documents marked N/A', String(stats.na)],
    ],
    headStyles: { fillColor: [30, 64, 175] }, // blue-800
    styles: { fontSize: 10 },
    columnStyles: { 0: { cellWidth: 120 }, 1: { halign: 'right', cellWidth: 40 } },
  })

  const afterSummary = (doc as any).lastAutoTable.finalY + 10
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('Documents included', 14, afterSummary)

  const tableBody = items.map((it, i) => [
    String(i + 1),
    it.material.category,
    it.material.name,
    DOC_TYPE_LABELS[it.docType],
    it.doc.file_name ?? '',
  ])
  autoTable(doc, {
    startY: afterSummary + 4,
    head: [['#', 'Category', 'Material', 'Doc Type', 'File']],
    body: tableBody,
    headStyles: { fillColor: [30, 64, 175] },
    styles: { fontSize: 9 },
    columnStyles: {
      0: { cellWidth: 12, halign: 'right' },
      1: { cellWidth: 40 },
      2: { cellWidth: 60 },
      3: { cellWidth: 38 },
      4: { cellWidth: 'auto' },
    },
  })

  return new Uint8Array(doc.output('arraybuffer'))
}

function buildPlaceholderPdf(material: MaterialLite, docType: DocType, fileName: string | null): Uint8Array {
  const doc = new jsPDF()
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text(material.name, 105, 40, { align: 'center' })
  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.text(material.category, 105, 50, { align: 'center' })
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text(DOC_TYPE_LABELS[docType], 105, 80, { align: 'center' })
  doc.setFontSize(10)
  doc.setFont('helvetica', 'italic')
  doc.text(
    `Stored as: ${fileName ?? '—'}`,
    105,
    100,
    { align: 'center', maxWidth: 170 }
  )
  doc.text('This file format cannot be embedded inline. Open it from the app.', 105, 110, {
    align: 'center',
    maxWidth: 170,
  })
  return new Uint8Array(doc.output('arraybuffer'))
}

export async function exportComplianceMergedPdf(items: UploadedItem[], stats: Stats): Promise<void> {
  // Master document.
  const master = await PDFDocument.create()
  const helv = await master.embedFont(StandardFonts.HelveticaBold)
  const helvReg = await master.embedFont(StandardFonts.Helvetica)

  // 1) Cover
  const coverBytes = buildCoverPdf(items, stats)
  const cover = await PDFDocument.load(coverBytes)
  const coverPages = await master.copyPages(cover, cover.getPageIndices())
  coverPages.forEach((p) => master.addPage(p))

  // 2) Per-doc pages
  for (const it of items) {
    if (!it.doc.file_path) continue

    // Section header page
    const section = master.addPage([595.28, 841.89]) // A4 portrait points
    section.drawText(it.material.name, { x: 60, y: 700, size: 22, font: helv, color: rgb(0.1, 0.2, 0.5) })
    section.drawText(it.material.category, { x: 60, y: 670, size: 12, font: helvReg, color: rgb(0.3, 0.3, 0.3) })
    section.drawText(DOC_TYPE_LABELS[it.docType], { x: 60, y: 620, size: 16, font: helv, color: rgb(0.1, 0.1, 0.1) })
    if (it.doc.file_name) {
      section.drawText(`File: ${it.doc.file_name}`, { x: 60, y: 595, size: 10, font: helvReg, color: rgb(0.4, 0.4, 0.4) })
    }
    if (it.doc.uploaded_at) {
      section.drawText(`Uploaded: ${new Date(it.doc.uploaded_at).toLocaleDateString('en-GB')}`, {
        x: 60,
        y: 580,
        size: 10,
        font: helvReg,
        color: rgb(0.4, 0.4, 0.4),
      })
    }

    // Inline the file
    const bytes = await fetchBytes(it.doc.file_path)
    if (!bytes) continue
    const ext = extOf(it.doc.file_name)
    try {
      if (ext === 'pdf') {
        const sub = await PDFDocument.load(bytes, { ignoreEncryption: true })
        const pages = await master.copyPages(sub, sub.getPageIndices())
        pages.forEach((p) => master.addPage(p))
      } else if (ext === 'png') {
        const img = await master.embedPng(bytes)
        addImagePage(master, img)
      } else if (ext === 'jpg' || ext === 'jpeg') {
        const img = await master.embedJpg(bytes)
        addImagePage(master, img)
      } else {
        const placeholder = await PDFDocument.load(
          buildPlaceholderPdf(it.material, it.docType, it.doc.file_name)
        )
        const pages = await master.copyPages(placeholder, placeholder.getPageIndices())
        pages.forEach((p) => master.addPage(p))
      }
    } catch (err) {
      console.error('Failed to embed', it.doc.file_name, err)
      // Don't fail the whole export — drop in a placeholder and keep going.
      const placeholder = await PDFDocument.load(
        buildPlaceholderPdf(it.material, it.docType, it.doc.file_name)
      )
      const pages = await master.copyPages(placeholder, placeholder.getPageIndices())
      pages.forEach((p) => master.addPage(p))
    }
  }

  const out = await master.save()
  triggerDownload(out, `documents-compliance-${todayStr()}.pdf`)
}

function addImagePage(doc: PDFDocument, img: { width: number; height: number; embed?: never } | any) {
  const PAGE_W = 595.28
  const PAGE_H = 841.89
  const MARGIN = 36
  const maxW = PAGE_W - 2 * MARGIN
  const maxH = PAGE_H - 2 * MARGIN
  const scale = Math.min(maxW / img.width, maxH / img.height, 1)
  const w = img.width * scale
  const h = img.height * scale
  const page = doc.addPage([PAGE_W, PAGE_H])
  page.drawImage(img, {
    x: (PAGE_W - w) / 2,
    y: (PAGE_H - h) / 2,
    width: w,
    height: h,
  })
}

function todayStr(): string {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function triggerDownload(bytes: Uint8Array, filename: string): void {
  const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
