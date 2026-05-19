'use client'

import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Send, Scale, AlertTriangle, Mic, FileText, X } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import { ModelSelector } from '@/components/ModelSelector'
import { DEFAULT_MODEL_ID, AVAILABLE_MODELS } from '@/lib/model-config'
import { createClient } from '@/lib/supabase/client'
import { LegalDisclaimer } from '@/components/LegalDisclaimer'
import { LetterModal } from '@/components/LetterModal'
import {
  saveConversation,
  generateTitle,
  type StoredConversation,
} from '@/lib/conversation-storage'
import { getOrCreateConversation, saveMessage } from '@/lib/chat-persistence'
import { DocumentUpload } from '@/components/DocumentUpload'

const MODEL_PREF_KEY = 'nestenn:default-model-id'

interface LetterSuggestion {
  needed: boolean
  type?: string
  recipient?: string
  lrar?: boolean
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  isStreaming?: boolean
  isRejection?: boolean
  timestamp: Date
}

function genId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function ThinkingBar() {
  const steps = ['Analyse de la question…', 'Consultation Légifrance…', 'Vérification jurisprudence…']
  const [step, setStep] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setStep(s => (s + 1) % steps.length), 2000)
    return () => clearInterval(t)
  }, [])
  return (
    <div className="flex-1 min-w-0">
      <motion.p key={step} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs text-white/70 mb-3">
        {steps[step]}
      </motion.p>
      <div className="relative h-0.5 rounded-full bg-white/20 overflow-hidden">
        <motion.div
          className="absolute top-0 h-full bg-white rounded-full"
          style={{ width: '40%' }}
          animate={{ left: ['-40%', '140%'] }}
          transition={{ duration: 1.8, ease: 'easeInOut', repeat: Infinity, repeatDelay: 0.1 }}
        />
      </div>
    </div>
  )
}

