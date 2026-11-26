import { useEffect, useState } from 'react'
import { get, set } from 'idb-keyval'
import { Profile, Job, Item } from './analyze'
import { Doc, buildResume, toHtml, printPdf, downloadDocx, TEMPLATES, tooLong } from './resume'
type Upd = (f:(p:Profile)=>Profile)=>void

export const PACKS: Record<string, string[]> = {
  'Linux administration': ['Linux','Bash','Shell scripting','Red Hat','Ubuntu','LVM','Cron','SELinux','Nginx','Apache','SSH','TCP/IP','DNS','DHCP','Troubleshooting'],
  'Desktop and IT support': ['Active Directory','Windows','Windows 10','MS Office','Outlook','Ticketing','Remote desktop','Hardware','Printers','LAN','Wi-Fi','IT support','User account management','ServiceNow'],
  'SOC analyst L1': ['SIEM','Splunk','Log analysis','Incident response','Wireshark','MITRE ATT&CK','EDR','Phishing analysis','Threat detection'],
  'VAPT and pentest': ['Vulnerability assessment','Penetration testing','VAPT','Burp Suite','Nmap','Metasploit','Nessus','OWASP','Android application testing','Kali Linux'],
  'Data analyst': ['SQL','Excel','Python','Power BI','Tableau','Data visualization','Statistics','ETL','MySQL'] }
export const STATUSES = ['Resume ready','Applied','Assessment','Interview','Offer','Rejected','On hold']

export function addSkills(p:Profile, names:string[], category:string): Profile {
  const have = new Set(p.skills.map(s => (s.name ?? '').toLowerCase())), add:string[] = []
  names.map(n => n.trim()).filter(Boolean).forEach(n => { if (!have.has(n.toLowerCase()) && !add.some(a => a.toLowerCase() === n.toLowerCase())) add.push(n) })
  return { ...p, skills: [...p.skills, ...add.map(name => ({ name, category }))] }
}

const EXTRA = ['Networking', 'Cloud', 'Programming', 'Soft skills', 'Other']
const split = (s:string) => s.split(/[,\n]/).map(x => x.trim()).filter(Boolean)

