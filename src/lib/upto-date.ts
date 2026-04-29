import { supabase } from './supabase'

/**
 * Compute "Upto Date" quantity per BOQ line item.
 *
 * Rule: if at least one JMR with status='approved' exists for the line item,
 * Upto Date = sum of approved_quantity across those JMRs. Otherwise, fall
 * back to the sum of workstation_boq_progress.quantity for that line item.
 * Line items with neither source resolve to 0.
 *
 * Used by BOQ Management (`/boq/[id]`) for the Upto Date display and by
 * RA Billing (`/ra-billing`) when a package has actual_source='execution'.
 */
export async function computeUptoDateMap(
  lineItemIds: string[]
): Promise<Record<string, number>> {
  if (lineItemIds.length === 0) return {}

  const [jmrRes, wsRes] = await Promise.all([
    supabase
      .from('boq_jmr')
      .select('line_item_id, approved_quantity')
      .in('line_item_id', lineItemIds)
      .eq('status', 'approved'),
    supabase
      .from('workstation_boq_progress')
      .select('boq_line_item_id, quantity')
      .in('boq_line_item_id', lineItemIds),
  ])

  if (jmrRes.error) console.error('Error fetching JMR approved quantities:', jmrRes.error)
  if (wsRes.error) console.error('Error fetching workstation progress:', wsRes.error)

  const workstationSum: Record<string, number> = {}
  ;(wsRes.data || []).forEach((row) => {
    const id = row.boq_line_item_id as string
    workstationSum[id] = (workstationSum[id] || 0) + (row.quantity || 0)
  })

  const jmrSum: Record<string, number> = {}
  const hasApprovedJmr: Record<string, boolean> = {}
  ;(jmrRes.data || []).forEach((row) => {
    const id = row.line_item_id as string
    hasApprovedJmr[id] = true
    jmrSum[id] = (jmrSum[id] || 0) + (row.approved_quantity || 0)
  })

  const map: Record<string, number> = {}
  lineItemIds.forEach((id) => {
    map[id] = hasApprovedJmr[id] ? (jmrSum[id] || 0) : (workstationSum[id] || 0)
  })
  return map
}
