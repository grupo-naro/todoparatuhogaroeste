import { NextResponse } from 'next/server'
import { z } from 'zod'
import { isValidStationKey, markJobPrinted } from '@/server/printing/station'

export const dynamic = 'force-dynamic'

const bodySchema = z.object({ id: z.string().uuid() })

export async function POST(request: Request) {
  if (!isValidStationKey(request.headers.get('x-print-key'))) {
    return NextResponse.json({ error: 'Clave incorrecta' }, { status: 401 })
  }
  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Trabajo inválido' }, { status: 400 })
  await markJobPrinted(parsed.data.id)
  return NextResponse.json({ ok: true })
}