export function ChatUI({ conversationId }: { conversationId?: string }) {
  // Messages et loading scopés par conversationId
  const [conversationMessages, setConversationMessages] = useState<Record<string, Message[]>>({})
  const [conversationLoading, setConversationLoading] = useState<Record<string, boolean>>({})

  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const [activeConvId, setActiveConvId] = useState<string | null>(null)
  const [letterSuggestions, setLetterSuggestions] = useState<Record<string, LetterSuggestion>>({})
  const [letterModal, setLetterModal] = useState<{ open: boolean; msgId: string } | null>(null)

  const [attachedFile, setAttachedFile] = useState<{ path: string; name: string } | null>(null)
  // Un AbortController et un supabaseConvId par conversation
  const abortControllers = useRef<Record<string, AbortController>>({})
  const supabaseConvIds = useRef<Record<string, string>>({})

  const [isListening, setIsListening] = useState(false)
  const [hasSpeechSupport, setHasSpeechSupport] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL_ID)

  // Charge la préférence de modèle depuis les Paramètres (localStorage)
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem('nestenn:default-model-id')
      if (stored && AVAILABLE_MODELS.some(m => m.id === stored)) {
        setSelectedModel(stored)
      }
    } catch { /* localStorage indisponible (SSR ou mode privé) */ }
  }, [])
  const [canSwitchModel, setCanSwitchModel] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null)

  // Valeurs dérivées pour la conversation active
  const messages = conversationMessages[activeConvId ?? ''] ?? []
  const isLoading = conversationLoading[activeConvId ?? ''] ?? false

  // Helper : mettre à jour les messages d'une conversation spécifique
  function setMsgs(convId: string, updater: Message[] | ((prev: Message[]) => Message[])) {
    setConversationMessages(prev => ({
      ...prev,
      [convId]: typeof updater === 'function' ? updater(prev[convId] ?? []) : updater,
    }))
  }

  function setLoading(convId: string, value: boolean) {
    setConversationLoading(prev => ({ ...prev, [convId]: value }))
  }

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data } = await supabase
        .from('users')
        .select('can_switch_model')
        .eq('id', user.id)
        .single()
      if (data?.can_switch_model) setCanSwitchModel(true)
    }).catch(() => {})
  }, [])

  // Applique la préférence de modèle persistée (synchronisée avec /settings et la sidebar)
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(MODEL_PREF_KEY)
      if (stored && AVAILABLE_MODELS.some(m => m.id === stored)) {
        setSelectedModel(stored)
      }
    } catch { /* localStorage indisponible */ }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SRClass = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition
    if (!SRClass) return
    setHasSpeechSupport(true)
    const ua = navigator.userAgent
    const ios = /iPad|iPhone|iPod/.test(ua) && /Safari/.test(ua) && !/Chrome/.test(ua)
    setIsIOS(ios)
  }, [])

  function toggleVoice() {
    if (isListening) {
      recognitionRef.current?.stop()
      return
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SRClass = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition
    if (!SRClass) return
    const recognition = new SRClass()
    recognition.lang = 'fr-FR'
    recognition.interimResults = false
    recognition.maxAlternatives = 1
    recognitionRef.current = recognition
    recognition.onstart = () => setIsListening(true)
    recognition.onend = () => setIsListening(false)
    recognition.onerror = () => setIsListening(false)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      const transcript = event.results[0]?.[0]?.transcript ?? ''
      if (transcript) setInput(transcript)
    }
    recognition.start()
  }

  useEffect(() => {
    // Si on a un ID dans l'URL, on charge depuis la DB
    if (conversationId) {
      setActiveConvId(conversationId)
      setLoading(conversationId, true)

      fetch(`/api/chat/history/${conversationId}/messages`)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            setMsgs(conversationId, data.map((m: any) => ({
              id: m.id,
              role: m.role,
              content: m.content,
              timestamp: new Date(m.created_at),
            })))
            // On met à jour l'ID Supabase mappé
            supabaseConvIds.current[conversationId] = conversationId
          }
        })
        .catch(err => console.error('Erreur chargement messages:', err))
        .finally(() => setLoading(conversationId, false))
    } else {
      // Pour un nouveau chat, on génère un ID frais
      const newId = genId()
      setActiveConvId(newId)
      setMsgs(newId, [])
      // On vide le cache de persistence pour forcer une nouvelle ligne en DB au premier message
      import('@/lib/chat-persistence').then(m => m.resetConversation())
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId])

  // Scroll vers le bas uniquement quand un nouveau message apparaît (pas pendant le streaming)
  const prevMsgCount = useRef(0)
  useEffect(() => {
    const currentCount = messages.length
    if (currentCount > prevMsgCount.current || (!isLoading && prevMsgCount.current > 0)) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
    prevMsgCount.current = currentCount
  }, [messages.length, isLoading])

  async function handleSubmit(question: string) {
    if (!question.trim() || isLoading) return
    setInput('')

    const convId = activeConvId!

    // Annuler tout stream précédent pour CETTE conversation seulement
    abortControllers.current[convId]?.abort()
    abortControllers.current[convId] = new AbortController()
    const signal = abortControllers.current[convId].signal

    // On ne pré-injecte plus le texte ici, on envoie le chemin du document
    const fullMessage = question
    let docLabel: string | null = null
    if (attachedFile) {
      docLabel = attachedFile.name
    }

    const userMsg: Message = {
      id: genId(),
      role: 'user',
      content: docLabel ? `📎 ${docLabel}\n\n${question}` : question,
      timestamp: new Date(),
    }
    setMsgs(convId, prev => [...prev, userMsg])
    setLoading(convId, true)

    const assistantId = genId()
    let finalContent = ''
    let isRejection = false
    let modelUsed: string | undefined

    // Persistance Supabase
    let dbMessageId: string | null = null
    try {
      const currentMsgs = conversationMessages[convId] ?? []
      const firstUserMsg = currentMsgs.find(m => m.role === 'user')
      const title = firstUserMsg ? generateTitle(firstUserMsg.content) : generateTitle(question)
      if (!supabaseConvIds.current[convId]) {
        const newSbId = await getOrCreateConversation(title)
        if (newSbId) supabaseConvIds.current[convId] = newSbId
      }
      const sbConvId = supabaseConvIds.current[convId]
      if (sbConvId) {
        dbMessageId = await saveMessage(sbConvId, 'user', question)
      }
    } catch { /* silencieux */ }

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: fullMessage,
          conversationHistory: (conversationMessages[convId] ?? []).slice(-10).map(m => ({ role: m.role, content: m.content })),
          messageId: dbMessageId ?? undefined,
          conversationId: supabaseConvIds.current[convId] ?? undefined,
          model: canSwitchModel ? selectedModel : undefined,
          documentPath: attachedFile?.path, // Transmission du chemin Supabase
        }),
      })

      if (res.ok) {
        setAttachedFile(null) // Reset du fichier après envoi
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Erreur inconnue' }))
        setMsgs(convId, prev => [...prev, { id: assistantId, role: 'assistant', content: err.error ?? 'Erreur survenue.', isRejection: true, timestamp: new Date() }])
        return
      }

      modelUsed = res.headers.get('X-Model-Used') ?? undefined

      const ct = res.headers.get('Content-Type') ?? ''
      if (ct.includes('application/json')) {
        const data = await res.json()
        finalContent = data.content ?? data.error ?? 'Réponse indisponible.'
        isRejection = data.rejection === true
        setMsgs(convId, prev => [...prev, { id: assistantId, role: 'assistant', content: finalContent, isRejection, timestamp: new Date() }])
      } else {
        const reader = res.body?.getReader()
        if (!reader) throw new Error('Pas de body')
        const decoder = new TextDecoder()
        let accumulated = ''

        setMsgs(convId, prev => [...prev, { id: assistantId, role: 'assistant', content: '', isStreaming: true, timestamp: new Date() }])

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const lines = decoder.decode(value, { stream: true }).split('\n')
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const raw = line.slice(6).trim()
            if (raw === '[DONE]') break
            try {
              const parsed = JSON.parse(raw)
              const token: string = parsed.choices?.[0]?.delta?.content ?? parsed.content ?? parsed.token ?? ''
              if (token) {
                accumulated += token
                setMsgs(convId, prev => prev.map(m => m.id === assistantId ? { ...m, content: accumulated } : m))
              }
            } catch { /* chunk partiel */ }
          }
        }

        // Extraction de la suggestion LETTER
        const letterMatch = accumulated.match(/\nLETTER:(\{[^}]+\})\s*$/)
        if (letterMatch) {
          try {
            const suggestion = JSON.parse(letterMatch[1]) as LetterSuggestion
            setLetterSuggestions(prev => ({ ...prev, [assistantId]: suggestion }))
          } catch { /* JSON malformé ignoré */ }
          accumulated = accumulated.replace(/\nLETTER:\{[^}]+\}\s*$/, '')
        }

        finalContent = accumulated
        setMsgs(convId, prev => prev.map(m => m.id === assistantId ? { ...m, content: accumulated, isStreaming: false } : m))
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        // Stream annulé — supprimer le placeholder de streaming mais garder la question
        setMsgs(convId, prev => prev.filter(m => m.id !== assistantId))
        return
      }
      setMsgs(convId, prev => [...prev, { id: assistantId, role: 'assistant', content: 'Erreur de connexion. Vérifiez votre réseau et réessayez.', isRejection: true, timestamp: new Date() }])
    } finally {
      setLoading(convId, false)
      if (finalContent) {
        // Sauvegarder la réponse assistant en Supabase avec le modèle utilisé
        const sbConvId = supabaseConvIds.current[convId]
        if (sbConvId) {
          saveMessage(sbConvId, 'assistant', finalContent, modelUsed).catch(() => {})
        }
        setMsgs(convId, prev => {
          const firstUser = prev.find(m => m.role === 'user')
          const title = firstUser ? generateTitle(firstUser.content) : 'Nouvelle conversation'
          const conv: StoredConversation = {
            id: convId,
            title,
            messages: prev.map(m => ({ id: m.id, role: m.role, content: m.content, timestamp: m.timestamp.toISOString() })),
            createdAt: prev[0]?.timestamp.toISOString() ?? new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }
          saveConversation(conv)
          return prev
        })
      }
    }
  }

  const showSuggestions = messages.length === 0 && !isLoading
  const placeholderText = isListening
    ? 'Écoute...'
    : attachedFile
      ? `Question sur ${attachedFile.name}...`
      : 'Demander à Nestenn'

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] md:h-screen bg-nestenn-light w-full">
      {/* Header */}
      <div className="shrink-0 border-b border-border bg-card px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <Scale className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <h1 className="text-sm font-semibold text-foreground">Assistant Juridique</h1>
            <p className="text-[11px] text-muted-foreground">Droit immobilier français • Sources Légifrance</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 md:px-6 py-6">
        <div className="max-w-3xl mx-auto space-y-6">

          {showSuggestions && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-nestenn-cyan rounded-xl shadow-sm p-6 text-white">
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
                  <Scale className="h-4 w-4 text-white" />
                </div>
                <p className="font-serif-legal text-sm text-white/90 leading-relaxed">
                  Je suis votre assistant juridique spécialisé en droit immobilier français. Posez-moi vos questions sur la copropriété, les mandats, les baux, la loi Hoguet ou les diagnostics obligatoires — je vous réponds avec des sources officielles Légifrance.
                </p>
              </div>
            </motion.div>
          )}

          {messages.map((msg) => {
            if (msg.role === 'user') {
              return (
                <motion.div key={msg.id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="flex justify-end">
                  <div className="bg-slate-100 text-slate-900 border border-slate-200 px-5 py-3 rounded-xl rounded-br-sm text-sm max-w-lg">
                    {msg.content}
                  </div>
                </motion.div>
              )
            }

            if (msg.isRejection) {
              return (
                <motion.div key={msg.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-card rounded-xl border border-orange-200 p-5">
                  <div className="flex items-start gap-3">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <AlertTriangle className="h-4 w-4 text-status-warning" />
                    </div>
                    <p className="text-sm text-foreground/80 leading-relaxed">{msg.content}</p>
                  </div>
                </motion.div>
              )
            }

            return (
              <motion.div key={msg.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-[#00a1b0] text-white rounded-xl shadow-sm p-6">
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
                    <Scale className="h-4 w-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    {msg.isStreaming && !msg.content ? (
                      <ThinkingBar />
                    ) : (
                      <div className="text-sm text-white/90 leading-relaxed font-serif-legal prose-legal-md">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          rehypePlugins={[rehypeRaw]}
                          components={{
                            a: ({ href, children }) => (
                              <a href={href} target="_blank" rel="noopener noreferrer"
                                className="underline font-medium hover:text-white/80"
                                style={{ color: 'white' }}>
                                {children}
                              </a>
                            ),
                            h3: ({ children }) => <h3 style={{ fontSize: 15, fontWeight: 700, margin: '1em 0 0.4em', color: 'white' }}>{children}</h3>,
                            h4: ({ children }) => <h4 style={{ fontSize: 14, fontWeight: 600, margin: '0.8em 0 0.3em', color: 'white' }}>{children}</h4>,
                            table: ({ children }) => (
                              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, margin: '0.5em 0' }}>{children}</table>
                            ),
                            th: ({ children }) => (
                              <th style={{ border: '1px solid rgba(255,255,255,0.2)', padding: '6px 8px', background: 'rgba(0,0,0,0.1)', fontWeight: 600, textAlign: 'left', fontSize: 11 }}>{children}</th>
                            ),
                            td: ({ children }) => (
                              <td style={{ border: '1px solid rgba(255,255,255,0.2)', padding: '6px 8px', fontSize: 12 }}>{children}</td>
                            ),
                            hr: () => <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.2)', margin: '0.8em 0' }} />,
                            blockquote: ({ children }) => (
                              <blockquote style={{ borderLeft: '3px solid white', paddingLeft: 12, margin: '0.5em 0', color: 'rgba(255,255,255,0.8)', fontStyle: 'italic' }}>{children}</blockquote>
                            ),
                          }}
                        >
                          {msg.content}
                        </ReactMarkdown>
                        {msg.isStreaming && <span className="inline-block w-0.5 h-[1em] bg-primary ml-0.5 align-middle animate-pulse" />}
                      </div>
                    )}
                    {!msg.isStreaming && letterSuggestions[msg.id]?.needed === true && (
                      <div className="mt-4 p-4 rounded-lg border border-amber-200 bg-amber-50 flex items-center justify-between">
                        <div>
                          <p className="text-xs font-bold text-amber-700 uppercase tracking-wider">📝 Courrier recommandé</p>
                          <p className="text-sm text-amber-900 mt-0.5">
                            {letterSuggestions[msg.id].type}
                            {letterSuggestions[msg.id].lrar ? ' — envoi par LRAR conseillé' : ''}
                          </p>
                        </div>
                        <button
                          onClick={() => setLetterModal({ open: true, msgId: msg.id })}
                          className="px-4 py-2 rounded-lg bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700 transition-colors"
                        >
                          Générer →
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )
          })}

          {isLoading && !messages.some(m => m.role === 'assistant' && m.isStreaming) && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-card rounded-xl border border-border p-6">
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Scale className="h-4 w-4 text-primary" />
                </div>
                <ThinkingBar />
              </div>
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Letter Modal */}
      {letterModal?.open && (() => {
        const suggestion = letterSuggestions[letterModal.msgId]
        const context = messages
          .slice(-3)
          .map(m => `${m.role === 'user' ? 'Question' : 'Réponse'}: ${m.content}`)
          .join('\n\n')
        return (
          <LetterModal
            letterType={suggestion?.type ?? ''}
            recipient={suggestion?.recipient ?? ''}
            lrar={suggestion?.lrar ?? false}
            conversationContext={context}
            onClose={() => setLetterModal(null)}
          />
        )
      })()}

      {/* Input */}
      <div className="shrink-0 border-t border-border bg-card">
        <div className="max-w-3xl mx-auto px-6 py-3">
          {/* Badge document joint (Supabase Storage) */}
          {attachedFile && (
            <div className="flex items-center gap-2 px-3 py-1.5 mb-2 bg-primary/10 rounded-lg text-xs w-fit border border-primary/20 animate-in fade-in slide-in-from-bottom-1">
              <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className="text-primary font-medium truncate max-w-[200px]">{attachedFile.name}</span>
              <button
                onClick={() => setAttachedFile(null)}
                className="text-primary/60 hover:text-primary transition-colors ml-1"
                aria-label="Retirer le document"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
          <div className="flex items-center gap-1 mb-2 bg-background border border-border rounded-full pr-1.5 pl-1 py-1 shadow-sm focus-within:ring-2 focus-within:ring-nestenn-cyan/20 focus-within:border-nestenn-cyan transition-all">
            {/* Nouveau composant d'upload asynchrone direct vers Supabase */}
            <DocumentUpload
              onUploadSuccess={(path, name) => setAttachedFile({ path, name })}
              disabled={isLoading}
            />
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSubmit(input)}
              placeholder={placeholderText}
              className="flex-1 px-2 py-2.5 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none disabled:opacity-50"
              disabled={isLoading}
            />
            {canSwitchModel && (
              <div className="shrink-0 hidden sm:block">
                <ModelSelector
                  selected={selectedModel}
                  onChange={setSelectedModel}
                  disabled={isLoading}
                />
              </div>
            )}
            {hasSpeechSupport && (
              <div className="relative flex items-center justify-center shrink-0">
                {isListening && (
                  <span className="absolute inset-0 rounded-full bg-red-400 opacity-40 animate-ping" />
                )}
                <button
                  type="button"
                  onClick={toggleVoice}
                  disabled={isLoading}
                  title={isIOS ? 'Maintenez le bouton pour parler' : isListening ? 'Arrêter' : 'Saisie vocale'}
                  className={`relative p-2 rounded-full transition-colors disabled:opacity-40 ${
                    isListening
                      ? 'bg-red-500 text-white hover:bg-red-600'
                      : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                  }`}
                >
                  <Mic className="h-4 w-4" />
                </button>
              </div>
            )}
            <button
              onClick={() => handleSubmit(input)}
              disabled={!input.trim() || isLoading}
              className="p-2.5 ml-1 rounded-full bg-nestenn-cyan text-white hover:bg-nestenn-cyan-hover transition-colors disabled:opacity-40 disabled:bg-muted disabled:text-muted-foreground shrink-0"
            >
              <Send className="h-4 w-4 ml-[2px]" />
            </button>
          </div>
          <LegalDisclaimer />
        </div>
      </div>
    </div>
  )
}
