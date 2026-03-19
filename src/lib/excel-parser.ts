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
  // S&I fields
  qtyExt?: string | null
  supplyRate?: number | null
  installationRate?: number | null
  supplyAmount?: number | null
  installationAmount?: number | null
  actualSupplyAmount?: number | null
  actualInstallationAmount?: number | null
  actualTotalAmount?: number | null
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
  billingType: 'standard' | 'supply_installation'
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
 * Standard template:
 *   Column A (0): S.No, Column B (1): Description, Column C (2): LOCATION,
 *   Column D (3): Unit, Column E (4): Quantity, + extended billing columns
 *
 * Supply & Installation template:
 *   S.No, Description, Unit, Qty Ext, Quantity, Supply Rate, Installation Rate,
 *   Supply Amount, Installation Amount, Actual Quantity, Actual Supply Amount,
 *   Actual Installation Amount, Actual Total Amount
 *   Note: No Location column. May start at column B (offset=1) for plumbing.
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
      if (!cellValue.toLowerCase().includes('s.no') && !cellValue.toLowerCase().includes('sl.no') && cellValue.length > 0) {
        packageName = cellValue
        break
      }
    }
    // Also check column B for package name (offset templates)
    if (rows[i] && rows[i][1] && typeof rows[i][1] === 'string') {
      const cellValue = String(rows[i][1]).trim()
      if (!cellValue.toLowerCase().includes('s.no') && !cellValue.toLowerCase().includes('sl.no') && !cellValue.toLowerCase().includes('description') && cellValue.length > 0) {
        if (packageName === sheetName) {
          packageName = cellValue
        }
      }
    }
  }

  // Find header row (contains "S.No" or "SL.NO") — scan cells 0-4 across first 10 rows
  let headerRowIndex = -1
  let columnOffset = 0
  for (let i = 0; i < Math.min(10, rows.length); i++) {
    const row = rows[i]
    if (!row || row.length < 4) continue
    for (let col = 0; col <= Math.min(4, row.length - 1); col++) {
      const cellVal = String(row[col] || '').toLowerCase().trim()
      if (cellVal.includes('s.no') || cellVal.includes('sl.no') || cellVal === 'sno') {
        headerRowIndex = i
        columnOffset = col
        break
      }
    }
    if (headerRowIndex !== -1) break
  }

  if (headerRowIndex === -1) {
    warnings.push(`No header row found in sheet "${sheetName}"`)
    return null
  }

  console.log(`[Excel Parser] Header found at row ${headerRowIndex}, column offset ${columnOffset}`)

  // Detect extended template and find billing column indices dynamically
  const headerRow = rows[headerRowIndex]
  let isExtendedTemplate = false
  let isSupplyInstallation = false

  // Column index mapping for standard billing columns (defaults match original layout)
  let rateCol = 5
  let totalAmountCol = 6
  let gstAmountCol = 7
  let totalAmountWithGstCol = 8
  let actualQuantityCol = 9
  let actualAmountCol = 10
  let actualAmountWithGstCol = 11

  // S&I column indices
  let unitCol = -1
  let qtyExtCol = -1
  let quantityCol = -1
  let supplyRateCol = -1
  let installationRateCol = -1
  let supplyAmountCol = -1
  let installationAmountCol = -1
  let siActualQuantityCol = -1
  let actualSupplyAmountCol = -1
  let actualInstallationAmountCol = -1
  let actualTotalAmountCol = -1

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
      const offsetCell = String(nextRow[columnOffset] || '').trim()
      const offsetCellNum = parseFloat(offsetCell)
      // If first data cell is non-numeric (not a data row S.No), it might be a header continuation
      const looksLikeHeader = isNaN(offsetCellNum) || offsetCell === ''
      if (looksLikeHeader) {
        const nextRowText = nextRow.slice(0, Math.min(nextRow.length, 16)).map((c: any) => String(c || '').toLowerCase()).join(' ')
        // Only combine if it contains header-like keywords
        if (nextRowText.includes('description') || nextRowText.includes('unit') || nextRowText.includes('qty') || nextRowText.includes('amount') || nextRowText.includes('rate') || nextRowText.includes('quantity') || nextRowText.includes('supply') || nextRowText.includes('installation')) {
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

  // Detect S&I template: look for "supply" + "rate" AND "installation" + "rate" in headers
  let hasSupplyRate = false
  let hasInstallationRate = false
  headerMap.forEach((headerText) => {
    if (headerText.includes('supply') && headerText.includes('rate')) hasSupplyRate = true
    if (headerText.includes('installation') && headerText.includes('rate')) hasInstallationRate = true
  })
  isSupplyInstallation = hasSupplyRate && hasInstallationRate

  if (isSupplyInstallation) {
    console.log('[Excel Parser] Detected Supply & Installation template')

    // Dynamic column mapping for S&I
    headerMap.forEach((headerText, col) => {
      // Unit column (contains "unit" but not "qty")
      if (headerText.includes('unit') && !headerText.includes('qty')) {
        unitCol = col
      }
      // Qty Ext
      if (headerText.includes('qty') && headerText.includes('ext')) {
        qtyExtCol = col
      }
      // Quantity (standalone — not "actual quantity", not "qty ext")
      if ((headerText === 'quantity' || headerText === 'qty') && !headerText.includes('actual') && !headerText.includes('ext')) {
        quantityCol = col
      }
      // Supply Rate (not "amount")
      if (headerText.includes('supply') && headerText.includes('rate') && !headerText.includes('amount')) {
        supplyRateCol = col
      }
      // Installation Rate (not "amount")
      if (headerText.includes('installation') && headerText.includes('rate') && !headerText.includes('amount')) {
        installationRateCol = col
      }
      // Supply Amount (not "actual", not "rate")
      if (headerText.includes('supply') && headerText.includes('amount') && !headerText.includes('actual') && !headerText.includes('rate')) {
        supplyAmountCol = col
      }
      // Installation Amount (not "actual", not "rate")
      if (headerText.includes('installation') && headerText.includes('amount') && !headerText.includes('actual') && !headerText.includes('rate')) {
        installationAmountCol = col
      }
      // Actual Quantity
      if (headerText.includes('actual') && (headerText.includes('quantity') || headerText.includes('qty')) && !headerText.includes('amount')) {
        siActualQuantityCol = col
      }
      // Actual Supply Amount
      if (headerText.includes('actual') && headerText.includes('supply') && headerText.includes('amount')) {
        actualSupplyAmountCol = col
      }
      // Actual Installation Amount
      if (headerText.includes('actual') && headerText.includes('installation') && headerText.includes('amount')) {
        actualInstallationAmountCol = col
      }
      // Actual Total Amount
      if (headerText.includes('actual') && headerText.includes('total') && headerText.includes('amount')) {
        actualTotalAmountCol = col
      }
    })

    // Fallback: if actual total amount column header is missing (e.g., null in plumbing),
    // assume it's the column right after actual installation amount
    if (actualTotalAmountCol === -1 && actualInstallationAmountCol >= 0) {
      actualTotalAmountCol = actualInstallationAmountCol + 1
    }

    console.log('[Excel Parser] S&I Column mapping:', {
      unitCol, qtyExtCol, quantityCol, supplyRateCol, installationRateCol,
      supplyAmountCol, installationAmountCol, siActualQuantityCol,
      actualSupplyAmountCol, actualInstallationAmountCol, actualTotalAmountCol
    })
  } else {
    // Standard template — search for billing-related keywords in header cells (columns 4+)
    // Order: most specific patterns first to avoid greedy matches
    headerMap.forEach((headerText, col) => {
      if (col < 4) return
      if (headerText.includes('actual') && headerText.includes('amount') && headerText.includes('gst')) {
        isExtendedTemplate = true
        actualAmountWithGstCol = col
      } else if (headerText.includes('actual') && headerText.includes('amount')) {
        isExtendedTemplate = true
        actualAmountCol = col
      } else if (headerText.includes('actual') && (headerText.includes('qty') || headerText.includes('quantity'))) {
        isExtendedTemplate = true
        actualQuantityCol = col
      } else if (headerText.includes('total') && headerText.includes('amount') && headerText.includes('gst')) {
        isExtendedTemplate = true
        totalAmountWithGstCol = col
      } else if (headerText.includes('gst') && headerText.includes('amount') && !headerText.includes('total') && !headerText.includes('actual')) {
        isExtendedTemplate = true
        gstAmountCol = col
      } else if (headerText.includes('total') && headerText.includes('amount') && !headerText.includes('gst') && !headerText.includes('actual')) {
        isExtendedTemplate = true
        totalAmountCol = col
      } else if (headerText.includes('rate') && !headerText.includes('gst') && !headerText.includes('actual')) {
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
  }

  // Determine data start index - skip multi-row headers
  let dataStartIndex = headerRowIndex + 1
  if (dataStartIndex < rows.length) {
    const nextRow = rows[dataStartIndex]
    if (nextRow) {
      const offsetCell = String(nextRow[columnOffset] || '').trim()
      const offsetCellNum = parseFloat(offsetCell)
      // If the row after header is non-numeric in first cell or contains header keywords, skip it
      if (isNaN(offsetCellNum) && offsetCell !== '') {
        const rowText = nextRow.slice(0, Math.min(nextRow.length, 16)).map((c: any) => String(c || '').toLowerCase()).join(' ')
        if (rowText.includes('description') || rowText.includes('unit') || rowText.includes('qty') || rowText.includes('location') || rowText.includes('amount') || rowText.includes('supply') || rowText.includes('installation')) {
          dataStartIndex = headerRowIndex + 2
        }
      }
    }
  }

  console.log('[Excel Parser] Header row:', headerRow)
  const headerMapObj: Record<number, string> = {}
  headerMap.forEach((v, k) => { headerMapObj[k] = v })
  console.log('[Excel Parser] Header map:', headerMapObj)
  console.log('[Excel Parser] isExtendedTemplate:', isExtendedTemplate, 'isSupplyInstallation:', isSupplyInstallation)
  console.log('[Excel Parser] dataStartIndex:', dataStartIndex)

  const headlines: ParsedHeadline[] = []
  let currentHeadline: ParsedHeadline | null = null

  // Track orphan sections: rows without S.No grouped by section label
  const orphanSections: { label: string; items: ParsedLineItem[] }[] = []
  let currentOrphanSection: { label: string; items: ParsedLineItem[] } | null = null

  for (let i = dataStartIndex; i < rows.length; i++) {
    const row = rows[i]
    if (!row || row.length < 2) continue

    // Base column mapping depends on template type
    let sNo: any
    let description: string
    let location: string
    let unit: string
    let quantity: number

    if (isSupplyInstallation) {
      // S&I: sNo and description at offset+0, offset+1; no location column
      sNo = row[columnOffset]
      description = row[columnOffset + 1] ? String(row[columnOffset + 1]).trim() : ''
      location = '' // S&I templates have no location column
      unit = unitCol >= 0 ? (row[unitCol] ? String(row[unitCol]).trim() : '') : ''
      quantity = quantityCol >= 0
        ? (typeof row[quantityCol] === 'number' ? row[quantityCol] : parseFloat(String(row[quantityCol] || '0')) || 0)
        : 0
    } else {
      // Standard: 0: S.No, 1: Description, 2: LOCATION, 3: Unit, 4: Quantity
      sNo = row[0]
      description = row[1] ? String(row[1]).trim() : ''
      location = row[2] ? String(row[2]).trim() : ''
      unit = row[3] ? String(row[3]).trim() : ''
      quantity = typeof row[4] === 'number' ? row[4] : parseFloat(String(row[4] || '0')) || 0
    }

    // Parse billing columns based on template type
    let rate: number | null = null
    let totalAmount: number | null = null
    let gstAmount: number | null = null
    let totalAmountWithGst: number | null = null
    let actualQuantity: number | null = null
    let actualAmount: number | null = null
    let actualAmountWithGst: number | null = null

    // S&I fields
    let qtyExt: string | null = null
    let supplyRate: number | null = null
    let installationRate: number | null = null
    let supplyAmount: number | null = null
    let installationAmount: number | null = null
    let actualSupplyAmount: number | null = null
    let actualInstallationAmount: number | null = null
    let actualTotalAmount: number | null = null

    if (isSupplyInstallation) {
      if (qtyExtCol >= 0) qtyExt = row[qtyExtCol] != null ? String(row[qtyExtCol]).trim() : null
      if (supplyRateCol >= 0) supplyRate = parseNumericCell(row[supplyRateCol])
      if (installationRateCol >= 0) installationRate = parseNumericCell(row[installationRateCol])
      if (supplyAmountCol >= 0) supplyAmount = parseNumericCell(row[supplyAmountCol])
      if (installationAmountCol >= 0) installationAmount = parseNumericCell(row[installationAmountCol])
      if (siActualQuantityCol >= 0) actualQuantity = parseNumericCell(row[siActualQuantityCol])
      if (actualSupplyAmountCol >= 0) actualSupplyAmount = parseNumericCell(row[actualSupplyAmountCol])
      if (actualInstallationAmountCol >= 0) actualInstallationAmount = parseNumericCell(row[actualInstallationAmountCol])
      if (actualTotalAmountCol >= 0) actualTotalAmount = parseNumericCell(row[actualTotalAmountCol])
    } else if (isExtendedTemplate) {
      rate = parseNumericCell(row[rateCol])
      totalAmount = parseNumericCell(row[totalAmountCol])
      gstAmount = parseNumericCell(row[gstAmountCol])
      totalAmountWithGst = parseNumericCell(row[totalAmountWithGstCol])
      actualQuantity = parseNumericCell(row[actualQuantityCol])
      actualAmount = parseNumericCell(row[actualAmountCol])
      actualAmountWithGst = parseNumericCell(row[actualAmountWithGstCol])
    }

    // Debug: log first data row's billing values
    if ((isExtendedTemplate || isSupplyInstallation) && i === dataStartIndex) {
      if (isSupplyInstallation) {
        console.log('[Excel Parser] First S&I data row:', {
          sNo, description, unit, qtyExt, quantity, supplyRate, installationRate,
          supplyAmount, installationAmount, actualQuantity,
          actualSupplyAmount, actualInstallationAmount, actualTotalAmount
        })
      } else {
        console.log('[Excel Parser] First data row billing values:', {
          rate, totalAmount, gstAmount, totalAmountWithGst, actualQuantity, actualAmount, actualAmountWithGst,
        })
      }
    }

    // Build extended fields spread objects
    const standardExtendedFields = isExtendedTemplate
      ? { rate, totalAmount, gstAmount, totalAmountWithGst, actualQuantity, actualAmount, actualAmountWithGst }
      : {}

    const siFields = isSupplyInstallation
      ? { qtyExt, supplyRate, installationRate, supplyAmount, installationAmount, actualQuantity, actualSupplyAmount, actualInstallationAmount, actualTotalAmount }
      : {}

    const billingFields = { ...standardExtendedFields, ...siFields }

    // Handle rows with no S.No
    if (sNo === undefined || sNo === null || sNo === '') {
      if (description && !isTotalRow(description)) {
        const hasNumericData = quantity > 0 || rate !== null || totalAmount !== null ||
          actualQuantity !== null || actualAmount !== null ||
          supplyRate !== null || (supplyAmount !== null && supplyAmount !== 0) ||
          (installationAmount !== null && installationAmount !== 0) ||
          (actualTotalAmount !== null && actualTotalAmount !== 0)

        if (hasNumericData) {
          const lineItem: ParsedLineItem = {
            itemNumber: '',
            description,
            location,
            unit,
            quantity,
            ...billingFields,
          }

          if (currentHeadline && (!currentOrphanSection || currentOrphanSection.items.length === 0)) {
            currentOrphanSection = null // clear empty orphan
            const itemIndex = currentHeadline.lineItems.length + 1
            lineItem.itemNumber = `${currentHeadline.serialNumber}.${itemIndex}`
            currentHeadline.lineItems.push(lineItem)
          } else {
            if (!currentOrphanSection) {
              currentOrphanSection = { label: 'Miscellaneous', items: [] }
            }
            currentOrphanSection.items.push(lineItem)
          }
        } else {
          const isLikelyLabel = !unit && quantity === 0 && rate === null && totalAmount === null && supplyRate === null
          if (isLikelyLabel && !currentHeadline) {
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
      const parentSerialNumber = parseInt(letterSubItemMatch[1], 10)

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
        ...billingFields,
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
        const combinedText = `${sNoStr} ${description}`.toLowerCase()
        if (combinedText.includes('total')) {
          if (currentHeadline) {
            headlines.push(currentHeadline)
            currentHeadline = null
          }
        }
        continue
      }

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
            ...billingFields,
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
          ...billingFields,
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
    hasRaBillingData: isExtendedTemplate || isSupplyInstallation,
    billingType: isSupplyInstallation ? 'supply_installation' : 'standard',
  }
}
