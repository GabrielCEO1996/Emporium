export type Rol = 'admin' | 'vendedor' | 'conductor' | 'pendiente'

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
  nombre: string
  descripcion?: string
  categoria?: string
  activo: boolean
  imagen_url?: string
  created_at: string
  updated_at: string
  presentaciones?: Presentacion[]
}

export interface Presentacion {
  id: string
  producto_id: string
  nombre: string
  precio: number
  costo: number
  stock: number
  stock_minimo: number
  unidad: string
  codigo_barras?: string
  activo: boolean
  created_at: string
  updated_at: string
  producto?: Producto
}

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

export type EstadoPedido = 'borrador' | 'confirmado' | 'en_ruta' | 'entregado' | 'cancelado' | 'facturado'

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

export type EstadoFactura = 'emitida' | 'pagada' | 'anulada' | 'con_nota_credito'

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
