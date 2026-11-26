export type Item = Record<string, string>
export type Fields = { company:string; title:string; jobId:string; location:string; type:string; arrangement:string; experience:string; education:string; required:string; preferred:string }
export type Profile = { id:string; name:string; level?:'fresher'|'experienced'; personal:Item; skills:Item[]; projects:Item[]; experience:Item[]; education:Item[]; certs:Item[]; jobs:Job[] }
import type { Doc } from './resume'
export type Job = { id:string; created:string; raw:string; cleaned:string; f:Fields; status?:string; applied?:string; notes?:string; tpl?:string; doc?:Doc }

export const SKILLS = ['linux','bash','shell scripting','python','sql','mysql','postgresql','oracle','power bi','excel','tableau','windows server','active directory','vmware','docker','kubernetes','aws','azure','gcp','splunk','siem','qradar','wireshark','nmap','burp suite','metasploit','nessus','owasp','iso 27001','nist','soc 2','pci dss','tcp/ip','dns','dhcp','firewall','vpn','ansible','terraform','git','jenkins','itil','servicenow','jira','incident response','log analysis','vulnerability assessment','penetration testing','vapt','networking','cisco','powershell','office 365','troubleshooting','ccna','security+','ceh','oscp','grc','risk assessment','compliance','etl','data visualization','statistics','java','javascript','nginx','apache','red hat','ubuntu','selinux','cron','lvm','nagios','zabbix','prometheus','grafana','elk','crowdstrike','edr','mitre att&ck','windows','windows 10','ms office','outlook','ticketing','hardware','lan','wi-fi','it support','helpdesk','desktop support','user account management','remote desktop','printers']

const esc = (s:string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
export const has = (text:string, term:string) => new RegExp(`(^|[^a-z0-9+#])${esc(term.toLowerCase())}([^a-z0-9+#]|$)`).test(text.toLowerCase())
export const findSkills = (t:string) => SKILLS.filter(s => has(t, s))

const NOISE = /^(home|menu|search|sign in|log ?in|register|share|apply( now)?|save job|back to|cookie|privacy|terms|©|copyright|follow us|subscribe|all rights|accessibility|careers?|about us|contact us|skip to|equal opportunity|we are an equal)/i

export function clean(raw:string): string {
  const seen = new Set<string>(), out:string[] = []
  for (const l of raw.split(/\r?\n/).map(x => x.trim())) {
    if (l.length < 3 || NOISE.test(l) || /^https?:\/\/\S+$/.test(l)) continue
    const k = l.toLowerCase(); if (seen.has(k)) continue
    seen.add(k); out.push(l)
  }
  return out.join('\n')
}

const g = (t:string, re:RegExp, i = 1) => (t.match(re)?.[i] ?? '').trim()

export function extract(raw:string): Fields {
  const t = clean(raw), lines = t.split('\n')
  const roleRe = /(administrator|engineer|analyst|developer|specialist|tester|support|architect|consultant)/i
  const title = g(t, /(?:job title|position|role)\s*[:\-]\s*(.+)/i) || lines.find(l => roleRe.test(l) && l.length < 90) || ''
  const ti = lines.findIndex(l => l.toLowerCase().includes(title.toLowerCase()) && title)
  const company = g(t, /(?:company|employer|organi[sz]ation)\s*[:\-]\s*(.+)/i) || g(title, /\bat\s+([A-Z][\w&.\- ]{1,40})$/) || (ti >= 0 && lines[ti + 1] && lines[ti + 1].length < 60 ? lines[ti + 1] : '')
  const idx = lines.findIndex(l => /(preferred|nice to have|good to have|desirable|bonus)/i.test(l))
  const reqText = idx > 0 ? lines.slice(0, idx).join('\n') : t
  const prefText = idx > 0 ? lines.slice(idx).join('\n') : ''
  const required = findSkills(reqText), preferred = findSkills(prefText).filter(s => !required.includes(s))
  return {
    company, title, location: g(t, /(?:location|city)\s*[:\-]\s*(.+)/i),
    jobId: g(t, /(?:job id|requisition(?: id)?|req id|reference(?: no)?)\s*[:#\-]\s*([\w\-]+)/i),
    type: g(t, /(full[- ]time|part[- ]time|contract|intern(?:ship)?|permanent)/i, 1),
    arrangement: g(t, /work (?:mode|arrangement|type)\s*[:\-]\s*(.+)/i) || (/work from (?:office|the office)|on-?site only/i.test(t) ? 'Onsite' : /hybrid/i.test(t) ? 'Hybrid' : /(fully|100%) remote|work from home|remote position/i.test(t) ? 'Remote' : ''),
    experience: g(t, /(\d+\s*(?:\+|-\s*\d+)?\s*(?:years?|yrs))/i),
    education: lines.find(l => /(bachelor|b\.?tech|degree|master|diploma)/i.test(l)) ?? '',
    required: required.join(', '), preferred: preferred.join(', '),
  }
}

const list = (s:string) => s.split(',').map(x => x.trim().toLowerCase()).filter(Boolean)
const blob = (o:unknown) => JSON.stringify(o).toLowerCase()
const pct = (a:number, b:number) => b ? Math.round(100 * a / b) : 0

export function match(p:Profile, f:Fields) {
  const req = list(f.required), pref = list(f.preferred), all = [...req, ...pref]
  const own = new Set(p.skills.map(s => (s.name ?? '').toLowerCase().trim()))
  const text = blob([p.projects, p.experience, p.certs, p.education])
  const matched = all.filter(s => own.has(s))
  const partial = all.filter(s => !own.has(s) && has(text, s))
  const missing = all.filter(s => !own.has(s) && !partial.includes(s))
  const projects = p.projects.map(pr => ({ pr, hits: all.filter(s => has(blob(pr), s)) })).filter(x => x.hits.length).sort((a, b) => b.hits.length - a.hits.length)
  const covered = new Set(projects.flatMap(x => x.hits))
  const expHits = all.filter(s => has(blob(p.experience), s))
  const scores = {
    skills: pct(matched.length + partial.length / 2, all.length),
    projects: pct(req.filter(s => covered.has(s)).length || covered.size, req.length || all.length),
    experience: pct(expHits.length, all.length),
    keywords: pct(all.filter(s => own.has(s) || has(text, s)).length, all.length),
  }
  const overall = Math.round(scores.skills * .4 + scores.projects * .2 + scores.experience * .2 + scores.keywords * .2)
  return { matched, partial, missing, projects, scores, overall }
}
