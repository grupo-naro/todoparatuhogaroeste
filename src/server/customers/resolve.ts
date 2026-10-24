import 'server-only'
import type { Prisma } from '@prisma/client'
import { normalizePhone } from '@/lib/phone'

export type ResolvedCustomer =
  | { ok: true; customerId?: string; name?: string; phone?: string }
  | { ok: false; error: string }

// Busca o crea a la clienta por teléfono. Sin teléfono no hay cliente asociado.
export async function resolveCustomer(
  tx: Prisma.TransactionClient,
  input: { phone?: string; name?: string },
): Promise<ResolvedCustomer> {
  if (!input.phone) return { ok: true }
  const phone = normalizePhone(input.phone)
  if (phone.length < 6) return { ok: false, error: 'Teléfono inválido' }

  const existing = await tx.customer.findUnique({ where: { phone } })
  if (existing) return { ok: true, customerId: existing.id, name: existing.name, phone }

  const name = input.name?.trim()
  if (!name) return { ok: false, error: 'Ingresá el nombre para registrar al cliente nuevo' }
  // upsert (ON CONFLICT) en vez de create+retry: un unique-constraint error dentro de una
  // transacción interactiva deja la transacción de Postgres "aborted" y el retry también fallaría.
  const customer = await tx.customer.upsert({ where: { phone }, create: { name, phone }, update: {} })
  return { ok: true, customerId: customer.id, name: customer.name, phone }
}
