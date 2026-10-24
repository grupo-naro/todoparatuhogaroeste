export function buildWhatsappLink(productName: string, variantName: string): string {
  const text = `Hola! Quiero consultar por ${productName} (${variantName})`
  return `https://wa.me/5491126039383?text=${encodeURIComponent(text)}`
}

// Lleva el teléfono tal cual lo cargó la vendedora al formato de WhatsApp de Argentina (549 + área + número).
function whatsappNumber(rawPhone: string): string {
  const digits = rawPhone.replace(/\D/g, '').replace(/^0+/, '')
  return digits.startsWith('54') ? digits : `549${digits}`
}

export function buildReservationNotice(rawPhone: string, customerName: string | null, reservationNumber: number): string {
  const greeting = customerName ? `Hola ${customerName}!` : 'Hola!'
  const text = `${greeting} Te escribimos de Todo para tu Hogar: ya llegó todo lo de tu reserva N° ${reservationNumber} y está listo para retirar.`
  return `https://wa.me/${whatsappNumber(rawPhone)}?text=${encodeURIComponent(text)}`
}
