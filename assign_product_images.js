// =============================================
// EMPORIUM - Asignar fotos a productos desde Unsplash
// Corre: node assign_product_images.js
// =============================================

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://axeefndebatrmgqzncuo.supabase.co';
const SUPABASE_KEY = 'sb_publishable_pa8oly3PjVJJj53leuonSA_N7s1GP-O';
const UNSPLASH_KEY = '9IwbiQ_UpT9LGVjJkIfqw6ummxtDUJQezL2WP7v_dSs';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// =============================================
// Limpieza de nombre para búsqueda
// =============================================
function cleanSearchTerm(nombre) {
  return nombre
    .toLowerCase()
    .replace(/\d+\s*(oz|ml|ltr?|mg|gr?|lb|kg|cm|pz|pk|ct|un|cs|fl)/gi, '')
    .replace(/\+/g, '')
    .replace(/\s+/g, ' ')
    .replace(/(dlc|inc|llc|corp|co\.|ltd)/gi, '')
    .replace(/[#\-_]/g, ' ')
    .replace(/jaloma|marianella|goya|nestl[eé]|palmolive|colgate|unilever/gi, '')
    .trim()
    .split(' ')
    .slice(0, 4)
    .join(' ');
}

// =============================================
// Búsqueda en Unsplash
// =============================================
async function searchUnsplash(query) {
  const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=1&orientation=squarish&content_filter=high`;

  const res = await fetch(url, {
    headers: {
      'Authorization': `Client-ID ${UNSPLASH_KEY}`,
      'Accept-Version': 'v1'
    }
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Unsplash error ${res.status}: ${err.substring(0, 100)}`);
  }

  const data = await res.json();
  if (data.results && data.results.length > 0) {
    return data.results[0].urls.regular;
  }
  return null;
}

// =============================================
// Esperar (para respetar rate limits)
// =============================================
const sleep = ms => new Promise(r => setTimeout(r, ms));

// =============================================
// MAIN
// =============================================
async function main() {
  console.log('🖼️  Asignando fotos a productos desde Unsplash');
  console.log('==============================================');

  // Traer todos los productos sin imagen
  const { data: productos, error } = await supabase
    .from('productos')
    .select('id, nombre, categoria, imagen_url')
    .is('imagen_url', null)
    .order('nombre');

  if (error) {
    console.error('❌ Error cargando productos:', error.message);
    process.exit(1);
  }

  console.log(`📦 ${productos.length} productos sin foto\n`);

  let ok = 0, failed = 0, skipped = 0;

  for (let i = 0; i < productos.length; i++) {
    const prod = productos[i];
    const searchTerm = cleanSearchTerm(prod.nombre);

    if (!searchTerm || searchTerm.length < 3) {
      skipped++;
      continue;
    }

    try {
      // Buscar en Unsplash
      let imageUrl = await searchUnsplash(searchTerm);

      // Si no encuentra, buscar por categoría
      if (!imageUrl && prod.categoria) {
        imageUrl = await searchUnsplash(prod.categoria + ' product');
      }

      // Fallback: imagen genérica de producto farmacéutico
      if (!imageUrl) {
        imageUrl = 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&q=80';
      }

      // Actualizar en Supabase
      const { error: updateError } = await supabase
        .from('productos')
        .update({ imagen_url: imageUrl })
        .eq('id', prod.id);

      if (updateError) {
        console.error(`  ❌ ${prod.nombre}: ${updateError.message}`);
        failed++;
      } else {
        ok++;
        process.stdout.write(`\r  ✅ ${ok}/${productos.length} - ${prod.nombre.substring(0, 40)}`);
      }

      // Rate limit: 50 req/hora = 1 cada 1.2 segundos
      await sleep(1300);

    } catch (err) {
      console.error(`\n  ❌ Error en ${prod.nombre}: ${err.message}`);
      failed++;
      await sleep(2000); // Esperar más si hay error
    }
  }

  console.log(`\n\n==============================================`);
  console.log(`✅ Completado: ${ok} fotos asignadas`);
  console.log(`❌ Fallidos: ${failed}`);
  console.log(`⏭️  Saltados: ${skipped}`);
  console.log(`\nRevisa Emporium → Productos para ver los resultados`);
}

main().catch(console.error);
