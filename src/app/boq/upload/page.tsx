'use client'

import { Suspense, useEffect, useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  ArrowLeft,
  Upload,
  FileSpreadsheet,
  CheckCircle,
  AlertCircle,
  X,
  Save,
} from 'lucide-react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { parseBOQExcel, ParsedBOQ, ParsedHeadline } from '@/lib/excel-parser'
import { toast } from 'sonner'

interface Site {
  id: string
  name: string
}

interface Package {
  id: string
  name: string
  site_id: string
}

function BOQUploadContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const siteIdParam = searchParams.get('site')

  const [sites, setSites] = useState<Site[]>([])
  const [packages, setPackages] = useState<Package[]>([])
  const [selectedSite, setSelectedSite] = useState<string>('')
  const [selectedPackage, setSelectedPackage] = useState<string>('')

  const [file, setFile] = useState<File | null>(null)
  const [parsing, setParsing] = useState(false)
  const [parsedData, setParsedData] = useState<ParsedBOQ[] | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])

  const [saving, setSaving] = useState(false)
  const [dragActive, setDragActive] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    if (siteIdParam && sites.length > 0) {
      setSelectedSite(siteIdParam)
    }
  }, [siteIdParam, sites])

  async function fetchData() {
    try {
      const { data: sitesData } = await supabase
        .from('sites')
        .select('id, name')
        .order('name')

      setSites(sitesData || [])

      const { data: packagesData } = await supabase
        .from('packages')
        .select('id, name, site_id')
        .order('name')

      setPackages(packagesData || [])
    } catch (error) {
      console.error('Error fetching data:', error)
    }
  }

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0])
    }
  }, [])

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0])
    }
  }

  async function handleFile(selectedFile: File) {
    // Validate file type
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ]
    if (!validTypes.includes(selectedFile.type) && !selectedFile.name.match(/\.(xlsx|xls)$/i)) {
      toast.error('Please upload an Excel file (.xlsx or .xls)')
      return
    }

    setFile(selectedFile)
    setParsedData(null)
    setParseError(null)
    setWarnings([])
    setParsing(true)

    try {
      const result = await parseBOQExcel(selectedFile)

      if (result.success && result.data) {
        setParsedData(result.data)
        setWarnings(result.warnings || [])
        toast.success(`Parsed ${result.data.reduce((sum, d) => sum + d.headlines.length, 0)} BOQ headlines`)
      } else {
        setParseError(result.error || 'Failed to parse file')
        toast.error(result.error || 'Failed to parse file')
      }
    } catch (error) {
      console.error('Parse error:', error)
      setParseError('An error occurred while parsing the file')
      toast.error('Failed to parse file')
    } finally {
      setParsing(false)
    }
  }

  async function handleSave() {
    if (!selectedPackage) {
      toast.error('Please select a package')
      return
    }

    if (!parsedData || parsedData.length === 0) {
      toast.error('No data to save')
      return
    }

    setSaving(true)

    try {
      // Flatten all headlines from all parsed sheets
      const allHeadlines = parsedData.flatMap(d => d.headlines)

      for (const headline of allHeadlines) {
        // Insert headline
        const { data: headlineData, error: headlineError } = await supabase
          .from('boq_headlines')
          .insert({
            package_id: selectedPackage,
            serial_number: headline.serialNumber,
            name: headline.name,
            status: 'pending',
          })
          .select()
          .single()

        if (headlineError) {
          console.error('Error inserting headline:', headlineError)
          throw headlineError
        }

        // Insert line items
        if (headline.lineItems.length > 0) {
          const lineItemsToInsert = headline.lineItems.map(item => ({
            headline_id: headlineData.id,
            item_number: item.itemNumber,
            description: item.description,
            location: item.location || null,
            unit: item.unit,
            quantity: item.quantity,
            status: 'pending',
          }))

          const { error: lineItemsError } = await supabase
            .from('boq_line_items')
            .insert(lineItemsToInsert)

          if (lineItemsError) {
            console.error('Error inserting line items:', lineItemsError)
            throw lineItemsError
          }
        }
      }

      toast.success(`Successfully imported ${allHeadlines.length} BOQ headlines`)
      router.push(`/boq?package=${selectedPackage}`)
    } catch (error) {
      console.error('Save error:', error)
      toast.error('Failed to save BOQ data')
    } finally {
      setSaving(false)
    }
  }

  function clearFile() {
    setFile(null)
    setParsedData(null)
    setParseError(null)
    setWarnings([])
  }

  const filteredPackages = selectedSite
    ? packages.filter(p => p.site_id === selectedSite)
    : packages

  const totalHeadlines = parsedData?.reduce((sum, d) => sum + d.headlines.length, 0) || 0
  const totalLineItems = parsedData?.reduce(
    (sum, d) => sum + d.headlines.reduce((s, h) => s + h.lineItems.length, 0),
    0
  ) || 0

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Upload BOQ" />

      <div className="flex-1 p-4 md:p-6 space-y-6">
        {/* Back Button */}
        <Link href="/boq" className="inline-flex items-center text-sm text-slate-600 hover:text-slate-900">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to BOQ
        </Link>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left Column - Upload & Settings */}
          <div className="lg:col-span-1 space-y-6">
            {/* Site & Package Selection */}
            <Card>
              <CardHeader>
                <CardTitle>Target Location</CardTitle>
                <CardDescription>Select where to import the BOQ data</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Site *</label>
                  <Select value={selectedSite} onValueChange={(value) => {
                    setSelectedSite(value)
                    setSelectedPackage('')
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select site" />
                    </SelectTrigger>
                    <SelectContent>
                      {sites.map((site) => (
                        <SelectItem key={site.id} value={site.id}>
                          {site.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Package *</label>
                  <Select
                    value={selectedPackage}
                    onValueChange={setSelectedPackage}
                    disabled={!selectedSite}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={selectedSite ? "Select package" : "Select site first"} />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredPackages.map((pkg) => (
                        <SelectItem key={pkg.id} value={pkg.id}>
                          {pkg.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedSite && filteredPackages.length === 0 && (
                    <p className="text-sm text-amber-600">
                      No packages found. <Link href={`/sites/${selectedSite}`} className="underline">Add a package</Link> first.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* File Upload */}
            <Card>
              <CardHeader>
                <CardTitle>Upload Excel File</CardTitle>
                <CardDescription>Upload your BOQ Excel file (.xlsx or .xls)</CardDescription>
              </CardHeader>
              <CardContent>
                {!file ? (
                  <div
                    className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                      dragActive ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300'
                    }`}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                  >
                    <Upload className="h-10 w-10 mx-auto text-slate-400 mb-4" />
                    <p className="text-sm text-slate-600 mb-2">
                      Drag and drop your Excel file here, or
                    </p>
                    <label>
                      <input
                        type="file"
                        accept=".xlsx,.xls"
                        onChange={handleFileInput}
                        className="hidden"
                      />
                      <Button type="button" variant="outline" asChild>
                        <span className="cursor-pointer">Browse Files</span>
                      </Button>
                    </label>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                      <FileSpreadsheet className="h-8 w-8 text-green-600" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{file.name}</p>
                        <p className="text-sm text-slate-500">
                          {(file.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                      <Button variant="ghost" size="icon" onClick={clearFile}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>

                    {parsing && (
                      <div className="text-center py-4">
                        <div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-2" />
                        <p className="text-sm text-slate-500">Parsing file...</p>
                      </div>
                    )}

                    {parseError && (
                      <div className="flex items-start gap-2 p-3 bg-red-50 text-red-700 rounded-lg">
                        <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                        <p className="text-sm">{parseError}</p>
                      </div>
                    )}

                    {parsedData && (
                      <div className="flex items-start gap-2 p-3 bg-green-50 text-green-700 rounded-lg">
                        <CheckCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                        <div className="text-sm">
                          <p className="font-medium">File parsed successfully!</p>
                          <p>{totalHeadlines} headlines, {totalLineItems} line items found</p>
                        </div>
                      </div>
                    )}

                    {warnings.length > 0 && (
                      <div className="p-3 bg-amber-50 text-amber-700 rounded-lg">
                        <p className="text-sm font-medium mb-1">Warnings:</p>
                        <ul className="text-sm list-disc list-inside">
                          {warnings.map((w, i) => (
                            <li key={i}>{w}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Save Button */}
            {parsedData && (
              <Button
                className="w-full"
                size="lg"
                onClick={handleSave}
                disabled={saving || !selectedPackage}
              >
                {saving ? (
                  'Saving...'
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Import {totalHeadlines} BOQ Headlines
                  </>
                )}
              </Button>
            )}
          </div>

          {/* Right Column - Preview */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Preview</CardTitle>
                <CardDescription>
                  {parsedData
                    ? `${totalHeadlines} headlines with ${totalLineItems} line items`
                    : 'Upload a file to preview the data'
                  }
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!parsedData ? (
                  <div className="text-center py-12 text-slate-500">
                    <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 text-slate-300" />
                    <p>Upload an Excel file to see the preview</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {parsedData.map((sheet, sheetIndex) => (
                      <div key={sheetIndex}>
                        <h3 className="font-medium text-lg mb-3 flex items-center gap-2">
                          <Badge variant="outline">{sheet.packageName}</Badge>
                          <span className="text-sm text-slate-500">
                            ({sheet.headlines.length} headlines)
                          </span>
                        </h3>

                        <div className="space-y-4">
                          {sheet.headlines.map((headline, hIndex) => (
                            <div key={hIndex} className="border rounded-lg overflow-hidden">
                              <div className="bg-slate-50 px-4 py-2 border-b">
                                <span className="font-medium">
                                  {headline.serialNumber}. {headline.name}
                                </span>
                                <span className="text-sm text-slate-500 ml-2">
                                  ({headline.lineItems.length} items)
                                </span>
                              </div>

                              {headline.lineItems.length > 0 && (
                                <div className="overflow-x-auto">
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead className="w-[60px]">S.No</TableHead>
                                        <TableHead>Description</TableHead>
                                        <TableHead>Location</TableHead>
                                        <TableHead>Unit</TableHead>
                                        <TableHead className="text-right">Quantity</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {headline.lineItems.slice(0, 5).map((item, iIndex) => (
                                        <TableRow key={iIndex}>
                                          <TableCell className="font-mono text-sm">
                                            {item.itemNumber}
                                          </TableCell>
                                          <TableCell className="max-w-[300px]">
                                            <p className="truncate" title={item.description}>
                                              {item.description}
                                            </p>
                                          </TableCell>
                                          <TableCell className="text-sm text-slate-500">
                                            {item.location || '-'}
                                          </TableCell>
                                          <TableCell>{item.unit || '-'}</TableCell>
                                          <TableCell className="text-right">
                                            {item.quantity || '-'}
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                      {headline.lineItems.length > 5 && (
                                        <TableRow>
                                          <TableCell colSpan={5} className="text-center text-slate-500">
                                            ... and {headline.lineItems.length - 5} more items
                                          </TableCell>
                                        </TableRow>
                                      )}
                                    </TableBody>
                                  </Table>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function BOQUploadPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
      <BOQUploadContent />
    </Suspense>
  )
}
