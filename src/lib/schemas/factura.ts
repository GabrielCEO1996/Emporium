/**
 * Zod schemas for factura API payloads.
 *
 * Usage in a route handler:
 *
 *   import { FacturaCreateSchema } from '@/lib/schemas/factura'
 *   const parsed = FacturaCreateSchema.safeParse(await request.json())
 *   if (!parsed.success) {
 *     return NextResponse.json(
 *       { error: 'Datos inválidos', details: parsed.error.flatten() },
 *       { status: 400 },
 *     )
 *   }
 *   // parsed.data is fully typed
 */

import { z } from 'zod'

const uuid = z.string().uuid('ID inválido')

export const FacturaItemSchema = z.object({
  // Either producto_id OR presentacion_id; presentacion is required on insert.
  producto_id: uuid.optional(),
  presentacion_id: uuid,
  cantidad: z.number().int().positive('La cantidad debe ser mayor a 0'),
  precio_unitario: z.number().nonnegative('El precio no puede ser negativo'),
  descuento_porcentaje: z.number().min(0).max(100).optional(),
  descripcion: z.string().max(500).optional(),
  subtotal: z.number().nonnegative().optional(),
})

export const FacturaCreateSchema = z.object({
  cliente_id: uuid,
  pedido_id: uuid.optional().nullable(),
  vendedor_id: uuid.optional().nullable(),
  items: z.array(FacturaItemSchema)
    .min(1, 'La factura debe tener al menos un artículo')
    .max(100, 'Máximo 100 artículos por factura'),
  fecha_emision: z.string().optional(),
  fecha_vencimiento: z.string().optional().nullable(),
  notas: z.string().max(500).optional().nullable(),
  tasa_impuesto: z.number().min(0).max(1).optional(),
  descuento: z.number().nonnegative().optional(),
  metodo_pago: z.enum(['efectivo', 'zelle', 'cheque', 'credito', 'stripe']).optional(),
})

export const FacturaUpdateSchema = z.object({
  estado: z.enum(['emitida', 'enviada', 'pagada', 'anulada', 'con_nota_credito']).optional(),
  monto_pagado: z.number().nonnegative().optional(),
  fecha_vencimiento: z.string().optional().nullable(),
  notas: z.string().max(500).optional().nullable(),
})

export type FacturaCreateInput = z.infer<typeof FacturaCreateSchema>
export type FacturaUpdateInput = z.infer<typeof FacturaUpdateSchema>
export type FacturaItemInput   = z.infer<typeof FacturaItemSchema>
