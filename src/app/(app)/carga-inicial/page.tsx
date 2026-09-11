import { CargaInicialClient } from './CargaInicialClient'

export default function CargaInicialPage() {
  return (
    <section>
      <h1 className="text-xl font-semibold mb-1">Carga inicial de stock</h1>
      <p className="text-sm text-muted mb-4">
        Buscá el producto y la variante, ingresá la cantidad contada y guardá el lote.
        La cantidad ingresada reemplaza el stock actual (ajuste absoluto).
      </p>
      <CargaInicialClient />
    </section>
  )
}
