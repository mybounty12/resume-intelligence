import { useEffect, useState } from 'react'
import { get, set } from 'idb-keyval'

type Dork = { id:string; name:string; q:string }
const uid = () => Math.random().toString(36).slice(2, 9)
const mk = (name:string, q:string): Dork => ({ id: uid(), name, q })
const DEFAULTS = (): Dork[] => [
  mk('Workday portals', 'site:myworkdayjobs.com "{role}" {location}'),
  mk('Greenhouse', '(site:boards.greenhouse.io OR site:job-boards.greenhouse.io) "{role}" {location}'),
  mk('Lever', 'site:jobs.lever.co "{role}" {location}'),
  mk('SmartRecruiters', 'site:jobs.smartrecruiters.com "{role}" {location}'),
  mk('iCIMS', 'site:icims.com "{role}" {location}'),
  mk('Oracle Cloud careers', 'site:oraclecloud.com inurl:CandidateExperience "{role}" {location}'),
  mk('Ashby', 'site:jobs.ashbyhq.com "{role}" {location}'),
  mk('Company career pages', '(inurl:careers OR inurl:career OR inurl:jobs) intitle:"{role}" {location} {exclude}'),
  mk('Freshers and entry level', '"{role}" ("entry level" OR fresher OR "0-2 years") (inurl:careers OR inurl:jobs) {location} {exclude}'),
  mk('Walk-in and hiring drives', '"{role}" ("walk-in" OR "hiring drive") inurl:careers {location} {exclude}') ]
const EXCL = 'naukri.com, linkedin.com, glassdoor.com, indeed.com, monster.com, foundit.in, shine.com, timesjobs.com, internshala.com, ziprecruiter.com'
const ROLES = ['Linux Administrator','System Administrator','Desktop Support Engineer','IT Support Engineer','Technical Support Engineer','SOC Analyst','VAPT Engineer','Data Analyst']
const TIMES: Record<string,string> = { 'Any time': '', 'Past 24 hours': 'qdr:d', 'Past week': 'qdr:w', 'Past month': 'qdr:m' }

export function JobSearch() {
  const [dorks, setDorks] = useState<Dork[]>(DEFAULTS()), [excl, setExcl] = useState(EXCL), [ready, setReady] = useState(false)
  const [role, setRole] = useState('Linux Administrator'), [loc, setLoc] = useState('India'), [time, setTime] = useState('Any time'), [editing, setEditing] = useState('')
  useEffect(() => { get('ri-dorks').then(s => { if (s) { setDorks(s.dorks); setExcl(s.excl) } setReady(true) }) }, [])
  useEffect(() => { if (ready) set('ri-dorks', { dorks, excl }) }, [dorks, excl, ready])
  const ex = excl.split(',').map(s => s.trim()).filter(Boolean).map(s => '-site:' + s).join(' ')
  const build = (q:string) => q.split('{role}').join(role).split('{location}').join(loc).split('{exclude}').join(ex).replace(/\s+/g, ' ').trim()
  const url = (q:string) => 'https://www.google.com/search?q=' + encodeURIComponent(q) + (TIMES[time] ? '&tbs=' + TIMES[time] : '')
  const edit = (id:string, patch:Partial<Dork>) => setDorks(ds => ds.map(d => d.id === id ? { ...d, ...patch } : d))
  return <>
    <section><h2>Find direct job links on Google</h2>
      <p className="mute">Each search below targets company career sites and applicant tracking systems (Workday, Greenhouse, Lever and others) and removes job boards such as Naukri and LinkedIn.</p>
      <div className="grid"><label>Job role<input value={role} onChange={e => setRole(e.target.value)} /></label>
        <label>Location<input value={loc} placeholder="Hyderabad" onChange={e => setLoc(e.target.value)} /></label>
        <label>Posted<select value={time} onChange={e => setTime(e.target.value)}>{Object.keys(TIMES).map(t => <option key={t}>{t}</option>)}</select></label></div>
      <div style={{ marginTop: 8 }}>{ROLES.map(r => <button key={r} className={'tag' + (r === role ? ' ok' : '')} onClick={() => setRole(r)}>{r}</button>)}</div></section>
    <section><h2>Excluded sites</h2><p className="mute">Comma separated. They are added to searches as -site: filters wherever a search uses {'{exclude}'}. Google ignores queries beyond about 32 words, so keep this list short.</p>
      <textarea rows={2} value={excl} onChange={e => setExcl(e.target.value)} /></section>
    <section><h2>Searches ({dorks.length})</h2>
      {dorks.map(d => { const q = build(d.q), words = q.split(/\s+/).length
        return <div className="item" key={d.id}><div className="row"><strong>{d.name}</strong>
          {words > 32 && <span className="tag no">{words} words, Google may ignore the end</span>}
          <span style={{ marginLeft: 'auto' }} className="row">
            <a href={url(q)} target="_blank" rel="noopener noreferrer"><button className="primary">Open in Google</button></a>
            <button onClick={() => navigator.clipboard.writeText(q)}>Copy</button>
            <button onClick={() => setEditing(editing === d.id ? '' : d.id)}>{editing === d.id ? 'Done' : 'Edit'}</button>
            <button className="danger" onClick={() => confirm(`Delete "${d.name}"?`) && setDorks(ds => ds.filter(x => x.id !== d.id))}>Delete</button></span></div>
          <div className="mute" style={{ wordBreak: 'break-word' }}>{q}</div>
          {editing === d.id && <div className="grid" style={{ marginTop: 6 }}><label>Name<input value={d.name} onChange={e => edit(d.id, { name: e.target.value })} /></label>
            <label>Search (use {'{role}'}, {'{location}'}, {'{exclude}'})<textarea rows={3} value={d.q} onChange={e => edit(d.id, { q: e.target.value })} /></label></div>}</div> })}
      <div className="row" style={{ marginTop: 8 }}><button onClick={() => { const d = mk('My search', 'site:example.com "{role}" {location}'); setDorks([...dorks, d]); setEditing(d.id) }}>Add a search</button>
        <button className="danger" onClick={() => confirm('Reset all searches and excluded sites to the defaults?') && (setDorks(DEFAULTS()), setExcl(EXCL))}>Reset to defaults</button></div>
      <p className="mute">The app opens Google in a new tab. Browsers do not let a web page read Google results, so results are not listed here. If Google asks you to verify you are human, complete it once.</p></section>
  </>
}
