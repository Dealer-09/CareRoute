import { GoogleGenerativeAI, SchemaType, type Schema } from '@google/generative-ai'
import { NextRequest, NextResponse } from 'next/server'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

// ─── Extraction schema ────────────────────────────────────────────────────────
const EXTRACT_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    document_type: {
      type: SchemaType.STRING,
      description: 'Type of document: Lab Report, Prescription, Discharge Summary, Imaging Report, Insurance Card, Vaccination Record, or Other',
    },
    summary: {
      type: SchemaType.STRING,
      description: 'One sentence summary of what this document is and its key finding.',
    },
    doctor: {
      type: SchemaType.STRING,
      description: 'Name of the treating or signing doctor if visible, else empty string.',
    },
    hospital: {
      type: SchemaType.STRING,
      description: 'Hospital or clinic name if visible, else empty string.',
    },
    patient_name: {
      type: SchemaType.STRING,
      description: 'Patient name as printed on the document, else empty string.',
    },
    report_date: {
      type: SchemaType.STRING,
      description: 'Date of the report or prescription in YYYY-MM-DD format if found, else empty string.',
    },
    conditions: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
      description: 'Medical conditions, diagnoses, or impressions mentioned in the document.',
    },
    medications: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          name:     { type: SchemaType.STRING, description: 'Drug name (generic or brand)' },
          dose:     { type: SchemaType.STRING, description: 'Dose e.g. 500mg' },
          frequency:{ type: SchemaType.STRING, description: 'How often e.g. twice daily' },
        },
        required: ['name'],
      },
      description: 'Medications or drugs listed in the document.',
    },
    lab_values: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          test:      { type: SchemaType.STRING, description: 'Test name e.g. HbA1c' },
          value:     { type: SchemaType.STRING, description: 'Result value e.g. 7.2%' },
          reference: { type: SchemaType.STRING, description: 'Normal reference range if shown' },
          flag:      { type: SchemaType.STRING, description: 'H (high) / L (low) / N (normal) if indicated' },
        },
        required: ['test', 'value'],
      },
      description: 'Lab test results with values.',
    },
    allergies: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
      description: 'Any drug or food allergies mentioned.',
    },
    red_flags: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
      description: 'Any abnormal findings, critical values, or urgent notes visible in the document.',
    },
  },
  required: ['document_type', 'summary', 'conditions', 'medications', 'lab_values'],
}

// ─── Route ────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { url, mime_type } = body as { url: string; mime_type: string }

    if (!url || !mime_type) {
      return NextResponse.json({ error: 'url and mime_type are required' }, { status: 400 })
    }

    // 1. Fetch the file bytes from the Supabase signed URL
    const fileRes = await fetch(url)
    if (!fileRes.ok) {
      return NextResponse.json({ error: 'Could not fetch document from storage' }, { status: 502 })
    }
    const buffer = await fileRes.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')

    // 2. Send to Gemini with structured extraction prompt
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: EXTRACT_SCHEMA,
        temperature: 0.1, // low temp for factual extraction
      },
    })

    const prompt = `You are a medical document intelligence engine. Extract all structured information from this medical document.

Rules:
- Only extract what is explicitly written in the document. Do not infer or guess.
- For medications, include every drug mentioned even in dosage instructions.
- For lab values, capture every row in the results table.
- Mark lab values as flag: "H" if above normal, "L" if below normal, "N" if normal.
- If a field is not present in the document, return an empty string or empty array.
- Be precise with numbers — copy values exactly as written.

Extract all information now.`

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          mimeType: mime_type as 'application/pdf' | 'image/jpeg' | 'image/png' | 'image/webp',
          data: base64,
        },
      },
    ])

    const text = result.response.text()
    const extracted = JSON.parse(text)

    return NextResponse.json({ extracted })
  } catch (err) {
    console.error('Document extraction error:', err)
    return NextResponse.json({ error: 'Extraction failed' }, { status: 500 })
  }
}
