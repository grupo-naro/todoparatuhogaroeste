import Link from 'next/link'

export default function ProductoNoEncontrado() {
  return (
    <section className="flex flex-col items-start gap-3">
      <h1 className="text-xl font-semibold">Producto no encontrado</h1>
      <Link href="/productos" className="text-primary underline">
        Volver a productos
      </Link>
    </section>
  )
}
