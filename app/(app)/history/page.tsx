'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import {
  Clock,
  Search,
  MessageSquare,
  AlertCircle,
  RefreshCw,
  ArrowRight,
  Inbox,
} from 'lucide-react'

interface ConversationItem {
  id: string
  title: string
  created_at: string
  author_name?: string | null
  agency_name?: string | null
}

type LoadState = 'loading' | 'success' | 'error'

const DATE_FORMATTER = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit',
  month: 'long',
  year: 'numeric',
})

const TIME_FORMATTER = new Intl.DateTimeFormat('fr-FR', {
  hour: '2-digit',
  minute: '2-digit',
})

function formatRelativeDate(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const diffDays = Math.round((today.getTime() - day.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return `Aujourd'hui, ${TIME_FORMATTER.format(d)}`
  if (diffDays === 1) return `Hier, ${TIME_FORMATTER.format(d)}`
  if (diffDays < 7) return `Il y a ${diffDays} jours`
  return DATE_FORMATTER.format(d)
}

function HistorySkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(6)].map((_, i) => (
        <div
          key={i}
          className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 animate-pulse"
        >
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-lg bg-slate-100 shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-slate-100 rounded" style={{ width: `${50 + Math.random() * 40}%` }} />
              <div className="h-3 bg-slate-100 rounded w-24" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export default function HistoryPage() {
  const [items, setItems] = useState<ConversationItem[]>([])
  const [state, setState] = useState<LoadState>('loading')
  const [query, setQuery] = useState('')

  const fetchHistory = useCallback(async () => {
    setState('loading')
    try {
      const res = await fetch('/api/chat/history', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      if (!Array.isArray(data)) throw new Error('Réponse invalide')
      setItems(data as ConversationItem[])
      setState('success')
    } catch (err) {
      console.error('[History] Erreur:', err)
      setState('error')
    }
  }, [])

  useEffect(() => {
    void fetchHistory()
  }, [fetchHistory])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter(c =>
      (c.title ?? '').toLowerCase().includes(q) ||
      (c.author_name ?? '').toLowerCase().includes(q) ||
      (c.agency_name ?? '').toLowerCase().includes(q)
    )
  }, [items, query])

  return (
    <div className="min-h-[calc(100vh-3.5rem)] md:min-h-screen bg-nestenn-light">
      <div className="max-w-3xl mx-auto px-4 md:px-6 py-8 md:py-12">
        {/* ── Header ── */}
        <header className="mb-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-nestenn-cyan/10 flex items-center justify-center">
              <Clock className="h-5 w-5 text-nestenn-cyan" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-nestenn-dark tracking-tight">Historique</h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                {state === 'success' && items.length > 0
                  ? `${items.length} conversation${items.length > 1 ? 's' : ''} sauvegardée${items.length > 1 ? 's' : ''}`
                  : 'Vos consultations juridiques'}
              </p>
            </div>
          </div>
          <button
            onClick={fetchHistory}
            disabled={state === 'loading'}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white border border-transparent hover:border-slate-200 transition-all disabled:opacity-50"
            title="Actualiser"
            aria-label="Actualiser"
          >
            <RefreshCw className={`h-4 w-4 ${state === 'loading' ? 'animate-spin' : ''}`} />
          </button>
        </header>

        {/* ── Barre de recherche ── */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher une conversation…"
              className="w-full pl-10 pr-3 py-3 rounded-xl border border-slate-200 bg-white text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-nestenn-cyan/30 focus:border-nestenn-cyan shadow-sm transition-colors"
            />
          </div>
        </div>

        {/* ── Contenu ── */}
        {state === 'loading' && <HistorySkeleton />}

        {state === 'error' && (
          <div className="bg-white rounded-2xl shadow-sm border border-red-100 p-8 text-center">
            <AlertCircle className="h-8 w-8 text-status-warning mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-foreground mb-1">Impossible de charger l'historique</h3>
            <p className="text-xs text-muted-foreground mb-4">
              Une erreur est survenue lors de la récupération de vos conversations.
            </p>
            <button
              onClick={fetchHistory}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-nestenn-cyan text-white text-sm font-medium hover:bg-nestenn-cyan-hover transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Réessayer
            </button>
          </div>
        )}

        {state === 'success' && items.length === 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-10 text-center">
            <div className="h-14 w-14 rounded-2xl bg-nestenn-cyan/10 flex items-center justify-center mx-auto mb-4">
              <Inbox className="h-7 w-7 text-nestenn-cyan" />
            </div>
            <h3 className="text-base font-semibold text-foreground mb-1">Aucune conversation</h3>
            <p className="text-xs text-muted-foreground mb-5 max-w-xs mx-auto">
              Démarrez votre première consultation juridique pour la retrouver ici.
            </p>
            <Link
              href="/chat"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-nestenn-cyan text-white text-sm font-semibold hover:bg-nestenn-cyan-hover transition-colors shadow-sm shadow-nestenn-cyan/20"
            >
              Démarrer une consultation
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}

        {state === 'success' && items.length > 0 && filtered.length === 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 text-center">
            <Search className="h-7 w-7 text-muted-foreground/40 mx-auto mb-2.5" />
            <p className="text-sm text-foreground/80">Aucun résultat pour « {query} »</p>
            <p className="text-xs text-muted-foreground mt-1">Essayez avec d'autres mots-clés.</p>
          </div>
        )}

        {state === 'success' && filtered.length > 0 && (
          <ul className="space-y-2.5">
            {filtered.map((conv) => (
              <li key={conv.id}>
                <Link
                  href={`/chat/${conv.id}`}
                  className="group flex items-center gap-4 bg-white rounded-xl border border-slate-100 shadow-sm hover:shadow-md hover:border-nestenn-cyan/30 transition-all p-4 md:p-5"
                >
                  <div className="h-10 w-10 rounded-lg bg-nestenn-cyan/10 flex items-center justify-center shrink-0 group-hover:bg-nestenn-cyan/15 transition-colors">
                    <MessageSquare className="h-4.5 w-4.5 text-nestenn-cyan" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-foreground truncate group-hover:text-nestenn-cyan transition-colors">
                      {conv.title || 'Conversation sans titre'}
                    </h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1.5 flex-wrap">
                      <span>{formatRelativeDate(conv.created_at)}</span>
                      {(conv.author_name || conv.agency_name) && (
                        <>
                          <span className="text-muted-foreground/40">•</span>
                          {conv.author_name && <span>{conv.author_name}</span>}
                          {conv.agency_name && (
                            <span className="px-1.5 py-0.5 bg-nestenn-cyan/10 text-nestenn-cyan rounded text-[10px] font-medium">
                              {conv.agency_name}
                            </span>
                          )}
                        </>
                      )}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-nestenn-cyan group-hover:translate-x-0.5 transition-all shrink-0" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
