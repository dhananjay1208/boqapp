const XLSX = require('xlsx');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
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

async function main() {
  // Check existing materials
  const { data: existingMaterials } = await supabase.from('master_materials').select('name');
  const existingMatNames = new Set((existingMaterials || []).map(m => m.name.toLowerCase()));
  console.log('Existing materials:', existingMatNames.size);

  // Check existing suppliers
  const { data: existingSuppliers } = await supabase.from('suppliers').select('supplier_name');
  const existingSuppNames = new Set((existingSuppliers || []).map(s => s.supplier_name.toLowerCase()));
  console.log('Existing suppliers:', existingSuppNames.size);

  // Read Excel file
  const filePath = path.join('..', 'Materials and Suppliers.xlsx');
  const workbook = XLSX.readFile(filePath);

  // Get Materials - filter out existing ones
  const materialsSheet = workbook.Sheets['Materials'];
  const materialsData = XLSX.utils.sheet_to_json(materialsSheet, { header: 1 });
  const allMaterials = materialsData.slice(1)
    .filter(row => row[0])
    .map(row => ({
      name: String(row[0]).trim(),
      unit: row[1] ? String(row[1]).trim() : 'Nos',
      category: 'General',
      is_active: true
    }));

  const materials = allMaterials.filter(m => {
    return !existingMatNames.has(m.name.toLowerCase());
  });

  console.log('\nTotal materials in Excel:', allMaterials.length);
  console.log('New materials to insert:', materials.length);

  // Get Suppliers - filter out existing ones
  const suppliersSheet = workbook.Sheets['Suppliers'];
  const suppliersData = XLSX.utils.sheet_to_json(suppliersSheet, { header: 1 });
  const allSuppliers = suppliersData.slice(1)
    .filter(row => row[0])
    .map(row => ({
      supplier_name: String(row[0]).trim()
    }));

  const suppliers = allSuppliers.filter(s => {
    return !existingSuppNames.has(s.supplier_name.toLowerCase());
  });

  console.log('\nTotal suppliers in Excel:', allSuppliers.length);
  console.log('New suppliers to insert:', suppliers.length);

  if (materials.length > 0) {
    console.log('\nInserting materials...');
    const { data, error } = await supabase.from('master_materials').insert(materials);
    if (error) {
      console.error('Error:', error.message);
    } else {
      console.log('Inserted', materials.length, 'materials successfully');
    }
  } else {
    console.log('\nNo new materials to insert');
  }

  if (suppliers.length > 0) {
    console.log('\nInserting suppliers...');
    const { data, error } = await supabase.from('suppliers').insert(suppliers);
    if (error) {
      console.error('Error:', error.message);
    } else {
      console.log('Inserted', suppliers.length, 'suppliers successfully');
    }
  } else {
    console.log('\nNo new suppliers to insert');
  }

  // Final counts
  const { count: matCount } = await supabase.from('master_materials').select('*', { count: 'exact', head: true });
  const { count: suppCount } = await supabase.from('suppliers').select('*', { count: 'exact', head: true });

  console.log('\n=== FINAL COUNTS ===');
  console.log('Materials in database:', matCount);
  console.log('Suppliers in database:', suppCount);
}

main().catch(console.error);
