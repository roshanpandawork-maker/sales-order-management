// Payroll: employees, daily rate, attendance grid, adjustments, monthly salary + payslip. Admin only.
(function(){
"use strict";
const $=id=>document.getElementById(id),sb=()=>supabaseClient;
const P={emps:[],att:[],adj:[],month:new Date().toISOString().slice(0,7),view:'att',err:''};
const ORD=['','P','H','L','A'],KINDS=['Bonus','Overtime','Advance','Deduction'],ADD=['Bonus','Overtime'];
const css=document.createElement('style');
css.textContent='.att{width:30px;height:28px;padding:0;border-radius:6px;background:#eef2f7;color:#8a98a9;font-size:11px}.att.sP{background:#16a35a;color:#fff}.att.sA{background:#c2413b;color:#fff}.att.sH{background:#d9930d;color:#fff}.att.sL{background:#315fe9;color:#fff}#payroll th.dh{cursor:pointer;text-align:center;padding:8px 4px}#payroll td.dc{padding:4px 2px;text-align:center}#payroll th.sun{background:#ffe9c7;color:#8a5a00}.pv{display:flex;gap:8px;flex-wrap:wrap;align-items:center}';
document.head.appendChild(css);
const ym=()=>P.month.split('-').map(Number),dim=()=>{const[y,m]=ym();return new Date(y,m,0).getDate()};
const dstr=d=>P.month+'-'+String(d).padStart(2,'0');
const tbl=(h,r)=>`<div class="tablewrap"><table><thead><tr>${h.join('')}</tr></thead><tbody>${r.join('')||'<tr><td class="empty" colspan="30">No records</td></tr>'}</tbody></table></div>`;
async function load(){
  const[y,m]=ym(),end=new Date(Date.UTC(y,m,1)).toISOString().slice(0,10);
  const[a,b,c]=await Promise.all([sb().from('employees').select('*').order('name'),sb().from('attendance').select('*').gte('date',P.month+'-01').lt('date',end),sb().from('pay_adjustments').select('*').eq('month',P.month)]);
  const e=a.error||b.error||c.error;P.err=e?e.message:'';if(!e){P.emps=a.data;P.att=b.data;P.adj=c.data}draw();
}
function stat(e){
  const a=P.att.filter(x=>x.emp_id===e.id),c=s=>a.filter(x=>x.status===s).length,sum=f=>P.adj.filter(x=>x.emp_id===e.id&&f(x.kind)).reduce((t,x)=>t+Number(x.amount),0);
  const p=c('P'),h=c('H'),l=c('L'),ab=c('A'),paid=p+h*.5+l,gross=paid*Number(e.daily_rate),adds=sum(k=>ADD.includes(k)),less=sum(k=>!ADD.includes(k));
  return{p,h,l,ab,um:dim()-a.length,paid,gross,adds,less,net:gross+adds-less};
}
function draw(){
  const s=$('payroll');if(!s)return;
  const nav=[['att','Attendance'],['sal','Salary'],['emp','Employees'],['adj','Advances & bonus']].map(v=>`<button class="${P.view===v[0]?'primary':'secondary'}" data-view="${v[0]}">${v[1]}</button>`).join('');
  let body='';
  if(P.err)body=`<div class="panel"><div class="emptybox">Run supabase/04_payroll.sql first.<br>${esc(P.err)}</div></div>`;
  else if(P.view==='att'){
    const act=P.emps.filter(e=>e.active),D=dim(),[y,m]=ym();
    const head=['<th>Employee</th>'].concat(Array.from({length:D},(_,i)=>`<th class="dh ${new Date(y,m-1,i+1).getDay()===0?'sun':''}" data-col="${i+1}" title="Mark all unmarked as Present">${i+1}</th>`),['<th>Paid days</th>']);
    body=`<div class="panel"><h2>Attendance <span class="tag">click a cell: P → Half → Leave → Absent → clear · click a date to mark all Present</span></h2>
    <p class="small muted"><b>P</b> present (1) · <b>H</b> half day (0.5) · <b>L</b> paid leave (1) · <b>A</b> absent (0)</p>
    ${tbl(head,act.map(e=>`<tr><td><b>${esc(e.name)}</b></td>${Array.from({length:D},(_,i)=>{const st=P.att.find(x=>x.emp_id===e.id&&x.date===dstr(i+1))?.status||'';return `<td class="dc"><button class="att ${st?'s'+st:''}" data-m="${e.id}|${dstr(i+1)}">${st}</button></td>`}).join('')}<td><b>${fmt(stat(e).paid)}</b></td></tr>`))}</div>`;
  }else if(P.view==='sal'){
    const rows=P.emps.filter(e=>e.active||stat(e).paid>0).map(e=>({e,s:stat(e)})),T=rows.reduce((t,r)=>t+r.s.net,0);
    body=`<div class="panel"><h2>Salary for ${esc(P.month)} <span class="tag">paid days × daily rate + bonus/OT − advance/deduction</span></h2>${tbl(['Employee','Rate','Present','Half','Leave','Absent','Unmarked','Paid days','Gross','+ Add','− Less','Net pay',''].map(x=>`<th>${x}</th>`),rows.map(({e,s})=>`<tr><td><b>${esc(e.name)}</b></td><td>${money(e.daily_rate)}</td><td>${s.p}</td><td>${s.h}</td><td>${s.l}</td><td>${s.ab}</td><td>${s.um}</td><td>${fmt(s.paid)}</td><td>${money(s.gross)}</td><td>${money(s.adds)}</td><td>${money(s.less)}</td><td><b>${money(s.net)}</b></td><td><button class="secondary btnsm" data-slip="${e.id}">Payslip</button></td></tr>`))}<div class="totalbar"><span class="muted">Total payable</span><strong>${money(T)}</strong></div><p class="small muted">Unmarked days are not paid. A rate change applies to the whole month shown.</p></div>`;
  }else if(P.view==='emp'){
    body=`<div class="panel"><h2>Employees <button class="primary" data-emp="new">+ Add employee</button></h2>${tbl(['Name','Designation','Phone','Daily rate','Joined','Status',''].map(x=>`<th>${x}</th>`),P.emps.map(e=>`<tr><td><b>${esc(e.name)}</b></td><td>${esc(e.designation||'')}</td><td>${esc(e.phone||'')}</td><td>${money(e.daily_rate)}</td><td>${esc(e.joined||'')}</td><td><span class="pill ${e.active?'':'cancel'}">${e.active?'Active':'Inactive'}</span></td><td><button class="secondary btnsm" data-emp="${e.id}">Edit</button> <button class="danger btnsm" data-edel="${e.id}">Delete</button></td></tr>`))}</div>`;
  }else{
    body=`<div class="panel"><h2>Add advance / bonus / deduction for ${esc(P.month)}</h2><form id="adjForm"><div class="grid"><div class="field"><label>Employee *</label><select id="aE" required><option value="">Select</option>${P.emps.map(e=>`<option value="${e.id}">${esc(e.name)}</option>`).join('')}</select></div><div class="field"><label>Type</label><select id="aK">${KINDS.map(k=>`<option>${k}</option>`).join('')}</select></div><div class="field"><label>Amount (₹) *</label><input id="aA" type="number" min="0.01" step=".01" required></div><div class="field"><label>Note</label><input id="aN"></div></div><div class="actions"><button class="primary">Save</button></div></form></div>
    <div class="panel"><h2>Entries this month</h2>${tbl(['Employee','Type','Amount','Note',''].map(x=>`<th>${x}</th>`),P.adj.map(a=>`<tr><td>${esc(P.emps.find(e=>e.id===a.emp_id)?.name||'')}</td><td>${esc(a.kind)}</td><td>${money(a.amount)}</td><td>${esc(a.note||'')}</td><td><button class="danger btnsm" data-adel="${a.id}">Delete</button></td></tr>`))}</div>`;
  }
  s.innerHTML=`<div class="panel"><div class="pv"><b>Payroll</b><input type="month" id="pyMonth" value="${P.month}" style="max-width:170px">${nav}</div></div>`+body;
}
async function mark(eid,d){
  const cur=P.att.find(x=>x.emp_id===eid&&x.date===d),nx=ORD[(ORD.indexOf(cur?.status||'')+1)%5];
  const r=nx?await sb().from('attendance').upsert({emp_id:eid,date:d,status:nx},{onConflict:'emp_id,date'}):await sb().from('attendance').delete().eq('emp_id',eid).eq('date',d);
  if(r.error)return alert(r.error.message);
  P.att=P.att.filter(x=>!(x.emp_id===eid&&x.date===d));if(nx)P.att.push({emp_id:eid,date:d,status:nx});draw();
}
async function markDay(day){
  const d=dstr(day),rows=P.emps.filter(e=>e.active&&!P.att.some(x=>x.emp_id===e.id&&x.date===d)).map(e=>({emp_id:e.id,date:d,status:'P'}));
  if(!rows.length)return;const r=await sb().from('attendance').upsert(rows,{onConflict:'emp_id,date'});if(r.error)return alert(r.error.message);load();
}
function empModal(e){
  e=e||{};
  openModal(e.id?'Edit employee':'Add employee',fld('nN','Name *',e.name)+fld('nD','Designation',e.designation)+fld('nP','Phone',e.phone)+fld('nR','Daily rate (₹) *',e.daily_rate??'','number','min="0" step=".01"')+fld('nJ','Joining date',e.joined,'date')+`<div class="field"><label>Status</label><select id="nA"><option value="1" ${e.active===false?'':'selected'}>Active</option><option value="0" ${e.active===false?'selected':''}>Inactive</option></select></div>`,()=>{
    const n=$('nN').value.trim();if(!n||$('nR').value==='')return alert('Name and daily rate are required.')||false;
    const row={name:n,designation:$('nD').value,phone:$('nP').value,daily_rate:Number($('nR').value),joined:$('nJ').value||null,active:$('nA').value==='1'};
    (e.id?sb().from('employees').update(row).eq('id',e.id):sb().from('employees').insert(row)).then(r=>{if(r.error)alert(r.error.message);load()});
  });
}
function slip(id){
  const e=P.emps.find(x=>x.id===id),s=stat(e),a=$('printArea')||document.body.appendChild(Object.assign(document.createElement('div'),{id:'printArea'}));
  const ent=P.adj.filter(x=>x.emp_id===id).map(x=>`<tr><td>${esc(x.kind)}${x.note?' · '+esc(x.note):''}</td><td>${ADD.includes(x.kind)?'+':'−'} ${money(x.amount)}</td></tr>`).join('');
  a.innerHTML=`<h2>Payslip · ${esc(P.month)}</h2><p><b>${esc(e.name)}</b> ${esc(e.designation||'')}<br>Daily rate ${money(e.daily_rate)}</p><table><tbody><tr><td>Present / Half / Leave / Absent</td><td>${s.p} / ${s.h} / ${s.l} / ${s.ab}</td></tr><tr><td>Paid days</td><td>${fmt(s.paid)}</td></tr><tr><td>Gross (${fmt(s.paid)} × ${money(e.daily_rate)})</td><td>${money(s.gross)}</td></tr>${ent}<tr><td><b>Net pay</b></td><td><b>${money(s.net)}</b></td></tr></tbody></table><p style="margin-top:40px">Employer signature ________ &nbsp;&nbsp; Employee signature ________</p>`;
  window.print();
}
function build(){
  const b=document.createElement('button');b.className='tab';b.dataset.tab='payroll';b.innerHTML='<span class="ic">👷</span>Payroll';
  document.querySelector('[data-tab=reports]').after(b);b.onclick=()=>showTab('payroll');
  const s=document.createElement('section');s.id='payroll';s.className='hidden';document.querySelector('.foot').before(s);
  s.addEventListener('click',e=>{const t=x=>e.target.closest(x);let g;
    if(g=t('[data-view]')){P.view=g.dataset.view;draw()}
    else if(g=t('[data-m]')){const[i,d]=g.dataset.m.split('|');mark(i,d)}
    else if(g=t('[data-col]'))markDay(g.dataset.col);
    else if(g=t('[data-emp]'))empModal(g.dataset.emp==='new'?null:P.emps.find(x=>x.id===g.dataset.emp));
    else if(g=t('[data-edel]')){if(confirm('Delete this employee and ALL their attendance and entries?'))sb().from('employees').delete().eq('id',g.dataset.edel).then(r=>{if(r.error)alert(r.error.message);load()})}
    else if(g=t('[data-slip]'))slip(g.dataset.slip);
    else if(g=t('[data-adel]')){if(confirm('Delete this entry?'))sb().from('pay_adjustments').delete().eq('id',g.dataset.adel).then(r=>{if(r.error)alert(r.error.message);load()})}
  });
  s.addEventListener('change',e=>{if(e.target.id==='pyMonth'&&e.target.value){P.month=e.target.value;load()}});
  s.addEventListener('submit',e=>{if(e.target.id!=='adjForm')return;e.preventDefault();
    sb().from('pay_adjustments').insert({emp_id:$('aE').value,month:P.month,kind:$('aK').value,amount:Number($('aA').value),note:$('aN').value}).then(r=>{if(r.error)alert(r.error.message);else alert('Saved.');load()})});
}
const s0=window.showTab;window.showTab=function(t){s0(t);const h=$('payroll');if(h){h.classList.toggle('hidden',t!=='payroll');if(t==='payroll')load()}};
let done=false;
setInterval(async()=>{if(done||!$('loginBox')||!$('loginBox').classList.contains('hidden'))return;done=true;const{data:r}=await sb().rpc('my_role');if(r==='admin')build()},1000);
})();
