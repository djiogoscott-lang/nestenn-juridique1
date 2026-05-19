'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Scale, ChevronLeft, User, BarChart2, Users, Building2,
  LogOut, Plus, MessageSquare, BookOpen, AlertCircle, RefreshCw, Settings
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { AVAILABLE_MODELS, DEFAULT_MODEL_ID } from '@/lib/model-config'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from '@/components/ui/sidebar'
import { cn } from '@/lib/utils'
import type { AuthUser } from '@/lib/auth'

// ── Navigation principale ──

const allNav = [
  { title: 'Assistant Juridique', url: '/chat', icon: Scale, roles: ['super_admin', 'responsable_agence', 'conseiller'] },
  { title: 'Base de connaissances', url: '/admin/seed', icon: BookOpen, roles: ['super_admin'] },
  { title: 'Analytics', url: '/analytics', icon: BarChart2, roles: ['super_admin', 'responsable_agence'] },
  { title: 'Agences', url: '/admin/agencies', icon: Building2, roles: ['super_admin'] },
  { title: 'Utilisateurs', url: '/admin/users', icon: Users, roles: ['super_admin'] },
]

const MODEL_PREF_KEY = 'nestenn:default-model-id'

const roleLabels: Record<string, string> = {
  super_admin: 'Super Admin',
  responsable_agence: "Responsable d'agence",
  conseiller: 'Conseiller',
}

// ── Types ──

interface ChatHistoryItem {
  id: string
  title: string
  created_at: string
}

type HistoryState = 'loading' | 'error' | 'success'

// ── Helpers de date ──

function groupByDate(items: ChatHistoryItem[]): { label: string; chats: ChatHistoryItem[] }[] {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const sevenDaysAgo = new Date(today)
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const groups: Record<string, ChatHistoryItem[]> = {
    "Aujourd'hui": [],
    'Hier': [],
    '7 derniers jours': [],
    'Plus ancien': [],
  }

  for (const item of items) {
    const d = new Date(item.created_at)
    const day = new Date(d.getFullYear(), d.getMonth(), d.getDate())

    if (day.getTime() >= today.getTime()) {
      groups["Aujourd'hui"].push(item)
    } else if (day.getTime() >= yesterday.getTime()) {
      groups['Hier'].push(item)
    } else if (day.getTime() >= sevenDaysAgo.getTime()) {
      groups['7 derniers jours'].push(item)
    } else {
      groups['Plus ancien'].push(item)
    }
  }

  return Object.entries(groups)
    .filter(([, chats]) => chats.length > 0)
    .map(([label, chats]) => ({ label, chats }))
}

// ── Skeletons ──

function HistorySkeletons() {
  return (
    <div className="space-y-1 px-3">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg animate-pulse">
          <div className="h-3 w-3 rounded bg-sidebar-foreground/[0.06] shrink-0" />
          <div
            className="h-3 rounded bg-sidebar-foreground/[0.06]"
            style={{ width: `${60 + Math.random() * 30}%` }}
          />
        </div>
      ))}
    </div>
  )
}

// ── Composant principal ──