export function SkillAdder({ p, update }: { p:Profile; update:Upd }) {
  const [packs, setPacks] = useState<Record<string, string[]>>(PACKS), [ready, setReady] = useState(false)
  const [cat, setCat] = useState(''), [txt, setTxt] = useState(''), [sel, setSel] = useState<Record<string, string[]>>({}), [editing, setEditing] = useState(false)
  const [nr, setNr] = useState(''), [ns, setNs] = useState(''), [more, setMore] = useState<Record<string, string>>({})
  useEffect(() => { get('ri-packs').then(s => { if (s) setPacks(s); setReady(true) }) }, [])
  useEffect(() => { if (ready) set('ri-packs', packs) }, [packs, ready])
  const cats = [...Object.keys(packs), ...EXTRA.filter(c => !(c in packs))], category = cats.includes(cat) ? cat : cats[0]
  const own = new Set(p.skills.map(s => (s.name ?? '').toLowerCase())), used = [...new Set(p.skills.map(s => s.category || 'Other'))]
  return <section><h2>Skills</h2>
    <p className="mute">Quick add: pick a category, then type or paste skills separated by commas. Or tick skills you really have under a role below and add them together.</p>
    <div className="row"><select style={{ width: 200 }} aria-label="Category" value={category} onChange={e => setCat(e.target.value)}>{cats.map(c => <option key={c}>{c}</option>)}</select>
      <input style={{ flex: 1, minWidth: 220 }} value={txt} placeholder="Linux, Bash, Active Directory" onChange={e => setTxt(e.target.value)} />
      <button className="primary" onClick={() => { update(x => addSkills(x, split(txt), category)); setTxt('') }}>Add skills</button></div>
    <div className="row" style={{ marginTop: 10 }}><h2 style={{ margin: 0 }}>Roles and skill packs</h2><button onClick={() => setEditing(!editing)}>{editing ? 'Done editing roles' : 'Edit roles'}</button></div>
    {Object.entries(packs).map(([pk, list]) => { const chosen = sel[pk] ?? [], free = list.filter(s => !own.has(s.toLowerCase()))
      return <div className="item" key={pk}><div className="row"><strong>{pk}</strong>
        {free.length > 0 && <button onClick={() => setSel({ ...sel, [pk]: chosen.length === free.length ? [] : free })}>{chosen.length === free.length ? 'Clear' : 'Select all'}</button>}
        {chosen.length > 0 && <button className="primary" onClick={() => { update(x => addSkills(x, chosen, pk)); setSel({ ...sel, [pk]: [] }) }}>Add {chosen.length} selected to my profile</button>}
        {editing && <button className="danger" onClick={() => confirm(`Delete the role "${pk}"? Skills already in your profile stay.`) && setPacks(Object.fromEntries(Object.entries(packs).filter(([k]) => k !== pk)))}>Delete role</button>}</div>
        <div>{list.map(s => { const on = own.has(s.toLowerCase()), ch = chosen.includes(s)
          return editing ? <span className="tag" key={s}>{s} <button style={{ border: 0, padding: 0, background: 'none' }} aria-label={'Remove ' + s} onClick={() => setPacks({ ...packs, [pk]: list.filter(x => x !== s) })}>×</button></span>
            : <button key={s} disabled={on} aria-pressed={ch} className={'tag' + (on ? ' ok' : ch ? ' sel' : '')} onClick={() => setSel({ ...sel, [pk]: ch ? chosen.filter(x => x !== s) : [...chosen, s] })}>{on ? '✓ ' : ch ? '☑ ' : '☐ '}{s}</button> })}</div>
        {editing && <div className="row" style={{ marginTop: 4 }}><input style={{ flex: 1 }} placeholder="Add skills to this role, comma separated" value={more[pk] ?? ''} onChange={e => setMore({ ...more, [pk]: e.target.value })} />
          <button onClick={() => { setPacks({ ...packs, [pk]: [...list, ...split(more[pk] ?? '').filter(n => !list.some(x => x.toLowerCase() === n.toLowerCase()))] }); setMore({ ...more, [pk]: '' }) }}>Add to role</button></div>}</div> })}
    {editing && <div className="item"><strong>Create a new role</strong><div className="row" style={{ marginTop: 4 }}>
      <input style={{ width: 220 }} placeholder="Role name, e.g. Cloud engineer" value={nr} onChange={e => setNr(e.target.value)} />
      <input style={{ flex: 1, minWidth: 220 }} placeholder="Skills, comma separated" value={ns} onChange={e => setNs(e.target.value)} />
      <button className="primary" disabled={!nr.trim() || nr.trim() in packs} onClick={() => { setPacks({ ...packs, [nr.trim()]: split(ns) }); setNr(''); setNs('') }}>Add role</button>
      <button className="danger" onClick={() => confirm('Reset roles to the defaults?') && setPacks(PACKS)}>Reset roles</button></div></div>}
    <h2 style={{ marginTop: 14 }}>Your skills</h2>{p.skills.length === 0 && <p className="mute">Nothing added yet.</p>}
    {used.map(c => <div className="item" key={c}><strong>{c}</strong><div>{p.skills.filter(s => (s.category || 'Other') === c).map(s => <span className="tag" key={s.name}>{s.name} <button style={{ border: 0, padding: 0, background: 'none' }} aria-label={'Remove ' + s.name} onClick={() => update(x => ({ ...x, skills: x.skills.filter(y => y !== s) }))}>×</button></span>)}</div></div>)}</section>
}

