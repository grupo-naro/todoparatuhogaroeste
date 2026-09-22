import { z } from 'zod'

export const adjustSchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('set'),
    variantId: z.string().uuid(),
    quantity: z.coerce.number().int('Debe ser un entero').min(0, 'No puede ser negativo'),
    note: z.string().trim().min(1, 'El motivo es obligatorio').max(300),
  }),
  z.object({
    mode: z.literal('delta'),
    variantId: z.string().uuid(),
    delta: z.coerce.number().int('Debe ser un entero').refine((n) => n !== 0, 'Ingresá una cantidad distinta de cero'),
    note: z.string().trim().min(1, 'El motivo es obligatorio').max(300),
  }),
])
