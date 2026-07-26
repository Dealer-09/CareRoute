"use client"
import { BACKEND_URL } from '@/lib/api'

import React, { useEffect, useRef, useState } from 'react'
import {
  FileText,
  Upload,
  Trash2,
  Loader2,
  File,
  ImageIcon,
  AlertCircle,
  ExternalLink,
} from 'lucide-react'
import { Button } from './ui/button'

type Doc = {
  id: string
  file_name: string
  mime_type: string
  triage_case_id: string | null
  created_at: string
  url: string | null
}

function fileIcon(mime: string) {
  if (mime.startsWith('image/')) return <ImageIcon size={18} className="text-blue-500" />
  return <FileText size={18} className="text-red-500" />
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function DocumentManager() {
  const [docs, setDocs] = useState<Doc[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [uploadError, setUploadError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const token = typeof window !== 'undefined' ? localStorage.getItem('careRouteToken') : null

  useEffect(() => {
    if (token) fetchDocs()
    else setLoading(false)
  }, [token])

  async function fetchDocs() {
    try {
      const res = await fetch(`${BACKEND_URL}/api/documents`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setDocs(data.documents)
    } catch {
      setError('Could not load documents.')
    } finally {
      setLoading(false)
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !token) return
    setUploadError('')
    setUploading(true)

    const form = new FormData()
    form.append('file', file)

    try {
      const res = await fetch(`${BACKEND_URL}/api/documents/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      })
      const data = await res.json()
      if (!res.ok) {
        setUploadError(data.error || 'Upload failed')
        return
      }
      // Refresh list to get signed URL
      await fetchDocs()
    } catch {
      setUploadError('Upload failed. Check your connection.')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function handleDelete(id: string) {
    if (!token) return
    setDeletingId(id)
    try {
      const res = await fetch(`${BACKEND_URL}/api/documents/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error()
      setDocs(prev => prev.filter(d => d.id !== id))
    } catch {
      alert('Failed to delete document.')
    } finally {
      setDeletingId(null)
    }
  }

  if (!token) return null

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <File size={18} className="text-blue-600" />
          <h2 className="font-semibold text-slate-800">My Documents</h2>
          {docs.length > 0 && (
            <span className="text-xs bg-slate-100 text-slate-500 font-medium px-2 py-0.5 rounded-full">{docs.length}</span>
          )}
        </div>

        {/* Upload button */}
        <div>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            className="hidden"
            id="doc-upload-input"
            onChange={handleUpload}
            disabled={uploading}
          />
          <Button
            size="sm"
            className="gap-2"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
          >
            {uploading ? (
              <><Loader2 size={14} className="animate-spin" /> Uploading…</>
            ) : (
              <><Upload size={14} /> Upload</>
            )}
          </Button>
        </div>
      </div>

      {/* Upload error */}
      {uploadError && (
        <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
          <AlertCircle size={15} className="shrink-0" />
          {uploadError}
        </div>
      )}

      {/* List error */}
      {error && (
        <p className="text-sm text-slate-500 text-center py-6">{error}</p>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-8">
          <Loader2 size={24} className="text-blue-400 animate-spin" />
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && docs.length === 0 && (
        <div className="text-center py-10 text-slate-400">
          <File size={32} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">No documents yet</p>
          <p className="text-xs mt-1">Upload PDFs or images (max 10 MB)</p>
        </div>
      )}

      {/* Document list */}
      {!loading && docs.length > 0 && (
        <ul className="space-y-2">
          {docs.map(doc => (
            <li
              key={doc.id}
              className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors group"
            >
              <div className="shrink-0">{fileIcon(doc.mime_type)}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">{doc.file_name}</p>
                <p className="text-xs text-slate-400">{formatDate(doc.created_at)}</p>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {doc.url && (
                  <a
                    href={doc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                    title="Open file"
                  >
                    <ExternalLink size={15} />
                  </a>
                )}
                <button
                  onClick={() => handleDelete(doc.id)}
                  disabled={deletingId === doc.id}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40"
                  title="Delete"
                >
                  {deletingId === doc.id ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <Trash2 size={15} />
                  )}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs text-slate-300 text-center mt-4">
        PDF · JPEG · PNG · WEBP · max 10 MB
      </p>
    </div>
  )
}
