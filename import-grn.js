const XLSX = require('xlsx');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Read .env.local manually
const envContent = fs.readFileSync('.env.local', 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    envVars[match[1].trim()] = match[2].trim();
  }
});

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Parse date from "DD-MMM-YYYY" to "YYYY-MM-DD"
function parseDate(dateStr) {
  if (!dateStr) return null;
  const months = {
    'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
    'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
    'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
  };
  const parts = String(dateStr).match(/(\d{1,2})-(\w{3})-(\d{4})/);
  if (parts) {
    const day = parts[1].padStart(2, '0');
    const month = months[parts[2]];
    const year = parts[3];
    return `${year}-${month}-${day}`;
  }
  return null;
}

async function main() {
  console.log('=== GRN Import Script ===\n');

  // Step 1: Get TCS-Vizag site
  console.log('Step 1: Finding TCS-Vizag site...');
  const { data: sites, error: siteError } = await supabase
    .from('sites')
    .select('id, name')
    .ilike('name', '%vizag%');

  if (siteError || !sites || sites.length === 0) {
    console.error('Error: TCS-Vizag site not found');
    console.log('Available sites:');
    const { data: allSites } = await supabase.from('sites').select('id, name');
    allSites?.forEach(s => console.log(`  - ${s.name} (${s.id})`));
    return;
  }

  const siteId = sites[0].id;
  console.log(`  Found: ${sites[0].name} (${siteId})`);

  // Step 2: Load existing suppliers
  console.log('\nStep 2: Loading existing suppliers...');
  const { data: existingSuppliers } = await supabase
    .from('suppliers')
    .select('id, supplier_name');

  const supplierMap = new Map();
  (existingSuppliers || []).forEach(s => {
    supplierMap.set(s.supplier_name.toLowerCase().trim(), s.id);
  });
  console.log(`  Found ${supplierMap.size} existing suppliers`);

  // Step 3: Load existing materials
  console.log('\nStep 3: Loading existing materials...');
  const { data: existingMaterials } = await supabase
    .from('master_materials')
    .select('id, name, unit');

  const materialMap = new Map();
  (existingMaterials || []).forEach(m => {
    materialMap.set(m.name.toLowerCase().trim(), { id: m.id, unit: m.unit });
  });
  console.log(`  Found ${materialMap.size} existing materials`);

  // Step 4: Read Excel file
  console.log('\nStep 4: Reading Excel file...');
  const filePath = 'C:/Users/DK/Desktop/Projects/Dheera Construction/Invoices/Consolidated/Final/Consolidated_100_Invoices_Updated.xlsx';
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets['Consolidated Invoice Data'];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  // Parse invoices from Excel
  // Excel columns: 0:Invoice, 1:Supplier, 2:InvAmt, 3:Date, 4:Material, 5:Qty, 6:Unit, 7:Rate, 8:AmtNoGST, 9:AmtWithGST
  const invoices = [];
  let currentInvoice = null;

  data.slice(2).forEach((row) => {
    const invoiceNo = row[0];
    const supplierName = row[1];
    const invoiceDate = row[3];
    const materialDesc = row[4];
    const qty = parseFloat(row[5]) || 0;
    const unit = row[6];
    const rate = parseFloat(row[7]) || 0;           // Use EXACT Rate from Excel
    const amountNoGst = parseFloat(row[8]) || 0;    // Use EXACT Amount from Excel
    const amountWithGst = parseFloat(row[9]) || 0;  // Use EXACT Amount with GST from Excel

    if (invoiceNo) {
      currentInvoice = {
        invoice_number: String(invoiceNo).trim(),
        supplier_name: supplierName ? String(supplierName).trim() : '',
        invoice_date: parseDate(invoiceDate),
        line_items: []
      };
      invoices.push(currentInvoice);
    }

    if (materialDesc && currentInvoice && qty > 0) {
      currentInvoice.line_items.push({
        material_name: String(materialDesc).trim(),
        quantity: qty,
        unit: unit ? String(unit).trim() : 'Nos',
        rate: rate,
        amount_without_gst: amountNoGst,
        amount_with_gst: amountWithGst
      });
    }
  });

  console.log(`  Parsed ${invoices.length} invoices with ${invoices.reduce((sum, inv) => sum + inv.line_items.length, 0)} line items`);

  // Step 5: Identify missing suppliers and materials
  console.log('\nStep 5: Checking for missing suppliers and materials...');

  const missingSuppliers = new Set();
  const missingMaterials = new Map();

  invoices.forEach(inv => {
    const suppKey = inv.supplier_name.toLowerCase().trim();
    if (!supplierMap.has(suppKey)) {
      missingSuppliers.add(inv.supplier_name);
    }

    inv.line_items.forEach(item => {
      const matKey = item.material_name.toLowerCase().trim();
      if (!materialMap.has(matKey)) {
        missingMaterials.set(item.material_name, item.unit);
      }
    });
  });

  console.log(`  Missing suppliers: ${missingSuppliers.size}`);
  console.log(`  Missing materials: ${missingMaterials.size}`);

  // Step 6: Create missing suppliers
  if (missingSuppliers.size > 0) {
    console.log('\nStep 6: Creating missing suppliers...');
    const newSuppliers = [...missingSuppliers].map(name => ({ supplier_name: name }));

    const { data: insertedSuppliers, error: suppError } = await supabase
      .from('suppliers')
      .insert(newSuppliers)
      .select('id, supplier_name');

    if (suppError) {
      console.error('  Error creating suppliers:', suppError.message);
      return;
    }

    insertedSuppliers.forEach(s => {
      supplierMap.set(s.supplier_name.toLowerCase().trim(), s.id);
    });
    console.log(`  Created ${insertedSuppliers.length} suppliers`);
  }

  // Step 7: Create missing materials
  if (missingMaterials.size > 0) {
    console.log('\nStep 7: Creating missing materials...');
    const newMaterials = [...missingMaterials.entries()].map(([name, unit]) => ({
      name: name,
      unit: unit || 'Nos',
      category: 'General',
      is_active: true
    }));

    const { data: insertedMaterials, error: matError } = await supabase
      .from('master_materials')
      .insert(newMaterials)
      .select('id, name, unit');

    if (matError) {
      console.error('  Error creating materials:', matError.message);
      return;
    }

    insertedMaterials.forEach(m => {
      materialMap.set(m.name.toLowerCase().trim(), { id: m.id, unit: m.unit });
    });
    console.log(`  Created ${insertedMaterials.length} materials`);
  }

  // Step 8: Check for existing GRN invoices to avoid duplicates
  console.log('\nStep 8: Checking for existing GRN invoices...');
  const { data: existingGrn } = await supabase
    .from('grn_invoices')
    .select('invoice_number')
    .eq('site_id', siteId);

  const existingInvoiceNos = new Set((existingGrn || []).map(g => g.invoice_number.toLowerCase()));
  console.log(`  Found ${existingInvoiceNos.size} existing GRN invoices for this site`);

  // Filter out existing invoices
  const newInvoices = invoices.filter(inv => !existingInvoiceNos.has(inv.invoice_number.toLowerCase()));
  console.log(`  New invoices to import: ${newInvoices.length}`);

  if (newInvoices.length === 0) {
    console.log('\nNo new invoices to import. All invoices already exist.');
    return;
  }

  // Step 9: Create GRN invoices and line items
  console.log('\nStep 9: Creating GRN entries...');
  let successCount = 0;
  let errorCount = 0;
  let lineItemCount = 0;

  for (const inv of newInvoices) {
    const suppKey = inv.supplier_name.toLowerCase().trim();
    const supplierId = supplierMap.get(suppKey);

    if (!supplierId) {
      console.error(`  Supplier not found: ${inv.supplier_name}`);
      errorCount++;
      continue;
    }

    if (!inv.invoice_date) {
      console.error(`  Invalid date for invoice: ${inv.invoice_number}`);
      errorCount++;
      continue;
    }

    // Create GRN invoice
    const { data: grnInvoice, error: grnError } = await supabase
      .from('grn_invoices')
      .insert({
        site_id: siteId,
        supplier_id: supplierId,
        invoice_number: inv.invoice_number,
        grn_date: inv.invoice_date
      })
      .select('id')
      .single();

    if (grnError) {
      console.error(`  Error creating GRN invoice ${inv.invoice_number}:`, grnError.message);
      errorCount++;
      continue;
    }

    // Create line items with exact values from Excel
    const lineItems = inv.line_items.map(item => {
      const matKey = item.material_name.toLowerCase().trim();
      const material = materialMap.get(matKey);

      return {
        grn_invoice_id: grnInvoice.id,
        material_id: material?.id,
        material_name: item.material_name,
        quantity: item.quantity,
        unit: item.unit,
        rate: item.rate,
        gst_rate: 18.00,
        amount_without_gst: item.amount_without_gst,
        amount_with_gst: item.amount_with_gst
      };
    }).filter(item => item.material_id); // Only items with valid material_id

    if (lineItems.length > 0) {
      const { error: lineError } = await supabase
        .from('grn_line_items')
        .insert(lineItems);

      if (lineError) {
        console.error(`  Error creating line items for ${inv.invoice_number}:`, lineError.message);
      } else {
        lineItemCount += lineItems.length;
      }
    }

    successCount++;
  }

  console.log('\n=== Import Summary ===');
  console.log(`GRN Invoices created: ${successCount}`);
  console.log(`Line items created: ${lineItemCount}`);
  console.log(`Errors: ${errorCount}`);

  // Final counts
  const { count: grnCount } = await supabase.from('grn_invoices').select('*', { count: 'exact', head: true }).eq('site_id', siteId);
  const { count: lineCount } = await supabase.from('grn_line_items').select('*', { count: 'exact', head: true });

  console.log('\n=== Final Database Counts ===');
  console.log(`GRN Invoices (TCS-Vizag): ${grnCount}`);
  console.log(`Total GRN Line Items: ${lineCount}`);
}

main().catch(console.error);
