export default function Spinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <div
        className="w-8 h-8 rounded-full border-4 border-gray-200 animate-spin"
        style={{ borderTopColor: '#1e2a4a' }}
      />
    </div>
  )
}
