import { useEffect, useState } from 'react'
import { get, set } from 'idb-keyval'
import { Profile, Item, Job, extract, clean, match, has } from './analyze'
import { JobSearch } from './jobsearch'
import { SkillAdder, Tracker, ResumeActions, addSkills } from './extras'

const uid = () => Math.random().toString(36).slice(2, 10)
const blank = (name:string): Profile => ({ id: uid(), name, personal: {}, skills: [], projects: [], experience: [], education: [], certs: [], jobs: [] })
type Sec = 'skills'|'projects'|'experience'|'education'|'certs'
const SECTIONS: Record<Sec,[string,string[]]> = {
  skills: ['Skills', ['category','name','proficiency']], projects: ['Projects', ['name','tech','desc','url']],
  experience: ['Experience (internships and jobs, newest first)', ['org','role','location','period','env','desc','achievements']], education: ['Education', ['qualification','institution','period','score']],
  certs: ['Certifications', ['name','issuer','date']] }
const LABEL: Record<string, string> = { org: 'Company / organisation', role: 'Job title', location: 'City', period: 'Dates (e.g. 06/2021 - Present)', env: 'Tools and environment', desc: 'Responsibilities (one bullet per line)', achievements: 'Achievements (one per line; add numbers only if true)', years: 'Total experience (years)', headline: 'Professional headline', qualification: 'Qualification', institution: 'Institution', score: 'Score (e.g. CGPA: 7.3)', issuer: 'Issued by', tech: 'Technologies', url: 'Link', category: 'Category', proficiency: 'Level' }
const PERSONAL = ['name','headline','email','phone','location','linkedin','github','summary']

export default function App() {
  const [profiles, setProfiles] = useState<Profile[]>([]), [active, setActive] = useState(''), [tab, setTab] = useState<'profile'|'job'|'tracker'|'search'>('job'), [ready, setReady] = useState(false)
  const [theme, setTheme] = useState(localStorage.getItem('ri-theme') || 'auto')
  useEffect(() => { if (theme === 'auto') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = theme; localStorage.setItem('ri-theme', theme) }, [theme])
  useEffect(() => { get('ri-state').then(s => { if (s?.profiles?.length) { setProfiles(s.profiles); setActive(s.active) } else { const p = blank('Profile 1'); setProfiles([p]); setActive(p.id) } setReady(true) }) }, [])
  useEffect(() => { if (ready) set('ri-state', { profiles, active }) }, [profiles, active, ready])
  const cur = profiles.find(p => p.id === active) ?? profiles[0]
  if (!cur) return null
  const update = (fn:(p:Profile)=>Profile) => setProfiles(ps => ps.map(p => p.id === cur.id ? fn(p) : p))
  const add = () => { const p = blank(`Profile ${profiles.length + 1}`); setProfiles([...profiles, p]); setActive(p.id) }
  const remove = () => { if (profiles.length > 1 && confirm(`Delete "${cur.name}" and all its jobs? This cannot be undone.`)) { const rest = profiles.filter(p => p.id !== cur.id); setProfiles(rest); setActive(rest[0].id) } }
  const backup = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify({ profiles, active })], { type: 'application/json' })); a.download = 'resume-intelligence-backup.json'; a.click() }
  const restore = (f?:File) => f?.text().then(t => { const s = JSON.parse(t); if (confirm('Replace all current data with this backup?')) { setProfiles(s.profiles); setActive(s.active) } })
  return <>
    <header><h1>Resume Intelligence</h1>
      <select aria-label="Profile" style={{ width: 160 }} value={cur.id} onChange={e => setActive(e.target.value)}>{profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
      <button onClick={add}>New profile</button>
      <button onClick={() => { const n = prompt('Rename profile', cur.name); if (n) update(p => ({ ...p, name: n })) }}>Rename</button>
      <button className="danger" onClick={remove}>Delete</button>
      <nav style={{ marginLeft: 'auto' }}>{(['job','profile','tracker','search'] as const).map(t => <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{({ job: 'New resume', profile: 'Master profile', tracker: 'Tracker', search: 'Find jobs' })[t]}</button>)}<button onClick={() => setTheme(theme === 'auto' ? 'light' : theme === 'light' ? 'dark' : 'auto')}>Theme: {theme}</button></nav>
    </header>
    <main>{tab === 'profile' ? <ProfileView p={cur} update={update} /> : tab === 'tracker' ? <Tracker p={cur} update={update} /> : tab === 'search' ? <JobSearch /> : <JobView p={cur} update={update} />}
      <section><h2>Backup</h2><div className="row"><button onClick={backup}>Download backup</button><label>Restore from backup<input type="file" accept=".json" onChange={e => restore(e.target.files?.[0])} /></label></div>
        <p className="mute">Data is stored in this browser only. Download a backup regularly.</p></section></main>
  </>
}

