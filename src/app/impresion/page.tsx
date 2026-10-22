import type { Metadata } from 'next'
import { PrintStation } from '@/components/impresion/PrintStation'

export const metadata: Metadata = { title: 'Estación de impresión', robots: { index: false, follow: false } }

export default async function ImpresionPage({ searchParams }: { searchParams: Promise<{ clave?: string }> }) {
  const { clave } = await searchParams
  if (!clave) {
    return (
      <main className="min-h-full grid place-items-center p-6">
        <p className="text-danger font-medium">Falta la clave de la estación en la dirección (?clave=…).</p>
      </main>
    )
  }
  return <PrintStation clave={clave} />
}
