import { z } from 'zod'

export const categorySchema = z.object({
  name: z.string().trim().min(2, 'Mínimo 2 caracteres').max(60, 'Máximo 60 caracteres'),
})
