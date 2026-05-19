import { requireRole } from '@/lib/auth'
import Link from 'next/link'
import { Scale, BarChart2, Building2, Users, BookOpen } from 'lucide-react'

const nav = [
  { title: 'Chat', url: '/chat', icon: Scale },
  { title: 'Analytics', url: '/analytics', icon: BarChart2 },
  { title: 'Base de connaissances', url: '/admin/seed', icon: BookOpen },
  { title: 'Agences', url: '/admin/agencies', icon: Building2 },
  { title: 'Utilisateurs', url: '/admin/users', icon: Users },
]

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireRole(['super_admin'])
  return (
    <div className="min-h-screen bg-background">
      <header className="h-14 border-b border-border bg-card flex items-center px-6 gap-6">
        <div className="flex items-center gap-2 shrink-0">
          <img src="/logo-nestenn.svg" alt="Nestenn" className="h-4 w-auto brightness-0 invert" />
          <span className="text-[10px] text-muted-foreground uppercase tracking-widest border-l border-border pl-2">
            Juridic
          </span>
        </div>
        <nav className="flex items-center gap-1">
          {nav.map(item => (
            <Link
              key={item.url}
              href={item.url}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <item.icon className="h-3.5 w-3.5" />
              {item.title}
            </Link>
          ))}
        </nav>
      </header>
      <main>{children}</main>
    </div>
  )
}