function ProfileView({ p, update }: { p:Profile; update:(f:(p:Profile)=>Profile)=>void }) {
  return <>
    <section><h2>Personal information</h2><div className="grid"><label>Career level<select value={p.level ?? 'fresher'} onChange={e => update(x => ({ ...x, level: e.target.value as 'fresher' | 'experienced' }))}><option value="fresher">Fresher (0-2 years)</option><option value="experienced">Experienced (3+ years)</option></select></label>{PERSONAL.concat(p.level === 'experienced' ? ['years'] : []).map(k => <label key={k}>{k === 'name' ? 'Full name' : LABEL[k] ?? k}
      {k === 'summary' ? <textarea rows={3} value={p.personal[k] ?? ''} onChange={e => update(x => ({ ...x, personal: { ...x.personal, [k]: e.target.value } }))} />
        : <input value={p.personal[k] ?? ''} onChange={e => update(x => ({ ...x, personal: { ...x.personal, [k]: e.target.value } }))} />}</label>)}</div>{p.level === 'experienced' && <p className="mute">Summary tip: job title, years of experience, your main platforms and tools, and one real result. Example: "Linux System Administrator with 5+ years managing 200+ servers on RHEL and Windows. Cut patching time by 40% through automation." Use numbers only if they are true.</p>}</section>
    <SkillAdder p={p} update={update} />
    {(Object.keys(SECTIONS) as Sec[]).filter(s => s !== 'skills').map(s => <section key={s}><h2>{SECTIONS[s][0]}</h2>
      {p[s].length === 0 && <p className="mute">Nothing added yet.</p>}
      {p[s].map((it:Item, i:number) => <div className="item" key={i}><div className="grid">{SECTIONS[s][1].map(f => <label key={f}>{LABEL[f] ?? f}
        <Field multi={f === 'desc' || f === 'achievements'} value={it[f] ?? ''} onChange={e => update(x => ({ ...x, [s]: x[s].map((o:Item, j:number) => j === i ? { ...o, [f]: e.target.value } : o) }))} /></label>)}</div>
        <button className="danger" style={{ marginTop: 6 }} onClick={() => update(x => ({ ...x, [s]: x[s].filter((_:Item, j:number) => j !== i) }))}>Remove</button></div>)}
      <button onClick={() => update(x => ({ ...x, [s]: [...x[s], {}] }))}>Add {SECTIONS[s][0].toLowerCase()}</button></section>)}
  </>
}

