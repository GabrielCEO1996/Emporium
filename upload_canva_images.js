// =============================================
// EMPORIUM - Subir imágenes Canva y asociar a productos
// 1. Sube cada imagen a Supabase Storage
// 2. Hace fuzzy matching con productos por nombre
// 3. Actualiza imagen_url automáticamente
// =============================================

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://axeefndebatrmgqzncuo.supabase.co';
const SUPABASE_KEY = 'sb_publishable_pa8oly3PjVJJj53leuonSA_N7s1GP-O';
const BUCKET = 'productos';
const IMAGES_FOLDER = './canva_imgs';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// =============================================
// LIMPIEZA Y NORMALIZACIÓN
// =============================================
function normalize(text) {
  return text
    .toLowerCase()
    .replace(/\.jpg|\.png|\.jpeg/gi, '')
    .replace(/#u00a0/gi, ' ')
    .replace(/#u00d1/gi, 'ñ')
    .replace(/#u00f1/gi, 'ñ')
    .replace(/[áàäâ]/gi, 'a')
    .replace(/[éèëê]/gi, 'e')
    .replace(/[íìïî]/gi, 'i')
    .replace(/[óòöô]/gi, 'o')
    .replace(/[úùüû]/gi, 'u')
    .replace(/[#_\-\/\\\.,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Algoritmo de similitud (Jaro-Winkler simplificado)
function similarity(a, b) {
  const aTokens = new Set(normalize(a).split(' ').filter(t => t.length > 1));
  const bTokens = new Set(normalize(b).split(' ').filter(t => t.length > 1));
  
  let matches = 0;
  for (const token of aTokens) {
    if (bTokens.has(token)) matches++;
  }
  
  // Score basado en intersección de tokens
  const total = Math.max(aTokens.size, bTokens.size);
  return total > 0 ? matches / total : 0;
}

// =============================================
// MAIN
// =============================================
async function main() {
  console.log('🖼️  Subiendo imágenes Canva a Emporium');
  console.log('=========================================\n');

  // 1. Cargar productos
  console.log('📦 Cargando productos de Supabase...');
  const { data: productos, error: prodError } = await supabase
    .from('productos')
    .select('id, nombre, imagen_url')
    .range(0, 999);

  if (prodError) {
    console.error('❌ Error cargando productos:', prodError.message);
    process.exit(1);
  }
  console.log(`   ${productos.length} productos en DB\n`);

  // 2. Listar imágenes locales
  const imageFiles = fs.readdirSync(IMAGES_FOLDER)
    .filter(f => /\.(jpg|jpeg|png)$/i.test(f));
  console.log(`📁 ${imageFiles.length} imágenes en ${IMAGES_FOLDER}\n`);

  let uploaded = 0;
  let matched = 0;
  let noMatch = [];

  // 3. Procesar cada imagen
  for (let i = 0; i < imageFiles.length; i++) {
    const filename = imageFiles[i];
    const cleanName = normalize(filename);

    // Match con producto más similar (umbral 0.5)
    let bestMatch = null;
    let bestScore = 0;
    
    for (const prod of productos) {
      const score = similarity(filename, prod.nombre);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = prod;
      }
    }

    process.stdout.write(`\r[${i + 1}/${imageFiles.length}] ${filename.substring(0, 50)}...`);

    if (!bestMatch || bestScore < 0.5) {
      noMatch.push({ filename, bestScore, bestMatch: bestMatch?.nombre });
      continue;
    }

    // 4. Subir imagen a Storage
    const filepath = path.join(IMAGES_FOLDER, filename);
    const fileBuffer = fs.readFileSync(filepath);
    const safeFilename = filename
      .replace(/#U00a0/gi, '_')
      .replace(/#U00d1/gi, 'N')
      .replace(/#U00f1/gi, 'n')
      .replace(/[^a-zA-Z0-9._\-]/g, '_')
      .replace(/_+/g, '_');
    
    const storagePath = `canva/${safeFilename}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, fileBuffer, {
        contentType: 'image/jpeg',
        upsert: true
      });

    if (uploadError) {
      console.error(`\n❌ Upload error: ${uploadError.message}`);
      continue;
    }

    // 5. Obtener URL pública
    const { data: { publicUrl } } = supabase.storage
      .from(BUCKET)
      .getPublicUrl(storagePath);

    // 6. Actualizar producto
    const { error: updateError } = await supabase
      .from('productos')
      .update({ imagen_url: publicUrl })
      .eq('id', bestMatch.id);

    if (updateError) {
      console.error(`\n❌ Update error: ${updateError.message}`);
      continue;
    }

    uploaded++;
    matched++;
  }

  console.log('\n\n=========================================');
  console.log(`✅ ${matched} productos con imagen asignada`);
  console.log(`📤 ${uploaded} imágenes subidas a Storage`);
  console.log(`⚠️  ${noMatch.length} sin match (score < 50%):\n`);
  
  noMatch.slice(0, 20).forEach(item => {
    console.log(`   ${item.filename}`);
    if (item.bestMatch) {
      console.log(`     → mejor candidato: "${item.bestMatch}" (score: ${(item.bestScore * 100).toFixed(0)}%)`);
    }
  });
  
  if (noMatch.length > 20) {
    console.log(`   ... y ${noMatch.length - 20} más`);
  }

  // Guardar lista de no-matches para revisión manual
  fs.writeFileSync('./no_match.json', JSON.stringify(noMatch, null, 2));
  console.log('\n📝 Lista completa de no-matches guardada en no_match.json');
}

main().catch(console.error);
