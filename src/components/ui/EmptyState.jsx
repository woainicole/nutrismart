import { Inbox } from 'lucide-react'

export default function EmptyState({ message = 'Belum ada data', icon: Icon = Inbox }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-gray-400">
      <Icon size={40} strokeWidth={1.2} />
      <p className="mt-2 text-sm">{message}</p>
    </div>
  )
}