function JobView({ p, update }: { p:Profile; update:(f:(p:Profile)=>Profile)=>void }) {
  const [raw, setRaw] = useState(''), [job, setJob] = useState<Job | null>(null), [dupe, setDupe] = useState('')
  const analyze = () => {
    const f = extract(raw), txt = clean(raw), have = (f.required + ',' + f.preferred).toLowerCase().split(',').map(x => x.trim())
    const extra = [...new Set(p.skills.map(s => (s.name ?? '').trim().toLowerCase()).filter(n => n && !have.includes(n) && has(txt, n)))]
    f.required = [f.required, ...extra].filter(Boolean).join(', '); setJob({ id: uid(), created: new Date().toISOString(), raw, cleaned: clean(raw), f })
    setDupe(f.jobId && p.jobs.some(j => j.f.jobId === f.jobId && j.f.company === f.company) ? 'You already saved a job with this company and job ID.' : '')
  }
  const setF = (k:string, v:string) => job && setJob({ ...job, f: { ...job.f, [k]: v } })
  const m = job && match(p, job.f)
  return <>
    <section><h2>Paste the job page</h2>
      <p className="mute">Open the vacancy, press Ctrl+A then Ctrl+C, and paste it here. Menus and footers are removed automatically.</p>
      <textarea rows={10} value={raw} onChange={e => setRaw(e.target.value)} placeholder="Paste the full webpage text here" />
      <div className="row" style={{ marginTop: 8 }}><button className="primary" disabled={raw.trim().length < 30} onClick={analyze}>Analyze job</button>
        <label>or upload .txt<input type="file" accept=".txt" onChange={e => e.target.files?.[0]?.text().then(setRaw)} /></label></div></section>
    {job && m && <>
      <section><h2>Extracted details</h2><p className="mute">Check and correct before saving. Skills are comma separated.</p>
        {dupe && <p className="no tag">{dupe}</p>}
        {job.cleaned.length < 300 && <p className="no tag">This description looks short or incomplete.</p>}
        <div className="grid">{Object.keys(job.f).map(k => <label key={k}>{k}<input value={(job.f as Record<string,string>)[k]} onChange={e => setF(k, e.target.value)} /></label>)}</div></section>
      <section><h2>Match with {p.name}</h2>
        <div className="row"><div><div className="big">{m.overall}%</div><div className="mute">Profile match (not an ATS score)</div></div>
          <div className="mute">Skills {m.scores.skills}% · Projects {m.scores.projects}% · Experience {m.scores.experience}% · Keywords {m.scores.keywords}%</div></div>
        <p className="mute">Overall = 40% skills + 20% projects + 20% experience + 20% keywords. Skills count only when listed in your profile; a skill that appears only in a project or job description counts half.</p>
        <h2>Matched</h2>{m.matched.map(s => <span className="tag ok" key={s}>{s}</span>)}{!m.matched.length && <span className="mute">None</span>}
        <h2 style={{ marginTop: 12 }}>Partial (mentioned, not listed as a skill)</h2>{m.partial.map(s => <span className="tag" key={s}>{s}</span>)}{!m.partial.length && <span className="mute">None</span>}
        <h2 style={{ marginTop: 12 }}>Missing: tap a skill you really have to add it to your profile</h2>{m.missing.map(s => <button className="tag no" key={s} title="Adds to your profile. Only tap skills you really have." onClick={() => update(x => addSkills(x, [s], 'Other'))}>+ {s}</button>)}{!m.missing.length && <span className="mute">None</span>}
        <h2 style={{ marginTop: 12 }}>Most relevant projects</h2>
        {m.projects.slice(0, 3).map(x => <div className="item" key={x.pr.name}><strong>{x.pr.name}</strong> <span className="mute">covers {x.hits.join(', ')}</span></div>)}{!m.projects.length && <span className="mute">No project matches this job yet.</span>}</section>
      <ResumeActions key={job.id} p={p} f={job.f} onChange={(doc, tpl) => setJob(j => j && { ...j, doc, tpl })} />
      <button className="primary" onClick={() => { update(x => ({ ...x, jobs: [{ ...job, status: 'Resume ready' }, ...x.jobs] })); setJob(null); setRaw('') }}>Save job to {p.name}</button>
    </>}
    {p.jobs.length > 0 && <section style={{ marginTop: 16 }}><h2>Saved jobs for {p.name}</h2>
      {p.jobs.map(j => <div className="item" key={j.id}><div className="row"><span><strong>{j.f.title || 'Untitled'}</strong> <span className="mute">{j.f.company} · {new Date(j.created).toLocaleDateString()}</span></span>
        <button className="danger" style={{ marginLeft: 'auto' }} onClick={() => confirm('Delete this job?') && update(x => ({ ...x, jobs: x.jobs.filter(y => y.id !== j.id) }))}>Delete</button></div><ResumeActions p={p} f={j.f} init={j.doc} tpl0={j.tpl} onChange={(doc, tpl) => update(x => ({ ...x, jobs: x.jobs.map(y => y.id === j.id ? { ...y, doc, tpl } : y) }))} /></div>)}</section>}
  </>
}

function Field({ multi, value, onChange }: { multi:boolean; value:string; onChange:(e:{ target:{ value:string } }) => void }) {
  return multi ? <textarea rows={4} placeholder="One bullet point per line" value={value} onChange={onChange} /> : <input value={value} onChange={onChange} />
}
