import { listCategoryOptions } from '@/server/queries/categories'
import { ProductForm } from '@/components/forms/ProductForm'

export default async function NuevoProductoPage() {
  const categories = await listCategoryOptions()
  return (
    <section className="max-w-2xl">
      <h1 className="text-xl font-semibold mb-4">Nuevo producto</h1>
      <ProductForm mode="create" categories={categories} />
    </section>
  )
}
