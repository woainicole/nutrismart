import Button from './Button'

export default function PageHeader({ title, subtitle, action, actionLabel, actionIcon: Icon }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
      <div>
        <h2 className="text-xl font-bold text-gray-800">{title}</h2>
        {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      {action && (
        <Button onClick={action}>
          {Icon && <Icon size={16} />}
          {actionLabel}
        </Button>
      )}
    </div>
  )
}

