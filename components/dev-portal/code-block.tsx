'use client'

import * as React from 'react'
import { Check, Copy, Terminal } from 'lucide-react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'

type Lang = 'curl' | 'javascript' | 'python' | 'go' | 'json' | 'bash' | 'text'

const LANG_LABELS: Record<Lang, string> = {
  curl: 'cURL', javascript: 'JavaScript', python: 'Python',
  go: 'Go', json: 'JSON', bash: 'Bash', text: 'Text',
}
const PRISM_LANG: Record<Lang, string> = {
  curl: 'bash', javascript: 'javascript', python: 'python',
  go: 'go', json: 'json', bash: 'bash', text: 'text',
}

interface CodeBlockProps {
  code: string
  language?: Lang
  tabs?: { language: Lang; code: string }[]
  label?: string
  maxHeight?: string
}

export function CodeBlock({ code, language = 'bash', tabs, label, maxHeight = '340px' }: CodeBlockProps) {
  const [copied, setCopied] = React.useState(false)
  const [activeTab, setActiveTab] = React.useState(0)

  const activeCode = tabs ? tabs[activeTab].code : code
  const activeLang = tabs ? tabs[activeTab].language : language

  function handleCopy() {
    navigator.clipboard.writeText(activeCode).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="rounded-xl overflow-hidden border border-white/10 bg-[#1a1a2e] shadow-lg">
      {/* Header bar */}
      <div className="flex items-center justify-between bg-[#16213e] px-4 py-2.5 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Terminal size={13} className="text-slate-400" />
          {label && <span className="text-xs text-slate-400 font-medium">{label}</span>}
          {tabs && (
            <div className="flex items-center gap-0.5 ml-1">
              {tabs.map((t, i) => (
                <button
                  key={t.language}
                  onClick={() => setActiveTab(i)}
                  className={`px-2.5 py-0.5 rounded text-xs font-medium transition-colors ${
                    i === activeTab
                      ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {LANG_LABELS[t.language]}
                </button>
              ))}
            </div>
          )}
          {!tabs && (
            <span className="text-xs text-slate-500 font-mono">{LANG_LABELS[activeLang] ?? activeLang}</span>
          )}
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors px-2 py-1 rounded hover:bg-white/5"
        >
          {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
          <span className="hidden sm:inline">{copied ? 'Copied!' : 'Copy'}</span>
        </button>
      </div>

      {/* Code body */}
      <div style={{ maxHeight, overflowY: 'auto' }}>
        <SyntaxHighlighter
          language={PRISM_LANG[activeLang] ?? 'text'}
          style={oneDark}
          customStyle={{
            margin: 0,
            padding: '1rem 1.25rem',
            background: 'transparent',
            fontSize: '0.8rem',
            lineHeight: '1.6',
          }}
          wrapLongLines={false}
        >
          {activeCode}
        </SyntaxHighlighter>
      </div>
    </div>
  )
}
