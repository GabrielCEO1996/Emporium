import { z } from 'zod'

// Cliente payloads are used from both staff flows (/api/clientes POST/PUT)
// and the auto-create path in /api/tienda/pedido. Keep the schema permissive:
// only `nombre` is strictly required; everything else is optional.
export const ClienteCreateSchema = z.object({
  nombre: z.string().trim().min(1, 'El nombre del cliente es requerido').max(200),
  rif: z.string().trim().max(40).optional().nullable(),
  email: z.string().email('Email inválido').optional().nullable(),
  telefono: z.string().max(40).optional().nullable(),
  whatsapp: z.string().max(40).optional().nullable(),
  direccion: z.string().max(500).optional().nullable(),
  ciudad: z.string().max(80).optional().nullable(),
  zona: z.string().max(80).optional().nullable(),
  limite_credito: z.number().min(0).max(1e9).optional(),
  dias_credito: z.number().int().min(0).max(365).optional(),
  credito_autorizado: z.boolean().optional(),
  activo: z.boolean().optional(),
  notas: z.string().max(1000).optional().nullable(),
})

export const ClienteUpdateSchema = ClienteCreateSchema.partial().extend({
  nombre: z.string().trim().min(1).max(200),
})

export type ClienteCreateInput = z.infer<typeof ClienteCreateSchema>
export type ClienteUpdateInput = z.infer<typeof ClienteUpdateSchema>
