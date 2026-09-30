export function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-border rounded-lg p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className="text-xl sm:text-2xl font-semibold mt-1 break-words">{value}</p>
    </div>
  )
}
