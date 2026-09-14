'use client'
import { useActionState, useEffect, useRef, useState } from 'react'
import { archiveCategory, createCategory, updateCategory } from '@/server/actions/categories'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'

type Category = {
  id: string
  name: string
  slug: string
  activeProductCount: number
  archivedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export function CategoryManager({ categories }: { categories: Category[] }) {
  const { toast } = useToast()
  const [editing, setEditing] = useState<Category | null>(null)
  const formRef = useRef<HTMLFormElement>(null)

  const [altaState, altaAction] = useActionState(createCategory, undefined)

  useEffect(() => {
    if (!altaState) return
    if (altaState.ok) formRef.current?.reset()
    else toast(altaState.error, 'danger')
  }, [altaState, toast])

  async function handleEdit(formData: FormData) {
    if (!editing) return
    const res = await updateCategory(editing.id, formData)
    if (!res.ok) {
      toast(res.error, 'danger')
      return
    }
    setEditing(null)
  }

  async function handleArchive(id: string) {
    const res = await archiveCategory(id)
    if (!res.ok) toast(res.error, 'danger')
  }

  return (
    <div className="flex flex-col gap-6">
      <form ref={formRef} action={altaAction} className="flex flex-col gap-2 sm:flex-row">
        <Input
          name="name"
          required
          placeholder="Nueva categoría"
          aria-label="Nueva categoría"
          className="flex-1"
        />
        <Button type="submit">Agregar</Button>
      </form>

      <ul className="flex flex-col divide-y divide-border">
        {categories.map((c) => (
          <li key={c.id} className="flex items-center justify-between gap-3 py-2 min-h-11">
            <span className="flex-1 truncate">{c.name}</span>
            <span className="text-sm text-muted tabular-nums">{c.activeProductCount}</span>
            <span className="flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={() => setEditing(c)}>
                Editar
              </Button>
              <Button variant="ghost" size="sm" onClick={() => handleArchive(c.id)}>
                Archivar
              </Button>
            </span>
          </li>
        ))}
      </ul>

      <Dialog
        open={editing !== null}
        onOpenChange={(v) => !v && setEditing(null)}
        title="Editar categoría"
      >
        {editing && (
          <form action={handleEdit} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-sm">Nombre</span>
              <Input name="name" defaultValue={editing.name} required aria-label="Nombre" />
            </label>
            <Button type="submit">Guardar</Button>
          </form>
        )}
      </Dialog>
    </div>
  )
}
