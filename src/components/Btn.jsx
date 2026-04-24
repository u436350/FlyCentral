export default function Btn({ children, variant = 'primary', size = 'md', className = '', ...props }) {
  const variants = {
    primary:   'bg-teal-600 hover:bg-teal-700 text-white',
    secondary: 'bg-slate-100 hover:bg-slate-200 text-slate-700',
    danger:    'bg-red-500 hover:bg-red-600 text-white',
    success:   'bg-emerald-600 hover:bg-emerald-700 text-white',
    outline:   'border border-teal-600 text-teal-700 hover:bg-teal-50',
  }
  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-2.5 text-base',
  }
  return (
    <button
      className={`inline-flex items-center gap-1.5 font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
