import * as XLSX from 'xlsx'

export interface ParsedLineItem {
  itemNumber: string      // e.g., "1.1", "1.2", "2.1"
  description: string
  location: string
  unit: string
  quantity: number
  rate?: number | null
  totalAmount?: number | null
  gstAmount?: number | null
  totalAmountWithGst?: number | null
  actualQuantity?: number | null
  actualAmount?: number | null
  actualAmountWithGst?: number | null
}

export interface ParsedHeadline {
  serialNumber: number    // e.g., 1, 2, 3
  name: string
  lineItems: ParsedLineItem[]
}

export interface ParsedBOQ {
  packageName: string
  headlines: ParsedHeadline[]
  hasRaBillingData: boolean
}

export interface ParseResult {
  success: boolean
  data?: ParsedBOQ[]
  error?: string
  warnings?: string[]
}

/**
 * Check if a number is a whole number (integer)
 */
function isWholeNumber(value: number): boolean {
  return Number.isInteger(value)
}

/**
 * Parse a numeric value from a cell, returning null for empty/NaN
 */
function parseNumericCell(value: any): number | null {
  if (value === undefined || value === null || value === '') return null
  const num = typeof value === 'number' ? value : parseFloat(String(value))
  return isNaN(num) ? null : num
}

/**
 * Check if a description looks like a total row
 */
function isTotalRow(description: string): boolean {
  const lower = description.toLowerCase().trim()
  return lower.includes('total') || lower.includes('sub total') || lower.includes('grand total') || lower.includes('subtotal')
}

/**
 * Parse BOQ Excel file based on template structure:
 * Column A (0): S.No (whole number = headline, decimal = line item)
 * Column B (1): Description
 * Column C (2): LOCATION
 * Column D (3): Unit
 * Column E (4): Quantity
 * Extended template adds:
 * Column F (5): Rate
 * Column G (6): Total Amount
 * Column H (7): GST Amount
 * Column I (8): Total Amount with GST
 * Column J (9): Actual Quantity
 * Column K (10): Actual Amount
 * Column L (11): Actual Amount with GST
 */
export function parseBOQExcel(file: File): Promise<ParseResult> {
  return new Promise((resolve) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })

        const results: ParsedBOQ[] = []
        const warnings: string[] = []

        // Process each sheet
        for (const sheetName of workbook.SheetNames) {
          const worksheet = workbook.Sheets[sheetName]
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][]

          if (jsonData.length < 3) {
            warnings.push(`Sheet "${sheetName}" has insufficient data`)
            continue
          }

          const parsedSheet = parseSheet(jsonData, sheetName, warnings)
          if (parsedSheet) {
            results.push(parsedSheet)
          }
        }

        if (results.length === 0) {
          resolve({
            success: false,
            error: 'No valid BOQ data found in the Excel file',
            warnings,
          })
          return
        }

        resolve({
          success: true,
          data: results,
          warnings: warnings.length > 0 ? warnings : undefined,
        })
      } catch (error) {
        console.error('Excel parsing error:', error)
        resolve({
          success: false,
          error: 'Failed to parse Excel file. Please check the file format.',
        })
      }
    }

    reader.onerror = () => {
      resolve({
        success: false,
        error: 'Failed to read the file',
      })
    }

    reader.readAsArrayBuffer(file)
  })
}

