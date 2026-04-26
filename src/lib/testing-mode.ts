// ═══════════════════════════════════════════════════════════════════════════
// src/lib/testing-mode.ts
//
// Modo testing controlado por la env var NEXT_PUBLIC_IS_PRODUCTION.
//
// • NEXT_PUBLIC_IS_PRODUCTION = 'true'   → modo producción (default cuando
//                                          deployemos formal). Sin banner,
//                                          sin botones Eliminar.
// • NEXT_PUBLIC_IS_PRODUCTION = 'false'  → modo testing. Banner amarillo
//                                          arriba en todas las páginas
//                                          admin, botones Eliminar visibles
//                                          en órdenes / pedidos / facturas
//                                          para reset libre.
// • Variable ausente                      → tratado como testing (modo
//                                          seguro por default — preferimos
//                                          mostrar el banner por accidente
//                                          que ocultar testing en prod por
//                                          accidente).
//
// Como es NEXT_PUBLIC_*, está disponible client + server side. No necesita
// pasar por API.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * True si estamos en modo producción. Usar para esconder testing helpers.
 */
export function isProduction(): boolean {
  return process.env.NEXT_PUBLIC_IS_PRODUCTION === 'true'
}

/**
 * True si estamos en modo testing. Inverso de isProduction().
 * Conveniencia para guardar contra "ausente" sin tener que negar dos cosas.
 */
export function isTestingMode(): boolean {
  return !isProduction()
}
