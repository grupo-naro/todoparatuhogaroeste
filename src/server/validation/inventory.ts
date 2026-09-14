import { z } from 'zod'

export const adjustSchema = z.object({
  variantId: z.string().uuid(),
  quantity: z.coerce.number().int('Debe ser un entero').min(0, 'No puede ser negativo'),
  note: z.string().trim().min(1, 'El motivo es obligatorio').max(300),
})
