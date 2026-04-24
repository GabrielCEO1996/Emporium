import { z } from 'zod'

const uuid = z.string().uuid('ID inválido')

export const PedidoItemSchema = z.object({
  presentacion_id: uuid,
  cantidad: z.number().positive('La cantidad debe ser mayor a 0'),
  precio_unitario: z.number().nonnegative(),
  descuento: z.number().min(0).max(100).optional(),
  subtotal: z.number().nonnegative().optional(),
  productoNombre: z.string().max(200).optional(),
  presentacionNombre: z.string().max(200).optional(),
  imagenUrl: z.string().optional(),
})

export const PedidoCreateSchema = z.object({
  cliente_id: uuid,
  items: z.array(PedidoItemSchema).min(1).max(100),
  notas: z.string().max(500).optional().nullable(),
  direccion_entrega: z.string().max(500).optional().nullable(),
  tipo_pago: z.enum(['efectivo', 'zelle', 'transferencia', 'credito', 'stripe']).optional(),
  numero_referencia: z.string().max(100).optional(),
  cliente_data: z.object({
    nombre: z.string().max(200).optional(),
    telefono: z.string().max(40).optional(),
    whatsapp: z.string().max(40).optional(),
    direccion: z.string().max(500).optional(),
    ciudad: z.string().max(80).optional(),
    tipo_cliente: z.string().max(40).optional(),
  }).optional(),
})

export type PedidoCreateInput = z.infer<typeof PedidoCreateSchema>
export type PedidoItemInput   = z.infer<typeof PedidoItemSchema>
