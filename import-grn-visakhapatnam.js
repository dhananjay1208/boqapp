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

// Enhanced date parser — handles multiple formats:
//   DD-MMM-YYYY  (01-Oct-2025)
//   DD-MMM-YY    (24-Dec-25)
//   DD/MM/YYYY   (25/12/2025)
//   DD-MM-YYYY   (26-12-2025)
function parseDate(dateStr) {
  if (!dateStr) return null;
  const str = String(dateStr).trim();

  const months = {
    'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
    'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
    'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
  };

  // Format 1: DD-MMM-YYYY (e.g., 01-Oct-2025)
  let m = str.match(/^(\d{1,2})-(\w{3})-(\d{4})$/);
  if (m) {
    const month = months[m[2]];
    if (month) return `${m[3]}-${month}-${m[1].padStart(2, '0')}`;
  }

  // Format 2: DD-MMM-YY (e.g., 24-Dec-25)
  m = str.match(/^(\d{1,2})-(\w{3})-(\d{2})$/);
  if (m) {
    const month = months[m[2]];
    if (month) {
      const year = parseInt(m[3]) < 50 ? `20${m[3]}` : `19${m[3]}`;
      return `${year}-${month}-${m[1].padStart(2, '0')}`;
    }
  }

  // Format 3: DD/MM/YYYY (e.g., 25/12/2025)
  m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }

  // Format 4: DD-MM-YYYY (e.g., 26-12-2025)
  m = str.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (m) {
    return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }

  // Fallback: try JS Date parsing (handles Excel serial dates converted by xlsx)
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  return null;
}

async function main() {
  console.log('=== GRN Import Script — TCS-Visakhapatnam ===\n');

  // Step 1: Use hardcoded TCS-Visakhapatnam site ID
  const siteId = 'a8ef40c8-18fe-4b7f-a352-4279f4bbd9d1';
  console.log('Step 1: Using TCS-Visakhapatnam site');
  console.log(`  Site ID: ${siteId}`);

  // Verify site exists
  const { data: site, error: siteError } = await supabase
    .from('sites')
    .select('id, name')
    .eq('id', siteId)
    .single();

  if (siteError || !site) {
    console.error('Error: TCS-Visakhapatnam site not found with ID:', siteId);
    return;
  }
  console.log(`  Confirmed: ${site.name}`);

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
  const filePath = 'C:/Users/DK/Desktop/Projects/Dheera Construction/Invoices/11 Mar Invoices/Extracted Invoices/Dheera_Construction_Consolidated_Invoices.xlsx';
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets['Consolidated Invoice Data'];

  if (!sheet) {
    console.error('Error: Sheet "Consolidated Invoice Data" not found');
    console.log('Available sheets:', workbook.SheetNames);
    return;
  }

  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  // Parse invoices from Excel
  // Columns: 0:Invoice no. | 1:Supplier Name | 2:Invoice Amount (Incl GST) | 3:Date |
  //          4:Description of Goods | 5:Qty | 6:Unit | 7:Rate | 8:Amount | 9:Amount with GST (18%)
  const invoices = [];
  let currentInvoice = null;
  let dateParseFailures = [];

  data.slice(2).forEach((row, idx) => {
    const invoiceNo = row[0];
    const supplierName = row[1];
    const invoiceDate = row[3];
    const materialDesc = row[4];
    const qty = parseFloat(row[5]) || 0;
    const unit = row[6];
    const rate = parseFloat(row[7]) || 0;
    const amountNoGst = parseFloat(row[8]) || 0;
    const amountWithGst = parseFloat(row[9]) || 0;

    if (invoiceNo) {
      const parsedDate = parseDate(invoiceDate);
      if (!parsedDate && invoiceDate) {
        dateParseFailures.push({ row: idx + 3, invoice: invoiceNo, raw: String(invoiceDate) });
      }
      currentInvoice = {
        invoice_number: String(invoiceNo).trim(),
        supplier_name: supplierName ? String(supplierName).trim() : '',
        invoice_date: parsedDate,
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

  const totalLineItems = invoices.reduce((sum, inv) => sum + inv.line_items.length, 0);
  console.log(`  Parsed ${invoices.length} invoices with ${totalLineItems} line items`);

  if (dateParseFailures.length > 0) {
    console.log(`\n  ⚠ Date parse failures (${dateParseFailures.length}):`);
    dateParseFailures.forEach(f => {
      console.log(`    Row ${f.row}: Invoice ${f.invoice} — raw date: "${f.raw}"`);
    });
  }

  // Step 5: Identify missing suppliers and materials
  console.log('\nStep 5: Checking for missing suppliers and materials...');

  const missingSuppliers = new Set();
  const missingMaterials = new Map();

  invoices.forEach(inv => {
    const suppKey = inv.supplier_name.toLowerCase().trim();
    if (suppKey && !supplierMap.has(suppKey)) {
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
  if (missingSuppliers.size > 0) {
    console.log(`    ${[...missingSuppliers].join(', ')}`);
  }
  console.log(`  Missing materials: ${missingMaterials.size}`);
  if (missingMaterials.size > 0) {
    console.log(`    ${[...missingMaterials.keys()].join(', ')}`);
  }

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
  let skippedNoDate = 0;

  for (const inv of newInvoices) {
    const suppKey = inv.supplier_name.toLowerCase().trim();
    const supplierId = supplierMap.get(suppKey);

    if (!supplierId) {
      console.error(`  Supplier not found: "${inv.supplier_name}" (invoice: ${inv.invoice_number})`);
      errorCount++;
      continue;
    }

    if (!inv.invoice_date) {
      console.error(`  Invalid date for invoice: ${inv.invoice_number}`);
      skippedNoDate++;
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
        invoice_date: inv.invoice_date,
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
    }).filter(item => item.material_id);

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
    if (successCount % 20 === 0) {
      console.log(`  Progress: ${successCount}/${newInvoices.length} invoices...`);
    }
  }

  console.log('\n=== Import Summary ===');
  console.log(`GRN Invoices created: ${successCount}`);
  console.log(`Line items created: ${lineItemCount}`);
  console.log(`Errors: ${errorCount}`);
  if (skippedNoDate > 0) {
    console.log(`Skipped (no date): ${skippedNoDate}`);
  }

  // Final counts
  const { count: grnCount } = await supabase
    .from('grn_invoices')
    .select('*', { count: 'exact', head: true })
    .eq('site_id', siteId);

  console.log(`\n=== Final Database Counts ===`);
  console.log(`GRN Invoices (TCS-Visakhapatnam): ${grnCount}`);
}

main().catch(console.error);
