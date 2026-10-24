import { z } from 'zod'

export const storeSettingsSchema = z.object({
  reservationExpiryEnabled: z.boolean(),
  reservationExpiryDays: z.coerce.number().int('Debe ser un entero')
    .min(1, 'Mínimo 1 día').max(365, 'Máximo 365 días'),
})
