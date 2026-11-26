import { test, expect } from 'vitest'
import { clean, extract, match, Profile } from './analyze'
const page = `Home\nSign in\nJob Title: Linux Administrator\nCompany: Acme Corp\nLocation: Pune, India\nJob ID: REQ-42\nFull-time Hybrid\n3+ years experience\nRequired: Linux, Bash, Docker, Kubernetes\nPreferred: Ansible\nLinux, Bash, Docker, Kubernetes\n© 2026 Acme`
test('cleans noise and duplicates', () => { const c = clean(page); expect(c).not.toMatch(/Sign in|©/); expect(c.split('\n').filter(l => l === 'Linux, Bash, Docker, Kubernetes').length).toBe(1) })
test('extracts fields', () => { const f = extract(page); expect(f.company).toBe('Acme Corp'); expect(f.jobId).toBe('REQ-42'); expect(f.required).toContain('kubernetes'); expect(f.preferred).toBe('ansible') })
test('never claims missing skills', () => {
  const p = { skills:[{name:'Linux'},{name:'Bash'}], projects:[{name:'Docker lab',desc:'docker on linux',tech:'Docker'}], experience:[], education:[], certs:[], jobs:[] } as unknown as Profile
  const m = match(p, extract(page)); expect(m.matched).toEqual(['linux','bash']); expect(m.partial).toContain('docker'); expect(m.missing).toContain('kubernetes')
})

import { buildResume } from './resume'
test('resume only contains profile skills', () => {
  const p = { personal:{name:'A'}, skills:[{name:'Linux',category:'OS'}], projects:[], experience:[], education:[], certs:[], jobs:[] } as unknown as Profile
  const d = buildResume(p, extract(page)); const txt = JSON.stringify(d.sections)
  expect(txt).toContain('Linux'); expect(txt).not.toMatch(/Kubernetes|Docker/); expect(d.warnings.join()).toContain('kubernetes')
})
test('naukri style fields', () => {
  const f = extract('Walk-in || Desktop Support Engineer\nElancer It Solutions\nJob Title: Desktop Support Engineer\nWork Mode: Work From Office\nProvide remote and onsite support. Windows, Active Directory')
  expect(f.company).toBe('Elancer It Solutions'); expect(f.arrangement).toBe('Work From Office')
})

import { linkParts } from './resume'
test('links are shortened and clickable', () => {
  const p = linkParts('a@b.com | linkedin.com/in/me | https://github.com/me/repo | Hyderabad')
  expect(p.filter(x => x.href).map(x => x.t + '>' + x.href)).toEqual(['a@b.com>mailto:a@b.com', 'LinkedIn>https://linkedin.com/in/me', 'GitHub repo>https://github.com/me/repo'])
})
test('education builds aligned rows', () => {
  const pr = { personal:{name:'A'}, skills:[], projects:[], experience:[], education:[{qualification:'B.Tech CSE',institution:'Very Long Institute of Technology',period:'2021 - 2025',score:'8.2 CGPA'}], certs:[], jobs:[] } as unknown as Profile
  const e = buildResume(pr, extract(page)).sections.find(s => s.title === 'Education')!.lines[0]
  expect(e).toMatchObject({ b: 'B.Tech CSE', r: '2021 - 2025', t: 'Very Long Institute of Technology', s: '8.2 CGPA' })
})

import { bullets } from './resume'
test('descriptions become bullets', () => {
  expect(bullets('Built a tracker.\nAutomated routing.')).toEqual(['Built a tracker.', 'Automated routing.'])
  expect(bullets('Built a tracker. Automated routing with Power Automate.')).toHaveLength(2)
})

test('experienced layout: experience first, projects off by default, achievements and environment kept', () => {
  const pr = { level: 'experienced', personal: { name: 'A', years: '6' }, skills: [{ name: 'Linux', category: 'OS' }], projects: [{ name: 'Lab', desc: 'linux lab' }],
    experience: [{ org: 'Acme', role: 'Linux Admin', location: 'Pune', period: '01/2020 - Present', desc: 'Patched servers.', achievements: 'Cut downtime 20%.', env: 'RHEL, Ansible' }],
    education: [{ qualification: 'B.Tech', institution: 'X', period: '2012 - 2016' }], certs: [{ name: 'RHCSA' }], jobs: [] } as unknown as Profile
  const d = buildResume(pr, extract(page))
  expect(d.sections.map(s => s.title)).toEqual(['Technical Skills', 'Professional Experience', 'Education', 'Certifications'])
  expect(d.sections[1].lines[0]).toMatchObject({ b: 'Linux Admin', r: '01/2020 - Present', t: 'Acme, Pune', e: 'RHEL, Ansible' })
  expect(d.sections[1].lines[0].d).toContain('Cut downtime 20%.'); expect(d.headline).toContain('6+ years')
  expect(buildResume(pr, extract(page), { projects: true }).sections.map(s => s.title)).toContain('Projects')
})
