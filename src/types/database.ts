export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      sites: {
        Row: {
          id: string
          name: string
          client_name: string | null
          location: string | null
          status: 'active' | 'completed' | 'on_hold'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          client_name?: string | null
          location?: string | null
          status?: 'active' | 'completed' | 'on_hold'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          client_name?: string | null
          location?: string | null
          status?: 'active' | 'completed' | 'on_hold'
          created_at?: string
          updated_at?: string
        }
      }
      packages: {
        Row: {
          id: string
          site_id: string
          name: string
          code: string | null
          created_at: string
        }
        Insert: {
          id?: string
          site_id: string
          name: string
          code?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          site_id?: string
          name?: string
          code?: string | null
          created_at?: string
        }
      }
      boq_headlines: {
        Row: {
          id: string
          package_id: string
          serial_number: number
          name: string
          description: string | null
          status: 'pending' | 'in_progress' | 'completed'
          created_at: string
        }
        Insert: {
          id?: string
          package_id: string
          serial_number: number
          name: string
          description?: string | null
          status?: 'pending' | 'in_progress' | 'completed'
          created_at?: string
        }
        Update: {
          id?: string
          package_id?: string
          serial_number?: number
          name?: string
          description?: string | null
          status?: 'pending' | 'in_progress' | 'completed'
          created_at?: string
        }
      }
      boq_line_items: {
        Row: {
          id: string
          headline_id: string
          item_number: string
          description: string
          location: string | null
          unit: string
          quantity: number
          status: 'pending' | 'in_progress' | 'completed'
          created_at: string
        }
        Insert: {
          id?: string
          headline_id: string
          item_number: string
          description: string
          location?: string | null
          unit: string
          quantity: number
          status?: 'pending' | 'in_progress' | 'completed'
          created_at?: string
        }
        Update: {
          id?: string
          headline_id?: string
          item_number?: string
          description?: string
          location?: string | null
          unit?: string
          quantity?: number
          status?: 'pending' | 'in_progress' | 'completed'
          created_at?: string
        }
      }
      materials: {
        Row: {
          id: string
          line_item_id: string
          name: string
          material_type: 'direct' | 'indirect'
          unit: string
          required_quantity: number | null
          created_at: string
        }
        Insert: {
          id?: string
          line_item_id: string
          name: string
          material_type: 'direct' | 'indirect'
          unit: string
          required_quantity?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          line_item_id?: string
          name?: string
          material_type?: 'direct' | 'indirect'
          unit?: string
          required_quantity?: number | null
          created_at?: string
        }
      }
      material_receipts: {
        Row: {
          id: string
          material_id: string
          invoice_number: string | null
          receipt_date: string
          quantity_received: number
          vendor_name: string | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          material_id: string
          invoice_number?: string | null
          receipt_date: string
          quantity_received: number
          vendor_name?: string | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          material_id?: string
          invoice_number?: string | null
          receipt_date?: string
          quantity_received?: number
          vendor_name?: string | null
          notes?: string | null
          created_at?: string
        }
      }
      compliance_documents: {
        Row: {
          id: string
          material_id: string
          document_type: 'tds' | 'test_certificate' | 'mir' | 'delivery_challan' | 'eway_bill' | 'invoice'
          file_path: string | null
          file_name: string | null
          is_applicable: boolean
          is_uploaded: boolean
          uploaded_at: string | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          material_id: string
          document_type: 'tds' | 'test_certificate' | 'mir' | 'delivery_challan' | 'eway_bill' | 'invoice'
          file_path?: string | null
          file_name?: string | null
          is_applicable?: boolean
          is_uploaded?: boolean
          uploaded_at?: string | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          material_id?: string
          document_type?: 'tds' | 'test_certificate' | 'mir' | 'delivery_challan' | 'eway_bill' | 'invoice'
          file_path?: string | null
          file_name?: string | null
          is_applicable?: boolean
          is_uploaded?: boolean
          uploaded_at?: string | null
          notes?: string | null
          created_at?: string
        }
      }
      checklists: {
        Row: {
          id: string
          headline_id: string
          name: string
          created_at: string
        }
        Insert: {
          id?: string
          headline_id: string
          name: string
          created_at?: string
        }
        Update: {
          id?: string
          headline_id?: string
          name?: string
          created_at?: string
        }
      }
      checklist_items: {
        Row: {
          id: string
          checklist_id: string
          activity_name: string
          sort_order: number | null
          status: 'pending' | 'in_progress' | 'completed'
          completed_at: string | null
          completed_by: string | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          checklist_id: string
          activity_name: string
          sort_order?: number | null
          status?: 'pending' | 'in_progress' | 'completed'
          completed_at?: string | null
          completed_by?: string | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          checklist_id?: string
          activity_name?: string
          sort_order?: number | null
          status?: 'pending' | 'in_progress' | 'completed'
          completed_at?: string | null
          completed_by?: string | null
          notes?: string | null
          created_at?: string
        }
      }
      jmr_reports: {
        Row: {
          id: string
          headline_id: string
          report_number: string | null
          measurement_date: string | null
          customer_representative: string | null
          contractor_representative: string | null
          status: 'draft' | 'submitted' | 'approved' | 'disputed'
          discrepancies: string | null
          file_path: string | null
          approved_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          headline_id: string
          report_number?: string | null
          measurement_date?: string | null
          customer_representative?: string | null
          contractor_representative?: string | null
          status?: 'draft' | 'submitted' | 'approved' | 'disputed'
          discrepancies?: string | null
          file_path?: string | null
          approved_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          headline_id?: string
          report_number?: string | null
          measurement_date?: string | null
          customer_representative?: string | null
          contractor_representative?: string | null
          status?: 'draft' | 'submitted' | 'approved' | 'disputed'
          discrepancies?: string | null
          file_path?: string | null
          approved_at?: string | null
          created_at?: string
        }
      }
      jmr_line_items: {
        Row: {
          id: string
          jmr_id: string
          line_item_id: string
          boq_quantity: number | null
          executed_quantity: number | null
          approved_quantity: number | null
          remarks: string | null
          created_at: string
        }
        Insert: {
          id?: string
          jmr_id: string
          line_item_id: string
          boq_quantity?: number | null
          executed_quantity?: number | null
          approved_quantity?: number | null
          remarks?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          jmr_id?: string
          line_item_id?: string
          boq_quantity?: number | null
          executed_quantity?: number | null
          approved_quantity?: number | null
          remarks?: string | null
          created_at?: string
        }
      }
      invoices: {
        Row: {
          id: string
          site_id: string
          jmr_id: string | null
          invoice_number: string
          invoice_date: string
          total_amount: number | null
          gst_amount: number | null
          grand_total: number | null
          status: 'draft' | 'sent' | 'partially_paid' | 'paid'
          payment_due_date: string | null
          file_path: string | null
          created_at: string
        }
        Insert: {
          id?: string
          site_id: string
          jmr_id?: string | null
          invoice_number: string
          invoice_date: string
          total_amount?: number | null
          gst_amount?: number | null
          grand_total?: number | null
          status?: 'draft' | 'sent' | 'partially_paid' | 'paid'
          payment_due_date?: string | null
          file_path?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          site_id?: string
          jmr_id?: string | null
          invoice_number?: string
          invoice_date?: string
          total_amount?: number | null
          gst_amount?: number | null
          grand_total?: number | null
          status?: 'draft' | 'sent' | 'partially_paid' | 'paid'
          payment_due_date?: string | null
          file_path?: string | null
          created_at?: string
        }
      }
      payments: {
        Row: {
          id: string
          invoice_id: string
          payment_date: string
          amount: number
          payment_mode: string | null
          reference_number: string | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          invoice_id: string
          payment_date: string
          amount: number
          payment_mode?: string | null
          reference_number?: string | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          invoice_id?: string
          payment_date?: string
          amount?: number
          payment_mode?: string | null
          reference_number?: string | null
          notes?: string | null
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}

// Helper types
export type Site = Database['public']['Tables']['sites']['Row']
export type Package = Database['public']['Tables']['packages']['Row']
export type BOQHeadline = Database['public']['Tables']['boq_headlines']['Row']
export type BOQLineItem = Database['public']['Tables']['boq_line_items']['Row']
export type Material = Database['public']['Tables']['materials']['Row']
export type MaterialReceipt = Database['public']['Tables']['material_receipts']['Row']
export type ComplianceDocument = Database['public']['Tables']['compliance_documents']['Row']
export type Checklist = Database['public']['Tables']['checklists']['Row']
export type ChecklistItem = Database['public']['Tables']['checklist_items']['Row']
export type JMRReport = Database['public']['Tables']['jmr_reports']['Row']
export type JMRLineItem = Database['public']['Tables']['jmr_line_items']['Row']
export type Invoice = Database['public']['Tables']['invoices']['Row']
export type Payment = Database['public']['Tables']['payments']['Row']
