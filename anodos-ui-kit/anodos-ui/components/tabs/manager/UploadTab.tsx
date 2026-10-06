'use client'

import { useState } from 'react'
import { Panel } from '../../ui/primitives'
import { useAnodos } from '@/store/useAnodos'
import { uploadModernizationJson } from '@/lib/api'
import { CheckCircle2, FileText, Upload, AlertCircle } from 'lucide-react'

export default function UploadTab() {
  const { elevatorId, fetchState } = useAnodos()
  const [docType, setDocType] = useState('Assessment Report')
  const [recordName, setRecordName] = useState('')
  const [notes, setNotes] = useState('')
  const [uploading, setUploading] = useState(false)
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null)

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!recordName) return

    setUploading(true)
    setStatus(null)

    const payload = {
      elevator_id: elevatorId,
      document_type: docType,
      record_name: recordName,
      notes: notes || 'Technical engineering record submitted by Manager',
      uploaded_at: new Date().toISOString(),
    }

    const res = await uploadModernizationJson(elevatorId, payload)
    setUploading(false)
    setStatus(res)

    if (res.ok) {
      setRecordName('')
      setNotes('')
      fetchState() // Refresh data
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="rounded-xl border border-line/70 bg-surface/90 p-5 shadow-card">
        <h1 className="text-xl font-extrabold tracking-tight text-ink">Upload Engineering & Modernization Records</h1>
        <p className="text-xs text-muted mt-1">
          Store third-party structural assessment records, vibration analysis logs, or maintenance certifications for {elevatorId}.
        </p>
      </div>

      <Panel title="Modernization Technical Record Payload Form">
        <form onSubmit={handleUpload} className="space-y-4 text-xs">
          <div>
            <label className="block text-muted font-semibold mb-1">Document Category</label>
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              className="w-full rounded-lg border border-line/70 bg-surface px-3 py-2 text-ink outline-none focus:border-accent"
            >
              <option value="Assessment Report">Engineering Assessment Report</option>
              <option value="Vibration Analysis">Vibration Spectrum Log</option>
              <option value="Insulation Test">Motor Winding Insulation Certification</option>
              <option value="Safety Certification">Safety Gear & Governor Inspection</option>
            </select>
          </div>

          <div>
            <label className="block text-muted font-semibold mb-1">Record Title / Document Identifier</label>
            <input
              type="text"
              required
              placeholder="e.g. Structural_Vibration_Audit_2026.pdf"
              value={recordName}
              onChange={(e) => setRecordName(e.target.value)}
              className="w-full rounded-lg border border-line/70 bg-surface px-3 py-2 text-ink outline-none focus:border-accent"
            />
          </div>

          <div>
            <label className="block text-muted font-semibold mb-1">Engineering Notes & Context</label>
            <textarea
              rows={3}
              placeholder="Provide technical notes or findings from the engineering assessment..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-lg border border-line/70 bg-surface px-3 py-2 text-ink outline-none focus:border-accent"
            />
          </div>

          {status && (
            <div
              className={`p-3 rounded-lg border flex items-center gap-2 ${
                status.ok ? 'bg-ok/10 border-ok/30 text-ok' : 'bg-fault/10 border-fault/30 text-fault'
              }`}
            >
              {status.ok ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
              <span className="font-semibold">{status.message}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={!recordName || uploading}
            className="btn-primary w-full py-2.5 flex items-center justify-center gap-2 font-bold disabled:opacity-50"
          >
            <Upload size={16} />
            {uploading ? 'Storing Record in Backend...' : 'Submit Engineering Record Payload'}
          </button>
        </form>
      </Panel>
    </div>
  )
}
