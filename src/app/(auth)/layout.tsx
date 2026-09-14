import type React from 'react'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main
      className="min-h-full grid place-items-center p-4"
      style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))', paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
      {children}
    </main>
  )
}