export function ResumeActions({ p, f, init, tpl0, onChange }: { p:Profile; f:Job['f']; init?:Doc; tpl0?:string; onChange?:(d:Doc, t:string)=>void }) {
  const [d, setD] = useState<Doc | undefined>(init), [tpl, setTpl] = useState(tpl0 || 'classic'), [edit, setEdit] = useState(false)
  const [inclProj, setInclProj] = useState(p.level !== 'experienced'), [inclCert, setInclCert] = useState(true)
  const gen = (pr = inclProj, ce = inclCert) => put(buildResume(p, f, { projects: pr, certs: ce }))
  const put = (x:Doc, t = tpl) => { setD(x); onChange?.(x, t) }
  const mod = (fn:(c:Doc)=>void) => { if (!d) return; const c:Doc = JSON.parse(JSON.stringify(d)); fn(c); put(c) }
  const file = [p.personal.name || p.name, f.company || 'Company', f.title || 'Role'].join('_').replace(/\W+/g, '_')
  return <section><h2>Tailored resume</h2>
    <p className="mute">Built only from your master profile, with the most relevant skills, projects and experience first. Add real missing skills above to include them.</p>
    <div className="row"><button className="primary" onClick={() => gen()}>{d ? 'Regenerate from profile' : 'Generate resume'}</button>
      <label style={{ display: 'flex', gap: 4, alignItems: 'center' }}><input type="checkbox" style={{ width: 'auto' }} checked={inclProj} onChange={e => { setInclProj(e.target.checked); if (d && confirm('Rebuild the resume? Manual edits will be lost.')) gen(e.target.checked, inclCert) }} />Projects</label>
      <label style={{ display: 'flex', gap: 4, alignItems: 'center' }}><input type="checkbox" style={{ width: 'auto' }} checked={inclCert} onChange={e => { setInclCert(e.target.checked); if (d && confirm('Rebuild the resume? Manual edits will be lost.')) gen(inclProj, e.target.checked) }} />Certifications</label>
      {d && <><select style={{ width: 130 }} aria-label="Pages" value={d.pages ?? 1} onChange={e => mod(c => { c.pages = Number(e.target.value) })}><option value={1}>1 page</option><option value={2}>Up to 2 pages</option></select><select style={{ width: 200 }} aria-label="Template" value={tpl} onChange={e => { setTpl(e.target.value); put(d, e.target.value) }}>{Object.entries(TEMPLATES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
        <button onClick={() => setEdit(!edit)}>{edit ? 'Close editor' : 'Edit text'}</button>
        <button onClick={() => downloadDocx(d, file + '.docx', tpl)}>Download DOCX</button><button onClick={() => printPdf(d, tpl)}>Download PDF</button></>}</div>
    {d && <>{d.warnings.map(w => <p className="no tag" key={w}>{w}</p>)}{tooLong(d) && <p className="no tag">This is long for one page. Remove some lines in the editor.</p>}
      {edit && <div className="item"><div className="grid">{(['name', 'headline', 'contact'] as const).map(k => <label key={k}>{k}<input value={d[k]} onChange={e => mod(c => { c[k] = e.target.value })} /></label>)}</div>
        {d.sections.map((s, i) => <div className="item" key={i}><div className="row"><input style={{ flex: 1 }} value={s.title} onChange={e => mod(c => { c.sections[i].title = e.target.value })} aria-label="Section title" />
          <button className="danger" onClick={() => mod(c => { c.sections.splice(i, 1) })}>Remove section</button></div>
          {s.lines.map((l, j) => <div className="item" key={j}><div className="grid">{(['b', 'r', 't', 's', 'e'] as const).map(k => <label key={k}>{({ b: 'Title (bold)', r: 'Right side (dates, link)', t: 'Second line', s: 'Second line, right', e: 'Tools and environment' })[k]}<input value={l[k] ?? ''} onChange={e => mod(c => { c.sections[i].lines[j][k] = e.target.value })} /></label>)}</div>
            <label>Bullet points (one per line)<textarea rows={4} value={l.d ?? ''} onChange={e => mod(c => { c.sections[i].lines[j].d = e.target.value })} /></label>
            <button className="danger" style={{ marginTop: 4 }} onClick={() => mod(c => { c.sections[i].lines.splice(j, 1) })}>Remove line</button></div>)}
          <button style={{ marginTop: 4 }} onClick={() => mod(c => { c.sections[i].lines.push({ b: '' }) })}>Add line</button></div>)}</div>}
      <iframe title="Resume preview" srcDoc={toHtml(d, tpl)} style={{ width: '100%', height: 640, border: '1px solid var(--line)', marginTop: 10, background: '#fff' }} />
      <p className="mute">PDF: in the print window choose "Save as PDF" and set margins to None.</p></>}</section>
}

export function Tracker({ p, update }: { p:Profile; update:Upd }) {
  const [flt, setFlt] = useState('All')
  const upd = (id:string, patch:Partial<Job>) => update(x => ({ ...x, jobs: x.jobs.map(j => j.id === id ? { ...j, ...patch } : j) }))
  const jobs = p.jobs.filter(j => flt === 'All' || (j.status ?? 'Resume ready') === flt)
  return <section><h2>Applications for {p.name} ({p.jobs.length})</h2>
    <div className="row">{['All', ...STATUSES].map(s => <button key={s} className={flt === s ? 'primary' : ''} onClick={() => setFlt(s)}>{s} {s === 'All' ? p.jobs.length : p.jobs.filter(j => (j.status ?? 'Resume ready') === s).length}</button>)}</div>
    {jobs.length === 0 && <p className="mute">Nothing here yet. Analyze a job and save it to track it.</p>}
    {jobs.map(j => <div className="item" key={j.id}><strong>{j.f.title || 'Untitled'}</strong> <span className="mute">{j.f.company} · {j.f.location} · created {new Date(j.created).toLocaleDateString()} · template {j.tpl ?? 'none yet'}</span>
      <div className="grid" style={{ marginTop: 6 }}>
        <label>Status<select value={j.status ?? 'Resume ready'} onChange={e => upd(j.id, { status: e.target.value, applied: e.target.value === 'Applied' && !j.applied ? new Date().toISOString().slice(0, 10) : j.applied })}>{STATUSES.map(s => <option key={s}>{s}</option>)}</select></label>
        <label>Date applied<input type="date" value={j.applied ?? ''} onChange={e => upd(j.id, { applied: e.target.value })} /></label>
        <label>Notes<input value={j.notes ?? ''} placeholder="Recruiter, interview date, portal" onChange={e => upd(j.id, { notes: e.target.value })} /></label></div>
      <button className="danger" style={{ marginTop: 6 }} onClick={() => confirm('Delete this application?') && update(x => ({ ...x, jobs: x.jobs.filter(y => y.id !== j.id) }))}>Delete</button></div>)}</section>
}
export type { Item }