export function AppSidebar({ user }: { user: AuthUser }) {
  const { state, toggleSidebar } = useSidebar()
  const pathname = usePathname()
  const router = useRouter()
  const collapsed = state === 'collapsed'

  // État de l'historique (3 états)
  const [history, setHistory] = useState<ChatHistoryItem[]>([])
  const [historyState, setHistoryState] = useState<HistoryState>('loading')
  const hasLoadedOnce = history.length > 0 || historyState === 'success'

  // Préférence modèle persistée localement (clé partagée avec /settings)
  const [preferredModel, setPreferredModel] = useState<string>(DEFAULT_MODEL_ID)
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(MODEL_PREF_KEY)
      if (stored && AVAILABLE_MODELS.some(m => m.id === stored)) {
        setPreferredModel(stored)
      }
    } catch { /* localStorage indisponible */ }
  }, [])

  function handleModelChange(modelId: string) {
    setPreferredModel(modelId)
    try { window.localStorage.setItem(MODEL_PREF_KEY, modelId) } catch { /* */ }
  }

  // Fetch de l'historique
  const fetchHistory = useCallback(async (silent = false) => {
    // Ne montrer les skeletons que pour le tout premier chargement
    if (!silent) setHistoryState('loading')
    try {
      const res = await fetch('/api/chat/history')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      // Guard : s'assurer que c'est bien un tableau
      if (Array.isArray(data)) {
        setHistory(data as ChatHistoryItem[])
        setHistoryState('success')
      } else {
        console.warn('[Sidebar] Réponse inattendue:', data)
        setHistoryState('success') // Ne pas bloquer sur les skeletons
      }
    } catch (err) {
      console.error('[Sidebar] Erreur historique:', err)
      // Si on a déjà des données, on garde le state "success" pour ne pas casser l'UI
      if (!hasLoadedOnce) setHistoryState('error')
    }
  }, [hasLoadedOnce])

  // Premier chargement : skeletons visibles
  useEffect(() => {
    fetchHistory(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Rechargement silencieux quand la route change (nouveau chat, etc.)
  useEffect(() => {
    if (hasLoadedOnce) {
      fetchHistory(true)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const nav = allNav.filter(item => item.roles.includes(user.role))
  const groupedHistory = groupByDate(history)

  return (
    <Sidebar collapsible="icon" className="border-r-0 bg-nestenn-dark text-white/90">
      {/* ── Header ── */}
      <div className="flex h-16 items-center justify-between px-4 border-b border-sidebar-border">
        {!collapsed && (
          <div className="flex items-center gap-2.5">
            <img src="/logo-nestenn.svg" alt="Nestenn" className="h-5 w-auto brightness-0 invert" />
            <span className="text-[10px] text-white/60 uppercase tracking-widest border-l border-white/20 pl-2.5">
              Juridic
            </span>
          </div>
        )}
        <button
          onClick={toggleSidebar}
          className="p-1.5 rounded-md hover:bg-white/10 text-white/70 hover:text-white transition-colors"
        >
          <ChevronLeft className={cn('h-4 w-4 transition-transform duration-200', collapsed && 'rotate-180')} />
        </button>

      </div>

      <SidebarContent className="pt-4">
        {/* ── Bouton Nouveau Chat ── */}
        <div className="px-3 mb-4">
          <button
            onClick={() => router.push('/chat')}
            className={cn(
              'w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-sm font-semibold transition-all duration-200',
              'bg-nestenn-cyan text-white hover:bg-nestenn-cyan-hover',
              'shadow-lg shadow-nestenn-cyan/20 hover:shadow-nestenn-cyan/40',
              'active:scale-[0.97]',
              collapsed && 'p-2.5'
            )}

          >
            <Plus className="h-4 w-4" />
            {!collapsed && <span>Nouveau chat</span>}
          </button>
        </div>

        {/* ── Navigation principale ── */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {nav.map((item) => {
                const isActive = pathname === item.url || (item.url !== '/chat' && pathname.startsWith(item.url + '/'))
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive}>
                      <Link
                        href={item.url}
                        className={cn(
                          'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150',
                          'text-white/70 hover:bg-white/10 hover:text-white',
                          isActive && 'bg-white/10 text-white font-medium',
                        )}

                      >
                        <item.icon className="h-[18px] w-[18px] shrink-0" />
                        {!collapsed && <span>{item.title}</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* ── Historique des conversations ── */}
        {!collapsed && (
          <div className="mt-6 flex-1 overflow-y-auto">
            {/* Titre section */}
            <div className="px-4 py-2 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/40">
                Historique récent
              </span>
              {historyState === 'success' && (
                <button
                  onClick={() => fetchHistory()}
                  className="p-1 rounded hover:bg-white/10 text-white/40 hover:text-white/80 transition-colors"
                  title="Actualiser"
                >
                  <RefreshCw className="h-3 w-3" />
                </button>
              )}

            </div>

            {/* État : Loading → Skeletons */}
            {historyState === 'loading' && <HistorySkeletons />}

            {/* État : Erreur */}
            {historyState === 'error' && (
              <div className="px-4 py-6 flex flex-col items-center gap-3 text-center">
                <AlertCircle className="h-5 w-5 text-sidebar-foreground/20" />
                <p className="text-[11px] text-sidebar-foreground/30 leading-relaxed">
                  Impossible de charger<br />l'historique
                </p>
                <button
                  onClick={() => fetchHistory()}
                  className="text-[10px] text-primary hover:text-primary/80 font-semibold transition-colors"
                >
                  Réessayer
                </button>
              </div>
            )}

            {/* État : Succès, mais vide */}
            {historyState === 'success' && history.length === 0 && (
              <div className="px-4 py-8 flex flex-col items-center gap-2 text-center">
                <MessageSquare className="h-5 w-5 text-sidebar-foreground/10" />
                <p className="text-[11px] text-sidebar-foreground/25 italic">
                  Aucune conversation
                </p>
              </div>
            )}

            {/* État : Succès avec données → groupé par date */}
            {historyState === 'success' && groupedHistory.map((group) => (
              <div key={group.label} className="mb-3">
                <p className="px-4 py-1.5 text-[9px] font-bold uppercase tracking-[0.2em] text-sidebar-foreground/20">
                  {group.label}
                </p>
                <SidebarMenu>
                  {group.chats.map((chat) => {
                    const isActive = pathname === `/chat/${chat.id}`
                    return (
                      <SidebarMenuItem key={chat.id}>
                        <SidebarMenuButton asChild isActive={isActive}>
                          <Link
                            href={`/chat/${chat.id}`}
                            className={cn(
                              'group flex items-center gap-2.5 mx-2 px-3 py-2 rounded-lg transition-all duration-150',
                              'text-[12px] leading-tight',
                              isActive
                                ? 'bg-white/10 text-white font-semibold shadow-sm'
                                : 'text-white/60 hover:text-white hover:bg-white/5'
                            )}
                          >
                            <MessageSquare className={cn(
                              'h-3.5 w-3.5 shrink-0 transition-colors duration-150',
                              isActive ? 'text-nestenn-cyan' : 'text-white/30 group-hover:text-white/50'
                            )} />

                            <span className="truncate flex-1 min-w-0">{chat.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )
                  })}
                </SidebarMenu>
              </div>
            ))}
          </div>
        )}
      </SidebarContent>

      {/* ── Footer utilisateur ── */}
      <SidebarFooter className="border-t border-white/10 p-3 flex flex-col gap-3">
        {!collapsed && user.can_switch_model && (
          <div className="px-2">
            <select
              value={preferredModel}
              onChange={(e) => handleModelChange(e.target.value)}
              className="w-full bg-white/5 border border-white/10 text-white/80 text-[11px] rounded-md px-2 py-1.5 outline-none focus:ring-1 focus:ring-nestenn-cyan"
            >
              {AVAILABLE_MODELS.map(m => (
                <option key={m.id} value={m.id} className="bg-nestenn-dark text-white">
                  {m.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex items-center gap-2 px-2 py-2">
          <div className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center shrink-0">
            <User className="h-4 w-4 text-white/80" />
          </div>
          {!collapsed && (
            <div className="flex flex-col flex-1 min-w-0">
              <span className="text-xs font-medium text-white truncate">
                {user.full_name ?? user.email}
              </span>
              <span className="text-[10px] text-white/50">{roleLabels[user.role]}</span>
            </div>
          )}
          
          <div className="flex items-center shrink-0">
            <Link
              href="/settings"
              title="Paramètres"
              className="p-1.5 rounded-md hover:bg-white/10 text-white/60 hover:text-white transition-colors"
            >
              <Settings className="h-4 w-4" />
            </Link>
            <button
              onClick={handleSignOut}
              title="Se déconnecter"
              className="p-1.5 rounded-md hover:bg-white/10 text-white/60 hover:text-white transition-colors"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </SidebarFooter>

    </Sidebar>
  )
}
