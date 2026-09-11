import { listCategories } from '@/server/queries/categories'
import { CategoryManager } from '@/components/forms/CategoryManager'

export default async function CategoriasPage() {
  const categories = await listCategories()
  return (
    <section className="max-w-2xl">
      <h1 className="text-xl font-semibold mb-4">Categorías</h1>
      <CategoryManager categories={categories} />
    </section>
  )
}
