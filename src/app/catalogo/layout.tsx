import Image from 'next/image'

export default function CatalogoLayout({ children }: LayoutProps<'/catalogo'>) {
  return (
    <div className="min-h-full flex flex-col">
      <header className="h-14 border-b border-border flex items-center gap-3 px-4">
        <Image src="/logo.png" alt="Jael Castillo — Todo para tu Hogar" width={36} height={36} className="rounded-full shrink-0" priority />
        <span className="font-semibold">Jael Castillo — Todo para tu Hogar</span>
      </header>
      <main className="flex-1 p-4 sm:p-6">{children}</main>
    </div>
  )
}
