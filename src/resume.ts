import { Document, Packer, Paragraph, TextRun, BorderStyle, AlignmentType, ExternalHyperlink, TabStopType } from 'docx'
import { Profile, Fields, Item, match } from './analyze'

// b = bold title, r = right-aligned (dates, links), t = second line, s = second line right-aligned, d = description paragraph
export type Line = { b?: string; r?: string; t?: string; s?: string; d?: string; e?: string }
export type Doc = { name:string; headline:string; contact:string; summary:string; sections:{ title:string; lines:Line[] }[]; warnings:string[]; pages?:number }
const esc = (s:string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const join = (a:(string | undefined)[], s:string) => a.filter(Boolean).join(s)

// Selects and orders ONLY what exists in the profile. Nothing is invented or reworded.
export function buildResume(p:Profile, f:Fields, o:{ projects?:boolean; certs?:boolean; pages?:number } = {}): Doc {
  const m = match(p, f), pe = p.personal, warnings:string[] = [], exp = p.level === 'experienced'
  const wanted = [...f.required.split(','), ...f.preferred.split(',')].map(s => s.trim().toLowerCase()).filter(Boolean)
  const want = new Set([...m.matched, ...m.partial])
  const score = (o:unknown) => wanted.filter(s => JSON.stringify(o).toLowerCase().includes(s)).length
  const skills = p.skills.filter(s => s.name).sort((a, b) => +want.has(b.name.toLowerCase()) - +want.has(a.name.toLowerCase()))
  const groups = new Map<string, string[]>()
  skills.forEach(s => { const c = s.category || 'Skills'; groups.set(c, [...(groups.get(c) ?? []), s.name]) })
  const sections:Doc['sections'] = []
  if (pe.summary) sections.push({ title: 'Professional Summary', lines: [{ t: pe.summary }] })
  if (groups.size) sections.push({ title: exp ? 'Technical Skills' : 'Skills', lines: [...groups].map(([c, v]) => ({ b: c + ':', t: v.join(', ') })) })
  const projOn = o.projects ?? !exp, certOn = o.certs ?? true
  const proj = projOn ? m.projects.slice(0, 3).map(x => x.pr) : []
  const pSec = proj.length ? { title: 'Projects', lines: proj.map(x => ({ b: x.name, r: x.tech, t: x.url, d: x.desc })) } : null
  if (projOn && !proj.length) warnings.push('No project in your profile matches this job, so none were included.')
  const bl = (x:Item) => [x.desc, x.achievements].filter(Boolean).join('\n')
  const jobs = exp ? [...p.experience] : [...p.experience].sort((a, b) => score(b) - score(a))
  const eSec = jobs.length ? { title: exp ? 'Professional Experience' : 'Internship and Experience', lines: jobs.map(x => exp
    ? { b: x.role || x.org, r: x.period, t: x.role ? join([x.org, x.location], ', ') : x.location, d: bl(x), e: x.env }
    : { b: join([x.role, x.org], ' | '), r: x.period, d: bl(x), e: x.env }) } : null
  const edSec = p.education.length ? { title: 'Education', lines: p.education.map(x => ({ b: x.qualification || x.institution, r: x.period, t: x.qualification ? x.institution : '', s: x.score ? (/[a-z]/i.test(x.score) ? x.score : 'Score: ' + x.score) : '' })) } : null
  const certs = [...p.certs].sort((a, b) => score(b) - score(a))
  const cSec = certOn && certs.length ? { title: 'Certifications', lines: certs.map(x => ({ b: x.name, t: join([x.issuer, x.date], ' | ') })) } : null
  sections.push(...([...(exp ? [eSec, edSec, cSec, pSec] : [pSec, eSec, edSec, cSec])].filter(Boolean) as Doc['sections']))
  if (!pe.name) warnings.push('Add your name in Master profile.')
  if (m.missing.length) warnings.push('Not claimed because they are not in your profile: ' + m.missing.join(', '))
  const yrs = parseFloat(pe.years ?? '')
  return { pages: o.pages ?? (exp && yrs >= 10 ? 2 : 1), name: pe.name ?? '', headline: exp && pe.years ? join([f.title || pe.headline, pe.years + '+ years experience'], ' | ') : f.title || pe.headline || '', contact: join([pe.email, pe.phone, pe.location, pe.linkedin, pe.github], ' | '), summary: pe.summary ?? '', sections, warnings }
}

export type Part = { t:string; href?:string }
const URL_RE = /(https?:\/\/[^\s|,]+|(?:www\.|linkedin\.com\/|github\.com\/)[^\s|,]+|[\w.+-]+@[\w-]+\.[\w.]+)/g
export function linkParts(s:string): Part[] {
  const out:Part[] = []; let i = 0
  for (const m of s.matchAll(URL_RE)) {
    const v = m[0], at = m.index ?? 0, mail = v.includes('@') && !/^https?:/.test(v)
    if (at > i) out.push({ t: s.slice(i, at) })
    const path = v.replace(/^https?:\/\/(www\.)?/, '').split('/').filter(Boolean)
    const label = mail ? v : /linkedin\.com/i.test(v) ? 'LinkedIn' : /github\.com/i.test(v) ? (path.length > 2 ? 'GitHub repo' : 'GitHub') : path.join('/')
    out.push({ t: label, href: mail ? 'mailto:' + v : /^https?:/.test(v) ? v : 'https://' + v }); i = at + v.length
  }
  if (i < s.length) out.push({ t: s.slice(i) })
  return out
}

export const bullets = (d:string) => { const a = d.split(/\n+/).map(x => x.replace(/^\s*[•\-*]\s*/, '').trim()).filter(Boolean); return a.length === 1 ? a[0].split(/(?<=[.!?])\s+(?=[A-Z])/).filter(Boolean) : a }
const len = (l:Line) => [l.b, l.r, l.t, l.s, l.d, l.e].reduce((a, x) => a + (x?.length ?? 0), 40)
const size = (d:Doc) => { const n = d.sections.reduce((a, s) => a + s.lines.reduce((b, l) => b + len(l), 0), 0); return { n, pt: n < 1500 ? 11 : n < 2200 ? 10.5 : 10, gap: n < 1500 ? 14 : n < 2200 ? 11 : 8, sk: n < 1500 ? 80 : 40 } }
export const tooLong = (d:Doc) => d.pages !== 2 && size(d).n > 3200

const lp = (s:string) => linkParts(s).map(p => p.href ? `<a href="${esc(p.href)}">${esc(p.t)}</a>` : esc(p.t)).join('')
const row = (l:string, r:string) => `<div class="r"><span>${l}</span><span class="rt">${r}</span></div>`
const block = (l:Line) => !!(l.r || l.s || l.d || l.e)
const skill = (l:Line) => !!l.b && l.b.endsWith(':') && !!l.t && !block(l)
const lineHtml = (l:Line) => skill(l) ? `<div class="sk"><b>${lp(l.b!)}</b><span>${lp(l.t!)}</span></div>` : block(l)
  ? `<div class="e">${l.b || l.r ? row(`<b>${lp(l.b ?? '')}</b>`, lp(l.r ?? '')) : ''}${l.t || l.s ? row(lp(l.t ?? ''), `<b>${lp(l.s ?? '')}</b>`) : ''}${l.d ? `<ul>${bullets(l.d).map(x => `<li>${lp(x)}</li>`).join('')}</ul>` : ''}${l.e ? `<p class="env"><b>Environment:</b> ${lp(l.e)}</p>` : ''}</div>`
  : `<p>${l.b ? `<b>${lp(l.b)}</b> ` : ''}${lp(l.t ?? '')}</p>`

export const TEMPLATES: Record<string, { label:string; accent:string; caps:boolean }> = {
  classic: { label: 'Classic ATS (black)', accent: '#000000', caps: false },
  modern: { label: 'Modern (blue accent)', accent: '#0f4c81', caps: false },
  executive: { label: 'Executive (grey, capitals)', accent: '#333333', caps: true } }

// The script scales font size (10-11.5pt) and spacing so the content fills one A4 page.
const FIT = `(function(){var s=document.documentElement.style,P=document.querySelector('.page'),B=document.querySelector('.in');function ok(){return B.getBoundingClientRect().height<=297*3.7795-2*parseFloat(getComputedStyle(P).paddingTop)}
var pt=11.5;for(;pt>10;pt-=.25){document.body.style.fontSize=pt+'pt';if(ok())break}document.body.style.fontSize=pt+'pt';
function grow(v,f,t,st,u){var p=f,x;for(x=f;x<=t;x+=st){s.setProperty(v,x+u);if(!ok()){s.setProperty(v,p+u);return}p=x}}
if(ok()){grow('--lh',1.3,1.6,.01,'');grow('--sk',2,16,1,'px');grow('--li',1,8,1,'px');grow('--gap',8,40,1,'px')}
else{s.setProperty('--lh','1.2');s.setProperty('--gap','6px');s.setProperty('--sk','1px');s.setProperty('--li','0px');if(!ok())P.style.padding='10mm 13mm'}})()`

export const toHtml = (d:Doc, tpl = 'classic') => { const t = TEMPLATES[tpl] ?? TEMPLATES.classic, two = d.pages === 2; return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(d.name || 'Resume')}</title><style>
@page{size:A4;margin:${two ? '13mm 15mm' : '0'}}body{margin:0;background:#fff;color:#000;font-family:Calibri,Carlito,Arial,sans-serif;font-size:10.5pt;line-height:var(--lh,1.3)}
.page{${two ? 'max-width:180mm;margin:0 auto' : 'width:210mm;min-height:297mm;box-sizing:border-box;padding:13mm 15mm'}}${two ? '@media screen{body{padding:13mm 15mm}}' : ''}.env{margin:3px 0 0}.e,li{break-inside:avoid}.top{text-align:center}
h1{font-size:24pt;margin:0;color:${t.accent}}.hl{font-size:12.5pt}.c{font-size:10pt;margin-bottom:2px}a{color:#0b57a4;text-decoration:none}
h2{font-size:11.5pt;margin:var(--gap,10px) 0 4px;padding-bottom:1px;color:${t.accent};border-bottom:1.5px solid ${t.accent};letter-spacing:.3px;${t.caps ? 'text-transform:uppercase;' : ''}}
p{margin:0 0 4px}.e{margin-bottom:var(--sk,4px)}ul{margin:1px 0 0;padding-left:5mm}li{margin:0 0 var(--li,1px)}
.r{display:flex;justify-content:space-between;gap:14px}.r span:first-child{flex:1}.rt{text-align:right;white-space:nowrap}
.sk{display:grid;grid-template-columns:44mm 1fr;column-gap:3mm;margin-bottom:var(--sk,2px)}</style></head><body><div class="page"><div class="in">
<div class="top"><h1>${esc(d.name)}</h1><div class="hl">${esc(d.headline)}</div><div class="c">${lp(d.contact)}</div></div>
${d.sections.map(s => `<h2>${esc(s.title)}</h2>${s.lines.map(lineHtml).join('')}`).join('')}
</div></div>${two ? '' : `<script>${FIT}</script>`}</body></html>` }

export function printPdf(d:Doc, tpl = 'classic') {
  const w = window.open('', '_blank'); if (!w) { alert('Allow pop-ups for this site, then try again.'); return }
  w.document.write(toHtml(d, tpl)); w.document.close(); w.focus(); setTimeout(() => w.print(), 500)
}

export async function downloadDocx(d:Doc, file:string, tpl = 'classic') {
  const t = TEMPLATES[tpl] ?? TEMPLATES.classic, z = d.pages === 2 ? { n: 0, pt: 10.5, gap: 11, sk: 50 } : size(d), col = t.accent.slice(1), W = 10206, SK = 2500, C = AlignmentType.CENTER
  const R = (text:string, o:{ b?:boolean; i?:boolean; sz?:number; color?:string } = {}) => new TextRun({ text, font: 'Calibri', size: o.sz ?? z.pt * 2, bold: o.b, italics: o.i, color: o.color ?? '000000' })
  const runs = (s:string, o:{ b?:boolean; i?:boolean; sz?:number } = {}) => linkParts(s).map(p => p.href ? new ExternalHyperlink({ link: p.href, children: [R(p.t, { ...o, color: '0B57A4' })] }) : R(p.t, o))
  const row = (l:(TextRun | ExternalHyperlink)[], r:(TextRun | ExternalHyperlink)[], after:number) => new Paragraph({ tabStops: [{ type: TabStopType.RIGHT, position: W }], spacing: { after }, children: [...l, R('\t'), ...r] })
  const kids:Paragraph[] = [new Paragraph({ alignment: C, children: [R(d.name, { b: true, sz: 48, color: col })] }), new Paragraph({ alignment: C, children: [R(d.headline, { sz: 25 })] }), new Paragraph({ alignment: C, spacing: { after: 60 }, children: runs(d.contact, { sz: 20 }) })]
  for (const s of d.sections) {
    kids.push(new Paragraph({ children: [R(t.caps ? s.title.toUpperCase() : s.title, { b: true, sz: 23, color: col })], spacing: { before: z.gap * 12, after: 50 }, border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: col, space: 1 } } }))
    for (const l of s.lines) {
      if (skill(l)) kids.push(new Paragraph({ tabStops: [{ type: TabStopType.LEFT, position: SK }], indent: { left: SK, hanging: SK }, spacing: { after: z.sk }, children: [...runs(l.b!, { b: true }), R('\t'), ...runs(l.t!)] }))
      else if (block(l)) {
        if (l.b || l.r) kids.push(row(runs(l.b ?? '', { b: true }), runs(l.r ?? ''), l.t || l.s || l.d ? 10 : 70))
        if (l.t || l.s) kids.push(row(runs(l.t ?? ''), runs(l.s ?? '', { b: true }), l.d ? 10 : 70))
        if (l.d) bullets(l.d).forEach((x, i, a) => kids.push(new Paragraph({ bullet: { level: 0 }, spacing: { after: i === a.length - 1 && !l.e ? 80 : 20 }, children: runs(x) })))
        if (l.e) kids.push(new Paragraph({ spacing: { before: 20, after: 80 }, children: [R('Environment: ', { b: true }), ...runs(l.e)] }))
      } else kids.push(new Paragraph({ spacing: { after: 50 }, children: [...(l.b ? runs(l.b + ' ', { b: true }) : []), ...runs(l.t ?? '')] }))
    }
  }
  const blob = await Packer.toBlob(new Document({ sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 740, bottom: 740, left: 850, right: 850 } } }, children: kids }] }))
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = file; a.click()
}
