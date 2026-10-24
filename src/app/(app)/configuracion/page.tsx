import { requireRole } from '@/server/auth/guards'
import { getStoreSettings } from '@/server/settings'
import { ReservationSettingsForm } from '@/components/configuracion/ReservationSettingsForm'

export default async function ConfiguracionPage() {
  await requireRole('ADMIN')
  const settings = await getStoreSettings()
  return (
    <section>
      <h1 className="text-xl font-semibold mb-4">Configuración</h1>
      <h2 className="font-semibold mb-2">Reservas</h2>
      <ReservationSettingsForm settings={settings} />
    </section>
  )
}
