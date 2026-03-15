const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

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

// TCS-Visakhapatnam consolidated invoices folder
const INVOICES_FOLDER = 'C:/Users/DK/Desktop/Projects/Dheera Construction/Invoices/11 Mar Invoices/Consolidated Invoices';

// TCS-Visakhapatnam site ID
const SITE_ID = 'a8ef40c8-18fe-4b7f-a352-4279f4bbd9d1';

// Normalize string for comparison
function normalize(str) {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

async function main() {
  console.log('=== Invoice Document Upload Script (TCS-Visakhapatnam) ===\n');

  // Step 1: Get GRN invoices for TCS-Visakhapatnam
  console.log('Step 1: Loading GRN invoices for TCS-Visakhapatnam...');

  const { data: grnInvoices, error: grnError } = await supabase
    .from('grn_invoices')
    .select('id, invoice_number')
    .eq('site_id', SITE_ID);

  if (grnError) {
    console.error('Error fetching GRN invoices:', grnError.message);
    return;
  }

  console.log(`  Found ${grnInvoices.length} GRN invoices`);

  // Create lookup maps
  const invoiceByExact = new Map();
  const invoiceByNormalized = new Map();
  grnInvoices.forEach(inv => {
    invoiceByExact.set(inv.invoice_number, inv);
    invoiceByNormalized.set(normalize(inv.invoice_number), inv);
  });

  // Step 2: List invoice files
  console.log('\nStep 2: Reading invoice files...');
  const files = fs.readdirSync(INVOICES_FOLDER).filter(f => f.endsWith('.pdf'));
  console.log(`  Found ${files.length} PDF files`);

  // Step 3: Match files to invoices
  console.log('\nStep 3: Matching files to GRN invoices...');
  const matches = [];
  const unmatched = [];

  for (const file of files) {
    let invoice = null;

    // Try exact match on invoice number
    const fileBase = file.replace('.pdf', '');
    invoice = invoiceByExact.get(fileBase);

    // Try normalized matching
    if (!invoice) {
      const normalizedFile = normalize(fileBase);
      invoice = invoiceByNormalized.get(normalizedFile);

      // Try partial match
      if (!invoice) {
        for (const [normInv, inv] of invoiceByNormalized.entries()) {
          if (normInv.includes(normalizedFile) || normalizedFile.includes(normInv)) {
            invoice = inv;
            break;
          }
        }
      }
    }

    if (invoice) {
      matches.push({ file, invoice });
    } else {
      unmatched.push(file);
    }
  }

  console.log(`  Matched: ${matches.length}`);
  console.log(`  Unmatched: ${unmatched.length}`);

  if (unmatched.length > 0) {
    console.log('\n  Unmatched files:');
    unmatched.forEach(f => console.log(`    - ${f}`));
  }

  // Show matches
  console.log('\n  Matched files:');
  matches.forEach(m => console.log(`    ${m.file} -> ${m.invoice.invoice_number}`));

  // Step 4: Check existing uploads
  console.log('\nStep 4: Checking for already uploaded documents...');
  const invoiceIds = matches.map(m => m.invoice.id);
  const { data: existingDCs } = await supabase
    .from('grn_invoice_dc')
    .select('grn_invoice_id, is_uploaded')
    .in('grn_invoice_id', invoiceIds);

  const alreadyUploaded = new Set();
  (existingDCs || []).forEach(dc => {
    if (dc.is_uploaded) alreadyUploaded.add(dc.grn_invoice_id);
  });
  console.log(`  Already uploaded: ${alreadyUploaded.size}`);

  // Step 5: Upload files
  console.log('\nStep 5: Uploading invoice documents...');
  let uploadedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const match of matches) {
    const { file, invoice } = match;

    // Skip if already uploaded
    if (alreadyUploaded.has(invoice.id)) {
      console.log(`  ⊘ ${file} -> already uploaded`);
      skippedCount++;
      continue;
    }

    const filePath = path.join(INVOICES_FOLDER, file);

    // Read file
    const fileBuffer = fs.readFileSync(filePath);
    const storagePath = `grn-invoices/${SITE_ID}/${invoice.id}/${file}`;

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('compliance-docs')
      .upload(storagePath, fileBuffer, {
        contentType: 'application/pdf',
        upsert: true
      });

    if (uploadError) {
      console.error(`  ✗ Error uploading ${file}:`, uploadError.message);
      errorCount++;
      continue;
    }

    // Check if DC record exists
    const { data: existingDC } = await supabase
      .from('grn_invoice_dc')
      .select('id')
      .eq('grn_invoice_id', invoice.id)
      .single();

    if (existingDC) {
      // Update existing record
      const { error: updateError } = await supabase
        .from('grn_invoice_dc')
        .update({
          is_uploaded: true,
          file_path: storagePath,
          file_name: file,
          uploaded_at: new Date().toISOString()
        })
        .eq('id', existingDC.id);

      if (updateError) {
        console.error(`  ✗ Error updating DC record for ${file}:`, updateError.message);
        errorCount++;
        continue;
      }
    } else {
      // Create new DC record
      const { error: insertError } = await supabase
        .from('grn_invoice_dc')
        .insert({
          grn_invoice_id: invoice.id,
          is_applicable: true,
          is_uploaded: true,
          file_path: storagePath,
          file_name: file,
          uploaded_at: new Date().toISOString()
        });

      if (insertError) {
        console.error(`  ✗ Error creating DC record for ${file}:`, insertError.message);
        errorCount++;
        continue;
      }
    }

    console.log(`  ✓ ${file} -> ${invoice.invoice_number}`);
    uploadedCount++;
  }

  console.log('\n=== Upload Summary ===');
  console.log(`Successfully uploaded: ${uploadedCount}`);
  console.log(`Skipped (already uploaded): ${skippedCount}`);
  console.log(`Errors: ${errorCount}`);
  console.log(`Unmatched files: ${unmatched.length}`);

  // Final count for this site
  const { count: dcCount } = await supabase
    .from('grn_invoice_dc')
    .select('*, grn_invoices!inner(site_id)', { count: 'exact', head: true })
    .eq('grn_invoices.site_id', SITE_ID)
    .eq('is_uploaded', true);

  console.log(`\nTotal uploaded DC documents for TCS-Visakhapatnam: ${dcCount}`);
}

main().catch(console.error);
