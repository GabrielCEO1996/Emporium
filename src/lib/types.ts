export type Rol = 'admin' | 'vendedor' | 'conductor' | 'pendiente' | 'cliente' | 'comprador'

export interface Profile {
  id: string
  email: string
  nombre: string
  rol: Rol
  activo: boolean
  created_at: string
  updated_at: string
}

export interface Producto {
  id: string
  /** SKU — unique across productos. Auto-generated as PRD-0001 when omitted. */
  codigo?: string | null
  nombre: string
  descripcion?: string
  categoria?: string
  activo: boolean
  imagen_url?: string
  proveedor_id?: string | null
  /** If true, we track per-lot stock with expiration dates. */
  tiene_vencimiento?: boolean
  /** Alert when stock_total across all lots falls below this number. */
  stock_minimo?: number
  /** Default precio_venta pre-filled when creating a pedido. */
  precio_venta_sugerido?: number
  created_at: string
  updated_at: string
  presentaciones?: Presentacion[]
  inventario?: Inventario | Inventario[]
}

/**
 * Presentacion describes a variant of a product (size, packaging, etc).
 * Pricing and stock now live on `inventario` (keyed by presentacion_id);
 * the precio/costo/stock columns here are kept for backward compat only.
 */
export interface Presentacion {
  id: string
  producto_id: string
  nombre: string
  /** @deprecated read from inventario.precio_venta */
  precio: number
  /** @deprecated read from inventario.precio_costo */
  costo: number
  /** @deprecated read from inventario.stock_total */
  stock: number
  stock_minimo: number
  unidad: string
  codigo_barras?: string
  activo: boolean
  created_at: string
  updated_at: string
  producto?: Producto
  inventario?: Inventario | Inventario[]
}

/**
 * Inventario = one row per presentacion. Owns stock + pricing.
 * `stock_disponible` is a generated column (= stock_total - stock_reservado).
 */
export interface Inventario {
  id: string
  producto_id: string
  presentacion_id: string
  stock_total: number
  stock_reservado: number
  stock_disponible: number
  precio_venta: number
  precio_costo: number
  /** Optional lot number. NULL means "generic stock, no expiration tracked". */
  numero_lote?: string | null
  /** Expiration date for this lot (only for productos.tiene_vencimiento = true). */
  fecha_vencimiento?: string | null
  updated_at: string
}

export type TipoCliente =
  | 'tienda'
  | 'supermercado'
  | 'restaurante'
  | 'persona_natural'
  | 'otro'

export interface Cliente {
  id: string
  nombre: string
  rif?: string
  email?: string
  telefono?: string
  whatsapp?: string
  direccion?: string
  ciudad?: string
  zona?: string
  limite_credito: number
  dias_credito: number
  activo: boolean
  notas?: string
  /** Links this cliente to an auth user (app-user-registered clients). */
  user_id?: string | null
  /** Kind of business — used for reporting + default credit policies. */
  tipo_cliente?: TipoCliente | string
  created_at: string
  updated_at: string
}

export interface Conductor {
  id: string
  nombre: string
  telefono?: string
  placa_vehiculo?: string
  zona?: string
  activo: boolean
  profile_id?: string
  created_at: string
}

// Nuevos estados (flujo actual): borrador → confirmada → aprobada → despachada → entregada | cancelada
// Estados legacy mantenidos por compatibilidad hacia atrás con datos existentes.
export type EstadoPedido =
  | 'borrador'
  | 'confirmada'
  | 'aprobada'
  | 'despachada'
  | 'entregada'
  | 'cancelada'
  // legacy
  | 'confirmado'
  | 'preparando'
  | 'despachado'
  | 'en_ruta'
  | 'entregado'
  | 'cancelado'
  | 'facturado'

export interface Pedido {
  id: string
  numero: string
  cliente_id: string
  vendedor_id?: string
  conductor_id?: string
  estado: EstadoPedido
  fecha_pedido: string
  fecha_entrega_estimada?: string
  fecha_entrega_real?: string
  subtotal: number
  descuento: number
  impuesto: number
  total: number
  notas?: string
  direccion_entrega?: string
  created_at: string
  updated_at: string
  cliente?: Cliente
  vendedor?: Profile
  conductor?: Conductor
  items?: PedidoItem[]
}

export interface PedidoItem {
  id: string
  pedido_id: string
  presentacion_id: string
  cantidad: number
  precio_unitario: number
  descuento: number
  subtotal: number
  created_at: string
  presentacion?: Presentacion & { producto?: Producto }
}

export type EstadoFactura = 'emitida' | 'enviada' | 'pagada' | 'anulada' | 'con_nota_credito'

export interface Factura {
  id: string
  numero: string
  pedido_id?: string
  cliente_id: string
  vendedor_id?: string
  estado: EstadoFactura
  fecha_emision: string
  fecha_vencimiento?: string
  subtotal: number
  descuento: number
  base_imponible: number
  tasa_impuesto: number
  impuesto: number
  total: number
  monto_pagado: number
  notas?: string
  created_at: string
  updated_at: string
  cliente?: Cliente
  vendedor?: Profile
  items?: FacturaItem[]
}

export interface FacturaItem {
  id: string
  factura_id: string
  presentacion_id: string
  descripcion: string
  cantidad: number
  precio_unitario: number
  descuento: number
  subtotal: number
  presentacion?: Presentacion
}

export type TipoNotaCredito = 'devolucion' | 'descuento' | 'ajuste'
export type EstadoNotaCredito = 'emitida' | 'aplicada' | 'anulada'

export interface NotaCredito {
  id: string
  numero: string
  factura_id: string
  cliente_id: string
  motivo: string
  tipo: TipoNotaCredito
  estado: EstadoNotaCredito
  subtotal: number
  impuesto: number
  total: number
  notas?: string
  created_at: string
  updated_at: string
  factura?: Factura
  cliente?: Cliente
  items?: NotaCreditoItem[]
}

export interface NotaCreditoItem {
  id: string
  nota_credito_id: string
  presentacion_id?: string
  descripcion: string
  cantidad: number
  precio_unitario: number
  subtotal: number
}
