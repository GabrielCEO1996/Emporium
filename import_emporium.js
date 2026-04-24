// =============================================
// EMPORIUM - Importación desde Listaso
// 136 clientes + 340 productos con precio/costo
// =============================================

const { createClient } = require('@supabase/supabase-js');
const XLSX = require('xlsx');
const fs = require('fs');

// ⚠️ PEGA TUS DATOS AQUÍ:
const SUPABASE_URL = 'https://axeefndebatrmgqzncuo.supabase.co';
const SUPABASE_KEY = 'sb_publishable_pa8oly3PjVJJj53leuonSA_N7s1GP-O'; // tu anon key

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// =============================================
// 1. IMPORTAR CLIENTES (136)
// =============================================
async function importarClientes() {
  console.log('\n📋 Importando clientes...');
  
  const csv = fs.readFileSync('./listaso_clientes.csv', 'utf8');
  const lines = csv.split('\n').filter(l => l.trim());
  
  const clientes = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsv(lines[i]);
    const nombre = cols[3]?.trim();
    if (!nombre || nombre === 'NA') continue;
    
    const address = cols[9] || '';
    const parts = address.split(',').map(p => p.trim());
    const ciudad = parts.length >= 2 ? parts[parts.length - 2] : null;
    const direccion = parts.length >= 2 ? parts.slice(0, -2).join(', ') : address;
    
    clientes.push({
      nombre,
      telefono: cols[8]?.trim() || null,
      whatsapp: cols[8]?.trim() || null,
      direccion: direccion || null,
      ciudad: ciudad || null,
      tipo_cliente: 'mayorista',
      activo: true,
      credito_autorizado: false,
      credito_disponible: 0,
      credito_usado: 0,
      deuda_total: 0,
    });
  }
  
  console.log(`  📊 ${clientes.length} clientes a importar`);
  
  let ok = 0;
  for (let i = 0; i < clientes.length; i += 50) {
    const { error } = await supabase.from('clientes').insert(clientes.slice(i, i + 50));
    if (error) console.error(`  ❌ Lote ${i}:`, error.message);
    else { ok += Math.min(50, clientes.length - i); process.stdout.write(`\r  ✅ ${ok}/${clientes.length}`); }
  }
  console.log(`\n  ✅ ${ok} clientes importados!`);
}

// =============================================
// 2. IMPORTAR PRODUCTOS + INVENTARIO (340)
// =============================================
async function importarProductos() {
  console.log('\n📦 Importando productos con precio y costo...');
  
  const wb = XLSX.readFile('./CurrentInventoryEvaluation.xlsx');
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
  
  // Extraer solo filas con código numérico (los 340 productos con precio)
  const items = [];
  for (const row of rows) {
    if (!row[0] || isNaN(String(row[0]))) continue;
    if (!row[2] || !row[4]) continue; // Necesita nombre y precio
    
    items.push({
      codigo: String(row[0]).trim(),
      categoria: String(row[1] || 'General').trim(),
      nombre: String(row[2]).trim().substring(0, 200),
      stock: parseFloat(row[3]) || 0,
      precio_venta: parseFloat(row[4]) || 0,
      precio_costo: parseFloat(row[6]) || 0,
    });
  }
  
  console.log(`  📊 ${items.length} productos a importar`);
  
  let ok = 0;
  for (let i = 0; i < items.length; i += 30) {
    const batch = items.slice(i, i + 30);
    
    // Insertar productos
    const productos = batch.map(p => ({
      codigo: p.codigo,
      nombre: p.nombre,
      descripcion: null,
      categoria: p.categoria,
      tiene_vencimiento: false,
      stock_minimo: 5,
      precio_venta_sugerido: p.precio_venta,
    }));
    
    const { data: prodData, error: prodError } = await supabase
      .from('productos')
      .insert(productos)
      .select('id, codigo');
    
    if (prodError) {
      console.error(`  ❌ Error productos lote ${i}:`, prodError.message);
      continue;
    }
    
    // Insertar inventario
    const inventario = prodData.map(prod => {
      const item = batch.find(b => b.codigo === prod.codigo);
      return {
        producto_id: prod.id,
        presentacion_id: null,
        numero_lote: null,
        fecha_vencimiento: null,
        stock_total: Math.max(0, Math.round(item?.stock || 0)),
        stock_reservado: 0,
        precio_venta: item?.precio_venta || 0,
        precio_costo: item?.precio_costo || 0,
      };
    });
    
    const { error: invError } = await supabase.from('inventario').insert(inventario);
    if (invError) console.error(`  ❌ Error inventario lote ${i}:`, invError.message);
    
    ok += batch.length;
    process.stdout.write(`\r  ✅ ${ok}/${items.length}`);
  }
  
  console.log(`\n  ✅ ${ok} productos + inventario importados!`);
}

// =============================================
// HELPER CSV
// =============================================
function parseCsv(line) {
  const result = [];
  let cur = '';
  let inQ = false;
  for (const ch of line) {
    if (ch === '"') inQ = !inQ;
    else if (ch === ',' && !inQ) { result.push(cur); cur = ''; }
    else cur += ch;
  }
  result.push(cur);
  return result;
}

// =============================================
// MAIN
// =============================================
async function main() {
  console.log('🚀 Importación Listaso → Emporium');
  console.log('==================================');
  
  // Test conexión
  const { error } = await supabase.from('clientes').select('count').limit(1);
  if (error) {
    console.error('❌ No se pudo conectar:', error.message);
    process.exit(1);
  }
  console.log('✅ Conectado a Supabase');
  
  await importarClientes();
  await importarProductos();
  
  console.log('\n==================================');
  console.log('🎉 Importación completada!');
  console.log('   Revisa Clientes y Productos en Emporium');
}

main().catch(console.error);
