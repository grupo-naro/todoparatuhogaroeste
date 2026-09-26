export function buildWhatsappLink(productName: string, variantName: string): string {
  const text = `Hola! Quiero consultar por ${productName} (${variantName})`
  return `https://wa.me/5491126039383?text=${encodeURIComponent(text)}`
}
