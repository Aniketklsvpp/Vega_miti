import React from 'react'
import { AlertOctagon, FileQuestion, RefreshCw } from 'lucide-react'

interface ErrorBannerProps {
  message: string
  missingField?: string
  file?: string
  onRetry: () => void
}

export const ErrorBanner: React.FC<ErrorBannerProps> = ({ message, missingField, file, onRetry }) => {
  return (
    <div className="max-w-2xl mx-auto my-12 p-6 rounded-2xl bg-rose-950/40 border border-rose-500/40 text-slate-200 shadow-2xl backdrop-blur">
      <div className="flex items-start gap-4">
        <div className="p-3 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30">
          <AlertOctagon className="w-6 h-6" />
        </div>
        <div className="space-y-3 flex-1">
          <h3 className="text-lg font-bold text-rose-300 tracking-tight">Dataset Schema Validation Failure</h3>
          <p className="text-sm text-slate-300 leading-relaxed">{message}</p>

          {(file || missingField) && (
            <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800 text-xs font-mono space-y-1">
              {file && (
                <div className="flex items-center gap-2 text-slate-400">
                  <FileQuestion className="w-3.5 h-3.5 text-rose-400" />
                  <span>Target File:</span>
                  <span className="text-slate-200 font-semibold">{file}</span>
                </div>
              )}
              {missingField && (
                <div className="flex items-center gap-2 text-slate-400">
                  <span className="text-rose-400 font-bold">!</span>
                  <span>Missing Required Field:</span>
                  <span className="text-rose-400 font-semibold bg-rose-950/60 px-1.5 py-0.5 rounded border border-rose-800/50">
                    {missingField}
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="pt-2">
            <button
              onClick={onRetry}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold tracking-wide transition shadow"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Retry Ingestion
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
