'use client'

import { useState, useEffect } from 'react'
import { Header } from '@/components/layout/header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Package,
  Loader2,
  Building2,
  Warehouse,
  ChevronDown,
  ChevronRight,
  Search,
  Calendar,
  TrendingUp,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'

interface Site {
  id: string
  name: string
}

interface InventoryItem {
  material_id: string
  material_name: string
  category: string
  unit: string
  total_quantity: number
  last_receipt_date: string
  receipt_count: number
}

interface CategoryGroup {
  category: string
  items: InventoryItem[]
  totalItems: number
}

export default function InventoryPage() {
  const [sites, setSites] = useState<Site[]>([])
  const [selectedSiteId, setSelectedSiteId] = useState<string>('')
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingInventory, setLoadingInventory] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetchSites()
  }, [])

  useEffect(() => {
    if (selectedSiteId) {
      fetchInventory()
    } else {
      setInventory([])
    }
  }, [selectedSiteId])

  async function fetchSites() {
    try {
      const { data, error } = await supabase
        .from('sites')
        .select('id, name')
        .order('name')

      if (error) throw error
      setSites(data || [])

      // Auto-select first site
      if (data && data.length > 0) {
        setSelectedSiteId(data[0].id)
      }
    } catch (error) {
      console.error('Error fetching sites:', error)
      toast.error('Failed to load sites')
    } finally {
      setLoading(false)
    }
  }

  async function fetchInventory() {
    setLoadingInventory(true)
    try {
      // Fetch all GRN entries for the selected site
      const { data: grnData, error: grnError } = await supabase
        .from('material_grn')
        .select(`
          material_id,
          material_name,
          quantity,
          unit,
          grn_date
        `)
        .eq('site_id', selectedSiteId)
        .order('grn_date', { ascending: false })

      if (grnError) throw grnError

      // Fetch material categories from master_materials
      const materialIds = [...new Set((grnData || []).map(g => g.material_id))]

      let materialCategories: { [key: string]: string } = {}

      if (materialIds.length > 0) {
        const { data: materialsData, error: materialsError } = await supabase
          .from('master_materials')
          .select('id, category')
          .in('id', materialIds)

        if (materialsError) {
          console.error('Error fetching material categories:', materialsError)
        } else {
          materialsData?.forEach(m => {
            materialCategories[m.id] = m.category
          })
        }
      }

      // Aggregate quantities by material
      const aggregated: { [key: string]: InventoryItem } = {}

      ;(grnData || []).forEach(grn => {
        if (!aggregated[grn.material_id]) {
          aggregated[grn.material_id] = {
            material_id: grn.material_id,
            material_name: grn.material_name,
            category: materialCategories[grn.material_id] || 'Uncategorized',
            unit: grn.unit,
            total_quantity: 0,
            last_receipt_date: grn.grn_date,
            receipt_count: 0,
          }
        }
        aggregated[grn.material_id].total_quantity += parseFloat(grn.quantity) || 0
        aggregated[grn.material_id].receipt_count += 1

        // Keep track of most recent receipt date
        if (grn.grn_date > aggregated[grn.material_id].last_receipt_date) {
          aggregated[grn.material_id].last_receipt_date = grn.grn_date
        }
      })

      const inventoryList = Object.values(aggregated).sort((a, b) =>
        a.material_name.localeCompare(b.material_name)
      )

      setInventory(inventoryList)

      // Auto-expand all categories initially
      const categories = new Set(inventoryList.map(item => item.category))
      setExpandedCategories(categories)
    } catch (error) {
      console.error('Error fetching inventory:', error)
      toast.error('Failed to load inventory')
    } finally {
      setLoadingInventory(false)
    }
  }

  // Filter inventory by search term
  const filteredInventory = inventory.filter(item =>
    item.material_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.category.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Group by category
  const groupedInventory: CategoryGroup[] = []
  const categoryMap: { [key: string]: InventoryItem[] } = {}

  filteredInventory.forEach(item => {
    if (!categoryMap[item.category]) {
      categoryMap[item.category] = []
    }
    categoryMap[item.category].push(item)
  })

  Object.keys(categoryMap).sort().forEach(category => {
    groupedInventory.push({
      category,
      items: categoryMap[category],
      totalItems: categoryMap[category].length,
    })
  })

  function toggleCategory(category: string) {
    const newExpanded = new Set(expandedCategories)
    if (newExpanded.has(category)) {
      newExpanded.delete(category)
    } else {
      newExpanded.add(category)
    }
    setExpandedCategories(newExpanded)
  }

  // Calculate summary stats
  const totalMaterials = inventory.length
  const totalCategories = new Set(inventory.map(i => i.category)).size

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header title="Inventory" />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-slate-500">Loading...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Inventory" />

      <div className="flex-1 p-4 md:p-6 space-y-4">
        {/* Header Card */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex flex-col gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Warehouse className="h-5 w-5" />
                  Material Inventory
                </CardTitle>
                <CardDescription>
                  View aggregated material stock from GRN entries
                </CardDescription>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Select value={selectedSiteId} onValueChange={setSelectedSiteId}>
                  <SelectTrigger className="w-full sm:w-[220px]">
                    <Building2 className="h-4 w-4 mr-2" />
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

                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search materials..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Summary Stats - Mobile friendly */}
        {selectedSiteId && inventory.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                    <Package className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{totalMaterials}</p>
                    <p className="text-xs text-slate-500">Materials</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center">
                    <TrendingUp className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{totalCategories}</p>
                    <p className="text-xs text-slate-500">Categories</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Inventory Content */}
        {!selectedSiteId ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <Building2 className="h-12 w-12 mx-auto text-slate-300 mb-4" />
                <h3 className="text-lg font-medium text-slate-900 mb-2">Select a Site</h3>
                <p className="text-slate-500">Choose a site to view material inventory</p>
              </div>
            </CardContent>
          </Card>
        ) : loadingInventory ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
                <p className="text-slate-500">Loading inventory...</p>
              </div>
            </CardContent>
          </Card>
        ) : inventory.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <Warehouse className="h-12 w-12 mx-auto text-slate-300 mb-4" />
                <h3 className="text-lg font-medium text-slate-900 mb-2">No Inventory</h3>
                <p className="text-slate-500">No materials have been recorded via GRN for this site</p>
              </div>
            </CardContent>
          </Card>
        ) : filteredInventory.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <Search className="h-12 w-12 mx-auto text-slate-300 mb-4" />
                <h3 className="text-lg font-medium text-slate-900 mb-2">No Results</h3>
                <p className="text-slate-500">No materials match your search</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {groupedInventory.map((group) => (
              <Card key={group.category}>
                <Collapsible
                  open={expandedCategories.has(group.category)}
                  onOpenChange={() => toggleCategory(group.category)}
                >
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-slate-50 transition-colors py-3 px-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {expandedCategories.has(group.category) ? (
                            <ChevronDown className="h-4 w-4 text-slate-500" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-slate-500" />
                          )}
                          <CardTitle className="text-base font-medium">
                            {group.category}
                          </CardTitle>
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          {group.totalItems} item{group.totalItems !== 1 ? 's' : ''}
                        </Badge>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <CardContent className="pt-0 px-4 pb-4">
                      <div className="space-y-2">
                        {group.items.map((item) => (
                          <div
                            key={item.material_id}
                            className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-slate-50 rounded-lg"
                          >
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium text-sm truncate">
                                {item.material_name}
                              </h4>
                              <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  Last: {new Date(item.last_receipt_date).toLocaleDateString('en-IN')}
                                </span>
                                <span>
                                  {item.receipt_count} receipt{item.receipt_count !== 1 ? 's' : ''}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">
                                {item.total_quantity.toLocaleString('en-IN', { maximumFractionDigits: 3 })} {item.unit}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
