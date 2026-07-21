'use client'

import * as React from 'react'
import { User, Upload, Phone, Globe, Link2, Mail, Hash, Plus, X, Eye } from 'lucide-react'
import { cn } from '@/lib/utils'

const SKILL_SUGGESTIONS = [
  'Project Management', 'Risk Management', 'Contract Administration', 'HSE Management',
  'Cost Control', 'Scheduling', 'BIM', 'Procurement', 'Commissioning', 'Stakeholder Management',
  'Structural Engineering', 'Electrical Engineering', 'Civil Engineering', 'Finance',
  'Quality Assurance', 'Document Control',
]

const TIMEZONES = [
  'UTC', 'Asia/Riyadh', 'Asia/Dubai', 'Asia/Singapore', 'Europe/London',
  'Europe/Paris', 'America/New_York', 'America/Chicago', 'America/Los_Angeles',
]

const DEPARTMENTS = [
  'Engineering', 'PMO', 'Finance', 'Commercial', 'HSE', 'Procurement',
  'Commissioning', 'Operations', 'Legal', 'IT',
]

export function ProfileTab({ onSave }: { onSave: () => void }) {
  const [name, setName]           = React.useState('James Morgan')
  const [title, setTitle]         = React.useState('PMO Director')
  const [dept, setDept]           = React.useState('PMO')
  const [phone, setPhone]         = React.useState('+966 50 123 4567')
  const [timezone, setTimezone]   = React.useState('Asia/Riyadh')
  const [bio, setBio]             = React.useState('Capital project governance professional with 18 years in EPC and renewables.')
  const [skills, setSkills]       = React.useState(['Project Management', 'Risk Management', 'Commissioning'])
  const [skillInput, setSkillInput] = React.useState('')
  const [linkedin, setLinkedin]   = React.useState('james-morgan-pmo')
  const [slack, setSlack]         = React.useState('@james.morgan')
  const [avatarPreview, setAvatarPreview] = React.useState<string | null>(null)
  const [dragging, setDragging]   = React.useState(false)
  const fileRef = React.useRef<HTMLInputElement>(null)

  function handleFile(file: File) {
    const reader = new FileReader()
    reader.onload = (e) => setAvatarPreview(e.target?.result as string)
    reader.readAsDataURL(file)
  }

  function addSkill(skill: string) {
    const s = skill.trim()
    if (s && !skills.includes(s)) setSkills([...skills, s])
    setSkillInput('')
  }

  const suggestions = SKILL_SUGGESTIONS.filter(
    (s) => s.toLowerCase().includes(skillInput.toLowerCase()) && !skills.includes(s)
  )

  return (
    <div className="space-y-8">
      {/* Avatar */}
      <div className="flex items-start gap-6">
        <div className="relative flex-shrink-0">
          <div
            className={cn(
              'size-24 rounded-2xl border-2 border-dashed border-border overflow-hidden flex items-center justify-center bg-muted/40 cursor-pointer transition-colors',
              dragging && 'border-primary bg-primary/5'
            )}
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
          >
            {avatarPreview
              ? <img src={avatarPreview} alt="Avatar preview" className="size-full object-cover" />
              : <User className="size-8 text-muted-foreground" />}
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
        </div>
        <div className="flex-1 space-y-1">
          <p className="text-sm font-medium text-foreground">Profile photo</p>
          <p className="text-xs text-muted-foreground">PNG, JPG or GIF up to 2MB. Drag or click to upload.</p>
          <div className="flex gap-2 mt-2">
            <button onClick={() => fileRef.current?.click()}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border bg-muted/40 hover:bg-muted text-foreground transition-colors">
              <Upload className="size-3" /> Upload
            </button>
            {avatarPreview && (
              <button onClick={() => setAvatarPreview(null)}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border bg-muted/40 hover:bg-muted text-foreground transition-colors">
                <X className="size-3" /> Remove
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Basic info */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          { label: 'Full Name', value: name, set: setName, placeholder: 'Your full name' },
          { label: 'Job Title', value: title, set: setTitle, placeholder: 'e.g. PMO Director' },
        ].map(({ label, value, set, placeholder }) => (
          <div key={label} className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{label}</label>
            <input value={value} onChange={(e) => set(e.target.value)} placeholder={placeholder}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus:ring-1 focus:ring-ring/50" />
          </div>
        ))}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Department</label>
          <select value={dept} onChange={(e) => setDept(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring/50">
            {DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Phone</label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <input value={phone} onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-lg border border-border bg-background pl-8 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus:ring-1 focus:ring-ring/50" />
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Timezone</label>
          <div className="relative">
            <Globe className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <select value={timezone} onChange={(e) => setTimezone(e.target.value)}
              className="w-full rounded-lg border border-border bg-background pl-8 pr-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring/50">
              {TIMEZONES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Bio */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">About</label>
        <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus:ring-1 focus:ring-ring/50 resize-none" />
        <p className="text-[10px] text-muted-foreground">{bio.length}/300 characters</p>
      </div>

      {/* Skills */}
      <div className="space-y-2">
        <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Skills</label>
        <div className="flex flex-wrap gap-2 mb-2">
          {skills.map((s) => (
            <span key={s} className="flex items-center gap-1 text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-full font-medium">
              {s}
              <button onClick={() => setSkills(skills.filter((x) => x !== s))} className="hover:text-destructive transition-colors">
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
        <div className="relative">
          <Hash className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <input value={skillInput} onChange={(e) => setSkillInput(e.target.value)}
            onKeyDown={(e) => { if (e.nativeEvent.isComposing) return; if (e.key === 'Enter') { e.preventDefault(); if (suggestions[0]) addSkill(suggestions[0]); else addSkill(skillInput) } }}
            placeholder="Add a skill…"
            className="w-full rounded-lg border border-border bg-background pl-8 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus:ring-1 focus:ring-ring/50" />
          {skillInput && suggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 z-10 mt-1 rounded-lg border border-border bg-popover shadow-lg overflow-hidden">
              {suggestions.slice(0, 5).map((s) => (
                <button key={s} onMouseDown={() => addSkill(s)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted text-left transition-colors">
                  <Plus className="size-3 text-muted-foreground" /> {s}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Contact links */}
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Contact Links</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { icon: Link2, label: 'LinkedIn', value: linkedin, set: setLinkedin, prefix: 'linkedin.com/in/' },
            { icon: Hash, label: 'Slack Handle', value: slack, set: setSlack, prefix: '' },
          ].map(({ icon: Icon, label, value, set, prefix }) => (
            <div key={label} className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">{label}</label>
              <div className="flex items-center rounded-lg border border-border bg-background overflow-hidden">
                {prefix && <span className="px-2 py-2 text-xs text-muted-foreground bg-muted/40 border-r border-border whitespace-nowrap">{prefix}</span>}
                <div className="relative flex-1">
                  <Icon className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                  <input value={value} onChange={(e) => set(e.target.value)}
                    className="w-full bg-transparent pl-8 pr-3 py-2 text-sm text-foreground outline-none" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-border">
        <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <Eye className="size-3.5" /> View Public Profile
        </button>
        <button onClick={onSave}
          className="px-4 py-2 text-sm font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
          Save Changes
        </button>
      </div>
    </div>
  )
}
