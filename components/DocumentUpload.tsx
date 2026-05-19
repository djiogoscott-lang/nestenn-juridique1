'use client'

import { useState, useRef, useEffect } from 'react'
import { Plus, Loader2, MonitorUp, Camera, Cloud } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

interface DocumentUploadProps {
  onUploadSuccess: (path: string, name: string) => void
  disabled?: boolean
  className?: string
}

export function DocumentUpload({ onUploadSuccess, disabled, className }: DocumentUploadProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  // Fermer le menu au clic à l'extérieur
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Limite de taille (10Mo)
    const MAX_SIZE = 10 * 1024 * 1024
    if (file.size > MAX_SIZE) {
      setError('Le fichier est trop volumineux (max 10 Mo)')
      return
    }

    // Type fichier : PDF uniquement (le pipeline backend ne gère que les PDF)
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
    if (!isPdf) {
      setError('Seuls les fichiers PDF sont acceptés pour le moment.')
      return
    }

    setIsUploading(true)
    setError(null)
    setIsOpen(false) // On ferme le menu si l'upload commence

    try {
      // Vérification de l'utilisateur connecté
      const { data: { user }, error: authError } = await supabase.auth.getUser()

      if (authError || !user) {
        throw new Error("Vous devez être connecté pour importer un document.")
      }

      // Récupération du profil pour l'agency_id
      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('agency_id')
        .eq('id', user.id)
        .single()

      if (profileError || !profile?.agency_id) {
        throw new Error("Impossible de récupérer votre agence de rattachement.")
      }

      const fileExt = file.name.split('.').pop()
      const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`
      // Injection de l'ID agence et utilisateur dans le chemin
      const filePath = `uploads/${profile.agency_id}/${user.id}/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('nestenn-documents')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      const processRes = await fetch('/api/documents/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath })
      })

      const processData = await processRes.json()
      if (!processRes.ok) {
        throw new Error(processData.error || "Erreur lors de l'analyse du document par le serveur.")
      }

      onUploadSuccess(filePath, file.name)
    } catch (err: any) {
      console.error('Upload error:', err)
      setError(err.message || "Erreur lors de l'envoi")
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <div className={cn("relative flex items-center", className)} ref={menuRef}>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept="application/pdf,.pdf"
        disabled={disabled || isUploading}
      />

      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled || isUploading}
        className={cn(
          "p-2 rounded-full text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-all flex items-center justify-center relative",
          isUploading && "cursor-not-allowed opacity-70",
          isOpen && "bg-primary/10 text-primary hover:bg-primary/10" // Style actif quand le menu est ouvert
        )}
        title="Joindre un document (PDF, Word, TXT)"
      >
        {isUploading ? (
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
        ) : (
          <Plus className={cn("h-5 w-5 transition-transform duration-200", isOpen && "rotate-45")} />
        )}
      </button>

      {/* Menu flottant */}
      {isOpen && !disabled && !isUploading && (
        <div className="absolute bottom-full left-0 mb-3 w-72 bg-popover text-popover-foreground rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-border/50 p-2 animate-in fade-in slide-in-from-bottom-2 z-50">
          <div className="flex flex-col gap-1">
            <button
              type="button"
              onClick={() => {
                fileInputRef.current?.click()
                setIsOpen(false)
              }}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted/60 transition-colors text-sm font-medium text-foreground text-left w-full group"
            >
              <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                <MonitorUp className="h-4 w-4" />
              </div>
              Importer depuis l'ordinateur
            </button>


          </div>
        </div>
      )}

      {error && (
        <div className="absolute bottom-full mb-2 left-0 w-max max-w-[200px] bg-destructive text-destructive-foreground text-[10px] px-2 py-1 rounded shadow-lg animate-in fade-in slide-in-from-bottom-1 z-50">
          {error}
        </div>
      )}
    </div>
  )
}