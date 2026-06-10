// Greek Ledger — RLS permission enforcement test (run against live DB)
//   SUPABASE creds read from .env. Usage: node scripts/tests/permissions.test.mjs
//   Connection: close header is REQUIRED — Node keep-alive reuses a pooled
//   connection where the JWT context goes stale, causing false 403s.
import { readFileSync } from 'node:fs'
const env = Object.fromEntries(readFileSync('.env','utf8').split('\n').map(l=>l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)).filter(Boolean).map(m=>[m[1],m[2].replace(/^["']|["']$/g,'')]))
const URL = env.VITE_SUPABASE_URL, KEY = env.VITE_SUPABASE_ANON_KEY
let P=0,F=0; const ok=(c,m)=>{if(c){P++;console.log('  ✅',m)}else{F++;console.log('  ❌',m)}}
async function signup(e){const r=await fetch(`${URL}/auth/v1/signup`,{method:'POST',headers:{apikey:KEY,'Content-Type':'application/json'},body:JSON.stringify({email:e,password:'password123'})});const j=await r.json();return{token:j.access_token,uid:j.user?.id}}
const H=t=>({apikey:KEY,Authorization:`Bearer ${t}`,'Content-Type':'application/json',Connection:'close'})
const POST=async(t,tok,row,p='return=representation')=>{const r=await fetch(`${URL}/rest/v1/${t}`,{method:'POST',headers:{...H(tok),Prefer:p},body:JSON.stringify(row)});const b=await r.text();return{ok:r.ok,status:r.status,data:b?JSON.parse(b):null}}
const PATCH=async(t,tok,q,row)=>{const r=await fetch(`${URL}/rest/v1/${t}?${q}`,{method:'PATCH',headers:{...H(tok),Prefer:'return=representation'},body:JSON.stringify(row)});return{ok:r.ok,status:r.status}}
const SEL=async(t,tok,q)=>{const r=await fetch(`${URL}/rest/v1/${t}?${q}`,{headers:H(tok)});const b=await r.text();return b?JSON.parse(b):null}
const ts=Date.now()
const a=await signup(`ka${ts}@gltest.dev`)
const chap=(await POST('chapters',a.token,{name:'KA',semester:'F26',created_by:a.uid})).data[0]
const mAdm=await POST('members',a.token,{chapter_id:chap.id,user_id:a.uid,full_name:'Admin',role:'Treasurer',dues_status:'Paid',email:`ka${ts}@gltest.dev`},'return=minimal')
const acct=(await POST('budget_accounts',a.token,{chapter_id:chap.id,name:'Social',total_budget:5000})).data?.[0]
const exp=(await POST('expenses',a.token,{chapter_id:chap.id,budget_account_id:acct?.id,description:'T',amount:100,category:'Social',submitted_by:'Admin',status:'Pending'})).data?.[0]
ok(mAdm.ok && acct && exp,`admin setup (member ${mAdm.status}, budget ${acct?'ok':'FAIL'}, exp ${exp?'ok':'FAIL'})`)
const m=await signup(`km${ts}@gltest.dev`)
ok((await POST('members',m.token,{chapter_id:chap.id,user_id:m.uid,full_name:'Mem',role:'Member',dues_status:'Pending',email:`km${ts}@gltest.dev`},'return=minimal')).ok,'member self-joins')
console.log('\n── VIEW ──')
ok((await SEL('expenses',m.token,`chapter_id=eq.${chap.id}`))?.length>=1,'member CAN view expenses')
ok((await SEL('budget_accounts',m.token,`chapter_id=eq.${chap.id}`))?.length>=1,'member CAN view budgets')
console.log('\n── BLOCKED ──')
await PATCH('expenses',m.token,`id=eq.${exp.id}`,{status:'Approved'})
ok((await SEL('expenses',a.token,`id=eq.${exp.id}&select=status`))?.[0]?.status==='Pending','member CANNOT approve')
ok(!(await POST('budget_accounts',m.token,{chapter_id:chap.id,name:'Hack',total_budget:1},'return=minimal')).ok,'member CANNOT create budget')
await PATCH('members',m.token,`user_id=eq.${m.uid}`,{role:'Treasurer'})
ok((await SEL('members',a.token,`user_id=eq.${m.uid}&select=role`))?.[0]?.role==='Member','member CANNOT self-promote')
ok(!(await POST('expenses',m.token,{chapter_id:chap.id,description:'X',amount:5,category:'S',submitted_by:'M',status:'Pending'},'return=minimal')).ok,'member (no grant) CANNOT submit')
console.log('\n── GRANT ──')
const mrow=(await SEL('members',a.token,`user_id=eq.${m.uid}&select=id`))?.[0]
await PATCH('members',a.token,`id=eq.${mrow.id}`,{can_submit_expenses:true})
ok((await POST('expenses',m.token,{chapter_id:chap.id,description:'Legit',amount:7,category:'S',submitted_by:'M',status:'Pending'},'return=minimal')).ok,'granted member CAN submit Pending')
ok(!(await POST('expenses',m.token,{chapter_id:chap.id,description:'Self',amount:7,category:'S',submitted_by:'M',status:'Approved'},'return=minimal')).ok,'granted member CANNOT self-approve')
console.log(`\n════ ${P} passed, ${F} failed ════`)
process.exit(F?1:0)
