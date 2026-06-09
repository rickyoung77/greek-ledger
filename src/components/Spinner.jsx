export default function Spinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <div
        className="w-8 h-8 rounded-full border-2 animate-spin"
        style={{ borderColor: '#e3dccd', borderTopColor: '#b08d4f' }}
      />
    </div>
  )
}
