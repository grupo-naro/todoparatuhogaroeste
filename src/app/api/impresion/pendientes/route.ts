import { NextResponse } from 'next/server'
import { BUILD_ID } from '@/lib/build-id'
import { isValidStationKey, listPendingJobs } from '@/server/printing/station'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  if (!isValidStationKey(request.headers.get('x-print-key'))) {
    return NextResponse.json({ error: 'Clave incorrecta' }, { status: 401 })
  }
  return NextResponse.json({ jobs: await listPendingJobs(), version: BUILD_ID })
}
