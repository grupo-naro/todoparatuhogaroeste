import Image from 'next/image'
import { ImageOff } from 'lucide-react'
import { buildWhatsappLink } from '@/lib/whatsapp'
import type { PublicCatalogProduct } from '@/server/queries/catalog'

export function ProductCard({ product }: { product: PublicCatalogProduct }) {
  const firstImage = product.images[0]
  return (
    <article className="border border-border rounded-lg p-3 flex flex-col gap-3">
      <div className="relative aspect-square overflow-hidden rounded bg-border/30">
        {firstImage ? (
          <Image src={firstImage.url} alt={product.name} fill className="object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-muted">
            <ImageOff className="size-8" />
          </div>
        )}
      </div>
      <h3 className="font-medium">{product.name}</h3>
      <ul className="flex flex-col gap-2">
        {product.variants.map((v) => (
          <li key={v.id} className="flex items-center justify-between gap-2 border-t border-border pt-2">
            <span className="text-sm">
              {v.name}
              {!v.disponible && <span className="ml-2 text-danger text-xs font-medium">Agotado</span>}
            </span>
            <a href={buildWhatsappLink(product.name, v.name)} target="_blank" rel="noopener noreferrer"
              className="text-xs underline whitespace-nowrap">Consultar por WhatsApp</a>
          </li>
        ))}
      </ul>
    </article>
  )
}