function parseSheet(rows: any[][], sheetName: string, warnings: string[]): ParsedBOQ | null {
  // Get package name from sheet name or first/second row
  let packageName = sheetName

  // Check first few rows for package name (usually row 0 or 1 has project/package name)
  for (let i = 0; i < Math.min(2, rows.length); i++) {
    if (rows[i] && rows[i][0] && typeof rows[i][0] === 'string') {
      const cellValue = String(rows[i][0]).trim()
      // Use non-header rows as package name
      if (!cellValue.toLowerCase().includes('s.no') && cellValue.length > 0) {
        packageName = cellValue
        break
      }
    }
  }

  // Find header row (contains "S.No" or similar)
  let headerRowIndex = -1
  for (let i = 0; i < Math.min(10, rows.length); i++) {
    const row = rows[i]
    if (row && row.length >= 4) {
      const firstCell = String(row[0] || '').toLowerCase().trim()
      if (firstCell.includes('s.no') || firstCell.includes('sl.no') || firstCell === 'sno') {
        headerRowIndex = i
        break
      }
    }
  }

  if (headerRowIndex === -1) {
    warnings.push(`No header row found in sheet "${sheetName}"`)
    return null
  }

  // Detect extended template and find billing column indices dynamically
  const headerRow = rows[headerRowIndex]
  let isExtendedTemplate = false

  // Column index mapping for billing columns (defaults match original layout)
  let rateCol = 5
  let totalAmountCol = 6
  let gstAmountCol = 7
  let totalAmountWithGstCol = 8
  let actualQuantityCol = 9
  let actualAmountCol = 10
  let actualAmountWithGstCol = 11

  // Build a combined header map from header row and potentially the row below (for multi-row headers)
  const headerMap: Map<number, string> = new Map()

  // Always add the header row itself
  for (let col = 0; col < Math.min(headerRow.length, 20); col++) {
    const cellVal = String(headerRow[col] || '').toLowerCase().trim()
    if (cellVal) {
      headerMap.set(col, cellVal)
    }
  }

  // Check if the next row is a header continuation (not a data row)
  const nextRowIdx = headerRowIndex + 1
  if (nextRowIdx < rows.length) {
    const nextRow = rows[nextRowIdx]
    if (nextRow) {
      const firstCell = String(nextRow[0] || '').trim()
      const firstCellNum = parseFloat(firstCell)
      // If first cell is non-numeric (not a data row S.No), it might be a header continuation
      const looksLikeHeader = isNaN(firstCellNum) || firstCell === ''
      if (looksLikeHeader) {
        const nextRowText = nextRow.slice(0, Math.min(nextRow.length, 12)).map((c: any) => String(c || '').toLowerCase()).join(' ')
        // Only combine if it contains header-like keywords
        if (nextRowText.includes('description') || nextRowText.includes('unit') || nextRowText.includes('qty') || nextRowText.includes('amount') || nextRowText.includes('rate') || nextRowText.includes('quantity')) {
          for (let col = 0; col < Math.min(nextRow.length, 20); col++) {
            const cellVal = String(nextRow[col] || '').toLowerCase().trim()
            if (cellVal) {
              const existing = headerMap.get(col) || ''
              headerMap.set(col, existing ? `${existing} ${cellVal}` : cellVal)
            }
          }
        }
      }
    }
  }

  // Search for billing-related keywords in header cells (columns 4+)
  // Order: most specific patterns first to avoid greedy matches
  headerMap.forEach((headerText, col) => {
    if (col < 4) return
    if (headerText.includes('actual') && headerText.includes('amount') && headerText.includes('gst')) {
      // "ACTUAL AMOUNT WITH GST" — most specific actual
      isExtendedTemplate = true
      actualAmountWithGstCol = col
    } else if (headerText.includes('actual') && headerText.includes('amount')) {
      // "ACTUAL AMOUNT" (no gst)
      isExtendedTemplate = true
      actualAmountCol = col
    } else if (headerText.includes('actual') && (headerText.includes('qty') || headerText.includes('quantity'))) {
      // "ACTUAL QUANTITY"
      isExtendedTemplate = true
      actualQuantityCol = col
    } else if (headerText.includes('total') && headerText.includes('amount') && headerText.includes('gst')) {
      // "TOTAL AMOUNT WITH GST" — must check before plain "gst amount"
      isExtendedTemplate = true
      totalAmountWithGstCol = col
    } else if (headerText.includes('gst') && headerText.includes('amount') && !headerText.includes('total') && !headerText.includes('actual')) {
      // "GST AMOUNT" only (not total, not actual)
      isExtendedTemplate = true
      gstAmountCol = col
    } else if (headerText.includes('total') && headerText.includes('amount') && !headerText.includes('gst') && !headerText.includes('actual')) {
      // "TOTAL AMOUNT" (no gst, no actual)
      isExtendedTemplate = true
      totalAmountCol = col
    } else if (headerText.includes('rate') && !headerText.includes('gst') && !headerText.includes('actual')) {
      // "RATE" only
      isExtendedTemplate = true
      rateCol = col
    }
  })

  // Fallback: if headers didn't match but data rows have numeric values in columns 5+
  if (!isExtendedTemplate && headerRow.length >= 8) {
    const checkStart = headerRowIndex + 1
    for (let i = checkStart; i < Math.min(checkStart + 5, rows.length); i++) {
      const row = rows[i]
      if (row && row.length > 5) {
        const hasExtendedData = [5, 6, 7, 8].some(col => {
          const val = row[col]
          return val !== undefined && val !== null && val !== '' && !isNaN(Number(val))
        })
        if (hasExtendedData) {
          isExtendedTemplate = true
          break
        }
      }
    }
  }

  // Determine data start index - skip multi-row headers
  let dataStartIndex = headerRowIndex + 1
  if (dataStartIndex < rows.length) {
    const nextRow = rows[dataStartIndex]
    if (nextRow) {
      const firstCell = String(nextRow[0] || '').trim()
      const firstCellNum = parseFloat(firstCell)
      // If the row after header is non-numeric in first cell or contains header keywords, skip it
      if (isNaN(firstCellNum) && firstCell !== '') {
        const rowText = nextRow.slice(0, 5).map((c: any) => String(c || '').toLowerCase()).join(' ')
        if (rowText.includes('description') || rowText.includes('unit') || rowText.includes('qty') || rowText.includes('location') || rowText.includes('amount')) {
          dataStartIndex = headerRowIndex + 2
        }
      }
    }
  }

  console.log('[Excel Parser] Header row:', headerRow)
  const headerMapObj: Record<number, string> = {}
  headerMap.forEach((v, k) => { headerMapObj[k] = v })
  console.log('[Excel Parser] Header map:', headerMapObj)
  console.log('[Excel Parser] isExtendedTemplate:', isExtendedTemplate)
  console.log('[Excel Parser] Column mapping:', { rateCol, totalAmountCol, gstAmountCol, totalAmountWithGstCol, actualQuantityCol, actualAmountCol, actualAmountWithGstCol })
  console.log('[Excel Parser] dataStartIndex:', dataStartIndex)

  const headlines: ParsedHeadline[] = []
  let currentHeadline: ParsedHeadline | null = null

  // Track orphan sections: rows without S.No grouped by section label
  // Each section has a label (e.g., "NT ITEMS") and its line items
  const orphanSections: { label: string; items: ParsedLineItem[] }[] = []
  let currentOrphanSection: { label: string; items: ParsedLineItem[] } | null = null

  for (let i = dataStartIndex; i < rows.length; i++) {
    const row = rows[i]
    if (!row || row.length < 2) continue

    // Column mapping based on template (A to E only):
    // 0: S.No, 1: Description, 2: LOCATION, 3: Unit, 4: Quantity
    const sNo = row[0]
    const description = row[1] ? String(row[1]).trim() : ''
    const location = row[2] ? String(row[2]).trim() : ''
    const unit = row[3] ? String(row[3]).trim() : ''
    const quantity = typeof row[4] === 'number' ? row[4] : parseFloat(String(row[4] || '0')) || 0

    // Parse extended columns if available
    let rate: number | null = null
    let totalAmount: number | null = null
    let gstAmount: number | null = null
    let totalAmountWithGst: number | null = null
    let actualQuantity: number | null = null
    let actualAmount: number | null = null
    let actualAmountWithGst: number | null = null

    if (isExtendedTemplate) {
      rate = parseNumericCell(row[rateCol])
      totalAmount = parseNumericCell(row[totalAmountCol])
      gstAmount = parseNumericCell(row[gstAmountCol])
      totalAmountWithGst = parseNumericCell(row[totalAmountWithGstCol])
      actualQuantity = parseNumericCell(row[actualQuantityCol])
      actualAmount = parseNumericCell(row[actualAmountCol])
      actualAmountWithGst = parseNumericCell(row[actualAmountWithGstCol])
    }

    // Debug: log first data row's billing values
    if (isExtendedTemplate && i === dataStartIndex) {
      console.log('[Excel Parser] First data row billing values:', {
        rate, totalAmount, gstAmount, totalAmountWithGst, actualQuantity, actualAmount, actualAmountWithGst,
        rawCols: { 5: row[5], 6: row[6], 7: row[7], 8: row[8], 9: row[9], 10: row[10], 11: row[11] }
      })
    }

    // Handle rows with no S.No
    if (sNo === undefined || sNo === null || sNo === '') {
      if (description && !isTotalRow(description)) {
        const hasNumericData = quantity > 0 || rate !== null || totalAmount !== null ||
          actualQuantity !== null || actualAmount !== null

        if (hasNumericData) {
          const lineItem: ParsedLineItem = {
            itemNumber: '',
            description,
            location,
            unit,
            quantity,
            ...(isExtendedTemplate ? { rate, totalAmount, gstAmount, totalAmountWithGst, actualQuantity, actualAmount, actualAmountWithGst } : {}),
          }

          if (currentHeadline && !currentOrphanSection) {
            // Attach to current headline (e.g., data row after "1. GEOTEXTILE")
            const itemIndex = currentHeadline.lineItems.length + 1
            lineItem.itemNumber = `${currentHeadline.serialNumber}.${itemIndex}`
            currentHeadline.lineItems.push(lineItem)
          } else {
            // Orphan section handling (existing behavior)
            if (!currentOrphanSection) {
              currentOrphanSection = { label: 'Miscellaneous', items: [] }
            }
            currentOrphanSection.items.push(lineItem)
          }
        } else {
          // No numeric data — could be a section label
          const isLikelyLabel = !unit && quantity === 0 && rate === null && totalAmount === null
          if (isLikelyLabel && !currentHeadline) {
            // Only start orphan section if no headline context
            if (currentOrphanSection && currentOrphanSection.items.length > 0) {
              orphanSections.push(currentOrphanSection)
            }
            currentOrphanSection = { label: description, items: [] }
            console.log('[Excel Parser] Detected section label:', description)
          }
        }
      }
      continue
    }

    // Check for letter-based sub-item format like "7.a", "7.b", "8.a"
    const sNoStr = String(sNo).trim()
    const letterSubItemMatch = sNoStr.match(/^(\d+)\.[a-zA-Z]+$/)

    if (letterSubItemMatch) {
      // Letter-based line item (e.g., "7.a", "7.b")
      const parentSerialNumber = parseInt(letterSubItemMatch[1], 10)

      // Save any pending orphan section
      if (currentOrphanSection && currentOrphanSection.items.length > 0) {
        orphanSections.push(currentOrphanSection)
        currentOrphanSection = null
      }

      const lineItem: ParsedLineItem = {
        itemNumber: sNoStr,
        description: description || '',
        location: location || '',
        unit: unit || '',
        quantity: quantity,
        ...(isExtendedTemplate ? { rate, totalAmount, gstAmount, totalAmountWithGst, actualQuantity, actualAmount, actualAmountWithGst } : {}),
      }

      if (currentHeadline && currentHeadline.serialNumber === parentSerialNumber) {
        currentHeadline.lineItems.push(lineItem)
      } else {
        if (currentHeadline) {
          headlines.push(currentHeadline)
        }
        currentHeadline = {
          serialNumber: parentSerialNumber,
          name: `Item ${parentSerialNumber}`,
          lineItems: [lineItem],
        }
      }
    } else {
      // Parse S.No as number
      const sNoNum = typeof sNo === 'number' ? sNo : parseFloat(sNoStr)

      if (isNaN(sNoNum)) {
        // Check if this is a total row (S.No contains "TOTAL ...")
        const combinedText = `${sNoStr} ${description}`.toLowerCase()
        if (combinedText.includes('total')) {
          if (currentHeadline) {
            headlines.push(currentHeadline)
            currentHeadline = null
          }
        }
        continue
      }

      // Save any pending orphan section
      if (currentOrphanSection && currentOrphanSection.items.length > 0) {
        orphanSections.push(currentOrphanSection)
        currentOrphanSection = null
      }

      if (isWholeNumber(sNoNum)) {
        if (currentHeadline) {
          headlines.push(currentHeadline)
        }

        currentHeadline = {
          serialNumber: sNoNum,
          name: description || `Item ${sNoNum}`,
          lineItems: [],
        }

        // If row has unit data, it's an item — also create a line item
        if (unit.length > 0) {
          currentHeadline.lineItems.push({
            itemNumber: sNoNum.toString(),
            description: description || '',
            location: location || '',
            unit: unit || '',
            quantity: quantity,
            ...(isExtendedTemplate ? { rate, totalAmount, gstAmount, totalAmountWithGst, actualQuantity, actualAmount, actualAmountWithGst } : {}),
          })
        }
      } else {
        // Decimal line item (1.1, 1.2, etc.)
        const lineItem: ParsedLineItem = {
          itemNumber: sNoNum.toString(),
          description: description || '',
          location: location || '',
          unit: unit || '',
          quantity: quantity,
          ...(isExtendedTemplate ? { rate, totalAmount, gstAmount, totalAmountWithGst, actualQuantity, actualAmount, actualAmountWithGst } : {}),
        }

        if (currentHeadline) {
          currentHeadline.lineItems.push(lineItem)
        } else {
          currentHeadline = {
            serialNumber: Math.floor(sNoNum),
            name: `Item ${Math.floor(sNoNum)}`,
            lineItems: [lineItem],
          }
        }
      }
    }
  }

  // Add last headline
  if (currentHeadline) {
    headlines.push(currentHeadline)
  }

  // Save last orphan section
  if (currentOrphanSection && currentOrphanSection.items.length > 0) {
    orphanSections.push(currentOrphanSection)
  }

  // Create headlines for orphan sections
  if (orphanSections.length > 0) {
    let lastSerial = headlines.length > 0
      ? Math.max(...headlines.map(h => h.serialNumber))
      : 0

    for (const section of orphanSections) {
      lastSerial += 1
      const sectionLineItems = section.items.map((item, index) => ({
        ...item,
        itemNumber: `${lastSerial}.${index + 1}`,
      }))

      headlines.push({
        serialNumber: lastSerial,
        name: section.label,
        lineItems: sectionLineItems,
      })

      console.log(`[Excel Parser] Created headline "${section.label}" (serial ${lastSerial}) with ${sectionLineItems.length} items`)
    }

    const totalOrphanItems = orphanSections.reduce((sum, s) => sum + s.items.length, 0)
    const sectionNames = orphanSections.map(s => `"${s.label}"`).join(', ')
    warnings.push(`${totalOrphanItems} rows without S.No were grouped under: ${sectionNames}`)
  }

  if (headlines.length === 0) {
    warnings.push(`No BOQ headlines found in sheet "${sheetName}"`)
    return null
  }

  return {
    packageName,
    headlines,
    hasRaBillingData: isExtendedTemplate,
  }
}
