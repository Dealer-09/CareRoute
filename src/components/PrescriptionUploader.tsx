'use client'

import React, { useState, useRef } from 'react'
import Image from 'next/image'
import { UploadCloud, FileImage, Loader2, CheckCircle2, AlertCircle, X, BrainCircuit } from 'lucide-react'
// TensorFlow static imports removed to prevent Turbopack build crash
// We will dynamically load them at runtime in the browser instead.

type Props = {
  onExtraction: (text: string) => void
  onFileSelect: (file: File) => void
}

export const PrescriptionUploader: React.FC<Props> = ({ onExtraction, onFileSelect }) => {
  const [isDragging, setIsDragging] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [status, setStatus] = useState<'idle' | 'loading_model' | 'extracting' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [preview, setPreview] = useState<string | null>(null)
  const [modelUnavailable, setModelUnavailable] = useState(false)
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TFLite model has no public TS types
  const modelRef = useRef<any>(null)
  const tokenizerRef = useRef<string[] | null>(null)
  // Track whether we've already attempted to load the model (avoid repeat attempts)
  const modelLoadAttempted = useRef(false)

  // Load the Vision AI model on demand (first file selection), NOT on component mount.
  // The model is 545 MB — downloading it eagerly on every Step 2 visit would make
  // the app unusable on mobile. We load lazily and cache in modelRef.
  const ensureModelLoaded = async (): Promise<boolean> => {
    // Already loaded
    if (modelRef.current && tokenizerRef.current) return true
    // Already failed — don't retry
    if (modelLoadAttempted.current) return false

    modelLoadAttempted.current = true
    setStatus('loading_model')
    try {
      const tf = await (new Function("return import('@tensorflow/tfjs-core')"))()
      await (new Function("return import('@tensorflow/tfjs-backend-webgl')"))()
      const tflite = await (new Function("return import('@tensorflow/tfjs-tflite')"))()
      await tf.setBackend('webgl')
      await tf.ready()
      
      const [tfLiteModel, tokenizerResp] = await Promise.all([
        tflite.loadTFLiteModel('/models/rx_ocr_quantized.tflite'),
        fetch('/models/tokenizer.json').then(r => r.json())
      ])
      
      modelRef.current = tfLiteModel
      tokenizerRef.current = tokenizerResp.model.vocab.map(([token]: [string, number]) => token)
      
      return true
    } catch (err) {
      console.warn('Vision AI Model unavailable. Using fallback.', err)
      setModelUnavailable(true)
      return false
    }
  }

  const handleFileProcess = async (f: File) => {
    setFile(f)
    onFileSelect(f)
    setPreview(URL.createObjectURL(f))
    setErrorMsg('')

    // Load model on first use (lazy — avoids 545 MB download on every page visit)
    const modelReady = await ensureModelLoaded()
    setStatus('extracting')

    try {
      if (modelReady && modelRef.current) {
         // Create an image element to parse into a tensor
         const img = new window.Image() as HTMLImageElement
         img.src = URL.createObjectURL(f)
         await new Promise<void>((resolve) => { 
           img.onload = () => resolve()
           img.onerror = () => resolve()
         })
         
         const tf = await (new Function("return import('@tensorflow/tfjs-core')"))();
         
         // Preprocess: Resize to 1280x960 (trained resolution), Normalize, ExpandDims
         const imageTensor = tf.tidy(() => {
           const raw = tf.browser.fromPixels(img)
           const resized = tf.image.resizeBilinear(raw, [1280, 960])
           const normalized = tf.div(resized, 255.0)
           return tf.cast(tf.expandDims(normalized, 0), 'float32')
         })

         const DECODER_START = 57524 // <s_synthdog>
         const EOS_TOKEN = 2 // </s>
         const MAX_STEPS = 128

         const decoderIds: number[] = [DECODER_START]

         for (let step = 0; step < MAX_STEPS; step++) {
           const tokenTensor = tf.tensor2d([decoderIds], [1, decoderIds.length], 'int32')

           // eslint-disable-next-line @typescript-eslint/no-explicit-any
           const logits = modelRef.current.predict({
             pixel_values: imageTensor,
             decoder_input_ids: tokenTensor,
           }) as any // shape: [1, seq_len, vocab_size]

           // Argmax on the last position only
           const lastPos = tf.squeeze(tf.slice(logits, [0, decoderIds.length - 1, 0], [1, 1, -1]))
           const nextToken = (await lastPos.argMax(-1).data())[0]

           tokenTensor.dispose()
           logits.dispose()
           lastPos.dispose()

           if (nextToken === EOS_TOKEN) break
           decoderIds.push(nextToken)
         }
         imageTensor.dispose()

         // Decode & Parse Structured Output
         const vocab = tokenizerRef.current!
         const rawString = decoderIds.map(id => vocab[id] ?? '').join('')
         
         // Replace SentencePiece marker (U+2581) with spaces
         let decodedText = rawString.replace(/\u2581/g, ' ').trim()
         // Normalize subword boundaries in tags
         decodedText = decodedText.replace(/< s _ /g, '<s_').replace(/ >/g, '>')

         const drugs = [...decodedText.matchAll(/<s_drug>(.*?)<\/s_drug>/g)].map(m => m[1].trim())

         if (drugs.length > 0) {
           onExtraction(`Extracted medications:\n${drugs.map(d => `- ${d}`).join('\n')}`)
         } else {
           onExtraction('[OCR complete — no structured drug names detected. Review image quality.]')
         }
         setStatus('success')
      } else {
        // Fallback if weights are missing locally (dev mode)
        setTimeout(() => {
          onExtraction('[Local Vision Fallback]\nUnable to extract medications. On-device model unavailable.')
          setStatus('success')
        }, 2000)
      }
    } catch (err) {
      console.error('Vision AI Extraction Error:', err)
      setStatus('error')
      setErrorMsg('Failed to read prescription text securely.')
    }
  }

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const droppedFile = e.dataTransfer.files?.[0]
    if (droppedFile && droppedFile.type.startsWith('image/')) {
      handleFileProcess(droppedFile)
    }
  }

  const clearFile = () => {
    setFile(null)
    setPreview(null)
    setStatus('idle')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="w-full">
      {/* Label & Header */}
      <div className="flex items-center justify-between mb-3">
        <label className="text-sm font-bold text-slate-800">
          Upload Prescription / Reports
        </label>
        {modelUnavailable ? (
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-red-50 border border-red-200 rounded-full text-[10px] font-bold text-red-600 uppercase tracking-widest">
            <AlertCircle size={12} />
            Vision Unavailable
          </div>
        ) : (
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 border border-blue-500/20 rounded-full text-[10px] font-bold text-blue-700 uppercase tracking-widest">
            <BrainCircuit size={12} className="text-blue-600" />
            On-Device Vision
          </div>
        )}
      </div>

      {/* Upload Area */}
      {!file ? (
        <div
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`
            relative overflow-hidden rounded-2xl border-2 border-dashed transition-all duration-300 cursor-pointer group
            ${isDragging ? 'border-blue-500 bg-blue-50 scale-[1.02]' : 'border-slate-300 bg-slate-50 hover:bg-slate-100 hover:border-slate-400'}
            ${status === 'loading_model' ? 'opacity-50 pointer-events-none' : ''}
          `}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent pointer-events-none" />
          <div className="flex flex-col items-center justify-center py-10 px-4 text-center relative z-10">
            <div className={`
              w-16 h-16 rounded-full flex items-center justify-center mb-4 transition-transform duration-500
              ${isDragging ? 'bg-blue-100 text-blue-600 scale-110' : 'bg-white shadow-sm text-slate-400 group-hover:text-blue-500 group-hover:scale-110'}
            `}>
              <UploadCloud size={28} strokeWidth={2} />
            </div>
            <h4 className="text-base font-bold text-slate-800 mb-1">
              {isDragging ? 'Drop it here!' : 'Click or drag your image'}
            </h4>
            <p className="text-sm text-slate-500 max-w-[250px] mx-auto">
              We&apos;ll instantly extract the text securely on your device.
            </p>
          </div>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            ref={fileInputRef}
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) handleFileProcess(f)
            }}
          />
        </div>
      ) : (
        /* Processing / Success State */
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center p-4">
            {/* Image Preview Thumbnail */}
            <div className="w-16 h-16 shrink-0 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 mr-4 relative">
              {preview ? (
                <Image src={preview} alt="Prescription preview" fill className="object-cover" unoptimized />
              ) : (
                <FileImage className="w-6 h-6 m-5 text-slate-400" />
              )}
              {status === 'extracting' && (
                <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex items-center justify-center">
                  <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
                </div>
              )}
            </div>

            {/* Details */}
            <div className="flex-1 min-w-0 pr-4">
              <h4 className="text-sm font-bold text-slate-900 truncate mb-1">
                {file.name}
              </h4>
              
              {status === 'extracting' && (
                <div className="flex flex-col gap-2">
                  <div className="text-xs font-semibold text-blue-600 flex items-center gap-1.5">
                    <BrainCircuit size={14} className="animate-pulse" />
                    Extracting text locally via WebGL...
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="w-full h-full bg-blue-600 rounded-full animate-[progress_1.5s_ease-in-out_infinite]" style={{ transformOrigin: 'left' }} />
                  </div>
                </div>
              )}

              {status === 'success' && (
                <div className="text-xs font-semibold text-emerald-600 flex items-center gap-1.5">
                  <CheckCircle2 size={14} />
                  Extraction complete
                </div>
              )}

              {status === 'error' && (
                <div className="text-xs font-semibold text-red-600 flex items-center gap-1.5">
                  <AlertCircle size={14} />
                  {errorMsg}
                </div>
              )}
            </div>

            {/* Actions */}
            <button
              onClick={clearFile}
              className="w-8 h-8 rounded-full bg-slate-50 hover:bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-700 transition-colors shrink-0"
              title="Remove file"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
