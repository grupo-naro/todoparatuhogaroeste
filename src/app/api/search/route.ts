import { NextResponse } from 'next/server'
import { requireUser } from '@/server/auth/guards'
import { searchProductVariants } from '@/server/queries/products'

export async function GET(request: Request) {
  await requireUser()
  const q = new URL(request.url).searchParams.get('q') ?? ''
  const results = await searchProductVariants(q)
  return NextResponse.json({ results })
}
