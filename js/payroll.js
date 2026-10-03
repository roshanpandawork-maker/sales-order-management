// Payroll v2: monthly salary, 4 paid-leave policy, attendance, leave-work extra pay,
// advances/bonus/overtime/deductions, employee master and payslips. Admin only.
(function(){
"use strict";
const $=id=>document.getElementById(id),sb=()=>supabaseClient;
const P={
  emps:[],att:[],adj:[],
  month:new Date().toISOString().slice(0,7),
  view:'dash',err:'',loading:false
};

// Attendance cycle:
// P  = Present
// H  = Half day (0.5 day deduction)
// L  = Paid leave (uses monthly paid-leave quota)
// LW = Worked on a paid-leave day (full salary + one daily-rate extra, quota limited)
// A  = Absent (one daily-rate deduction)
// blank = Not recorded / no automatic deduction
const ORD=['','P','H','L','LW','A'];
const KINDS=['Bonus','Overtime','Advance','Deduction'];
const ADD=['Bonus','Overtime'];

const css=document.createElement('style');
css.textContent=`
#payroll .paynav{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
#payroll .paynav .secondary,#payroll .paynav .primary{white-space:nowrap}
#payroll .paygrid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
#payroll .paycard{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:16px}
#payroll .paycard .k{font-size:12px;color:var(--muted);font-weight:700}
#payroll .paycard .v{font-size:23px;font-weight:800;margin-top:4px}
#payroll .paycard .s{font-size:11px;color:var(--muted);margin-top:3px}
#payroll .att{min-width:34px;width:34px;height:30px;padding:0;border-radius:7px;border:1px solid var(--line);background:#eef2f7;color:#6f7f92;font-size:10px;font-weight:800}
#payroll .att.sP{background:#16834a;color:#fff;border-color:#16834a}
#payroll .att.sA{background:#c2413b;color:#fff;border-color:#c2413b}
#payroll .att.sH{background:#d9930d;color:#fff;border-color:#d9930d}
#payroll .att.sL{background:#315fe9;color:#fff;border-color:#315fe9}
#payroll .att.sLW{background:#7c3aed;color:#fff;border-color:#7c3aed}
#payroll th.dh{cursor:pointer;text-align:center;padding:8px 3px}
#payroll td.dc{padding:4px 2px;text-align:center}
#payroll th.sun{background:#fff3df;color:#8a5a00}
#payroll .legend{display:flex;gap:7px;flex-wrap:wrap;margin:8px 0}
#payroll .legend span{font-size:11px;border:1px solid var(--line);border-radius:999px;padding:4px 8px;background:var(--surface)}
#payroll .legend b{display:inline-flex;align-items:center;justify-content:center;width:20px;height:18px;border-radius:4px;margin-right:4px;color:#fff;font-size:10px}
#payroll .bP{background:#16834a}.bH{background:#d9930d}.bL{background:#315fe9}.bLW{background:#7c3aed}.bA{background:#c2413b}
#payroll .policybox{background:#eef5ff;border:1px solid #cfe0ff;border-radius:12px;padding:12px;margin-bottom:12px}
#payroll .policybox strong{color:#244bd0}
#payroll .mini{font-size:11px;color:var(--muted)}
#payroll .good{color:var(--green);font-weight:700}
#payroll .warntext{color:var(--gold);font-weight:700}
#payroll .badtext{color:var(--red);font-weight:700}
#payroll .calcbox{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:10px}
#payroll .calcitem{background:var(--bg);border-radius:10px;padding:9px}
#payroll .calcitem span{display:block;font-size:11px;color:var(--muted)}
#payroll .calcitem strong{display:block;margin-top:2px}
#payroll .paytable td,#payroll .paytable th{vertical-align:middle}
@media(max-width:1000px){#payroll .paygrid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:650px){#payroll .paygrid{grid-template-columns:1fr}#payroll .calcbox{grid-template-columns:1fr 1fr}}
`;
document.head.appendChild(css);

const esc=v=>window.esc?window.esc(v):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const money=v=>window.money?window.money(v):'₹'+Number(v||0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
const fmt=v=>Number(v||0).toLocaleString('en-IN',{maximumFractionDigits:2});
const ym=()=>P.month.split('-').map(Number);
const dim=()=>{const[y,m]=ym();return new Date(y,m,0).getDate()};
const dstr=d=>P.month+'-'+String(d).padStart(2,'0');
const dailyRate=e=>Number(e.monthly_salary ?? Number(e.daily_rate||0)*30)/30;
const monthlySalary=e=>Number(e.monthly_salary ?? Number(e.daily_rate||0)*30);
const quota=e=>Math.max(0,Number(e.paid_leave_quota ?? 4));

const tbl=(h,r,cls='')=>`<div class="tablewrap"><table class="${cls}"><thead><tr>${h.map(x=>x.startsWith('<th')?x:`<th>${x}</th>`).join('')}</tr></thead><tbody>${r.join('')||'<tr><td class="empty" colspan="30">No records</td></tr>'}</tbody></table></div>`;

function stat(e){
  const a=P.att.filter(x=>x.emp_id===e.id);
  const c=s=>a.filter(x=>x.status===s).length;
  const p=c('P'),h=c('H'),l=c('L'),lw=c('LW'),ab=c('A');
  const q=quota(e);
  const excessLeave=Math.max(0,l-q);
  const paidLeaveUsed=Math.min(l,q);
  const halfDeduction=h*.5;
  const unpaidDays=ab+halfDeduction+excessLeave;
  const dr=dailyRate(e);
  const attendanceDeduction=unpaidDays*dr;
  const extraLeaveWorkDays=Math.min(lw,q);
  const extraLeaveWork=extraLeaveWorkDays*dr;
  const base=monthlySalary(e);
  const grossBase=Math.max(0,base-attendanceDeduction);
  const sum=f=>P.adj.filter(x=>x.emp_id===e.id&&f(x.kind)).reduce((t,x)=>t+Number(x.amount),0);
  const adds=sum(k=>ADD.includes(k));
  const less=sum(k=>!ADD.includes(k));
  const net=grossBase+extraLeaveWork+adds-less;
  return {
    p,h,l,lw,ab,um:Math.max(0,dim()-a.length),
    paidLeaveUsed,excessLeave,unpaidDays,attendanceDeduction,
    extraLeaveWorkDays,extraLeaveWork,
    base,dr,grossBase,adds,less,net
  };
}

function kpi(label,value,sub=''){
  return `<div class="paycard"><div class="k">${label}</div><div class="v">${value}</div><div class="s">${sub}</div></div>`;
}

function draw(){
  const s=$('payroll');if(!s)return;
  const nav=[
    ['dash','Dashboard'],['att','Attendance'],['sal','Payroll'],['emp','Employees'],['adj','Adjustments']
  ].map(v=>`<button class="${P.view===v[0]?'primary':'secondary'}" data-view="${v[0]}">${v[1]}</button>`).join('');
  let body='';
  if(P.err){
    body=`<div class="panel"><div class="emptybox">Run <b>supabase/04_payroll.sql</b> first, then refresh.<br>${esc(P.err)}</div></div>`;
  }else if(P.view==='dash') body=dashboard();
  else if(P.view==='att') body=attendance();
  else if(P.view==='sal') body=salary();
  else if(P.view==='emp') body=employees();
  else body=adjustments();

  s.innerHTML=`
    <div class="panel"><div class="paynav">
      <b style="margin-right:auto">Payroll · ${esc(P.month)}</b>
      <input type="month" id="pyMonth" value="${P.month}" style="max-width:170px">
      ${nav}
    </div></div>${body}`;
}

function dashboard(){
  const rows=P.emps.filter(e=>e.active||stat(e).net>0).map(e=>({e,s:stat(e)}));
  const total=rows.reduce((t,r)=>t+r.s.net,0);
  const gross=rows.reduce((t,r)=>t+r.s.grossBase,0);
  const ot=rows.reduce((t,r)=>t+r.s.extraLeaveWork+r.s.adds,0);
  const advances=rows.reduce((t,r)=>t+r.s.less,0);
  const leave=rows.reduce((t,r)=>t+r.s.paidLeaveUsed,0);
  const abs=rows.reduce((t,r)=>t+r.s.ab,0);
  return `
  <div class="panel">
    <div class="policybox"><strong>Company leave policy:</strong> 4 paid leave days per employee per month. Monthly salary is entered as the total salary; daily rate is automatically calculated as <b>monthly salary ÷ 30</b>. Working on a paid-leave day is recorded as <b>LW</b> and adds one daily rate extra (maximum 4 such days per month).</div>
    <div class="paygrid">
      ${kpi('Active employees',P.emps.filter(e=>e.active).length,'Current employee master')}
      ${kpi('Base payroll',money(gross),'After attendance deductions')}
      ${kpi('Extra leave-work + additions',money(ot),'LW pay + bonus + overtime')}
      ${kpi('Net payable',money(total),'After advances/deductions')}
      ${kpi('Paid leave used',fmt(leave),'Across active employees')}
      ${kpi('Absence days',fmt(abs),'Explicit A entries')}
      ${kpi('Advances + deductions',money(advances),'Current month')}
      ${kpi('Month length',dim()+' days','Salary divisor remains 30')}
    </div>
  </div>
  <div class="panel"><h2>Payroll snapshot</h2>${tbl(['Employee','Monthly salary','Daily rate','Leave used','LW extra','Attendance deduction','Net pay',''],rows.map(({e,s})=>`
    <tr><td><b>${esc(e.name)}</b><div class="mini">${esc(e.designation||'')}</div></td>
    <td>${money(s.base)}</td><td>${money(s.dr)}</td><td>${fmt(s.paidLeaveUsed)} / ${fmt(quota(e))}</td>
    <td>${s.extraLeaveWorkDays?money(s.extraLeaveWork):'—'}</td><td>${s.attendanceDeduction?money(s.attendanceDeduction):'—'}</td>
    <td><b>${money(s.net)}</b></td><td><button class="secondary btnsm" data-slip="${e.id}">Payslip</button></td></tr>`))}</div>`;
}

function attendance(){
  const act=P.emps.filter(e=>e.active),D=dim(),[y,m]=ym();
  const head=['<th>Employee</th>'].concat(
    Array.from({length:D},(_,i)=>`<th class="dh ${new Date(y,m-1,i+1).getDay()===0?'sun':''}" data-col="${i+1}" title="Mark all unmarked employees Present">${i+1}</th>`),
    ['<th>Leave</th>','<th>LW</th>','<th>Absent</th>','<th>Net</th>']
  );
  return `<div class="panel">
    <h2>Attendance</h2>
    <div class="policybox"><b>How this works:</b> click a cell to cycle <b>P → H → L → LW → A → blank</b>. <b>L</b> uses the 4 paid-leave quota. <b>LW</b> means the employee worked on a paid-leave day and gets one extra daily-rate payment. <b>A</b> is an unpaid absence. Unmarked days are not treated as absences.</div>
    <div class="legend">
      <span><b class="bP">P</b>Present</span><span><b class="bH">H</b>Half day</span><span><b class="bL">L</b>Paid leave</span><span><b class="bLW">LW</b>Worked on paid leave</span><span><b class="bA">A</b>Absent</span>
    </div>
    ${tbl(head,act.map(e=>{const st=stat(e);return `<tr><td><b>${esc(e.name)}</b><div class="mini">${money(monthlySalary(e))}/month · ${money(dailyRate(e))}/day · ${fmt(quota(e))} paid leave</div></td>
      ${Array.from({length:D},(_,i)=>{const x=P.att.find(a=>a.emp_id===e.id&&a.date===dstr(i+1));const v=x?.status||'';return `<td class="dc"><button class="att ${v?'s'+v:''}" data-m="${e.id}|${dstr(i+1)}">${v||'·'}</button></td>`}).join('')}
      <td>${fmt(st.paidLeaveUsed)}/${fmt(quota(e))}</td><td>${fmt(st.extraLeaveWorkDays)}</td><td>${fmt(st.ab)}</td><td><b>${money(st.net)}</b></td></tr>`}))}
    <p class="small muted">Click a date heading to mark all currently unmarked active employees as Present.</p>
  </div>`;
}

function salary(){
  const rows=P.emps.filter(e=>e.active||stat(e).net>0).map(e=>({e,s:stat(e)}));
  const T=rows.reduce((t,r)=>t+r.s.net,0);
  return `<div class="panel">
    <h2>Payroll for ${esc(P.month)}</h2>
    <div class="policybox">Base salary = <b>monthly salary</b> − unpaid attendance deduction. Daily rate = <b>monthly salary ÷ 30</b>. Up to 4 paid leaves are included in the monthly salary. Each <b>LW</b> adds one daily rate extra, up to 4 LW days. Bonus and overtime are added; advances and deductions are subtracted.</div>
    ${tbl(['Employee','Monthly','Daily ÷30','P','H','L','LW','A','Leave quota','Attendance deduction','LW extra','+ Add','− Less','Net',''],rows.map(({e,s})=>`
      <tr><td><b>${esc(e.name)}</b></td><td>${money(s.base)}</td><td>${money(s.dr)}</td><td>${s.p}</td><td>${s.h}</td><td>${s.l}</td><td>${s.lw}</td><td>${s.ab}</td><td>${fmt(s.paidLeaveUsed)}/${fmt(quota(e))}</td>
      <td>${s.attendanceDeduction?money(s.attendanceDeduction):'—'}</td><td>${s.extraLeaveWork?money(s.extraLeaveWork):'—'}</td><td>${s.adds?money(s.adds):'—'}</td><td>${s.less?money(s.less):'—'}</td><td><b>${money(s.net)}</b></td><td><button class="secondary btnsm" data-slip="${e.id}">Payslip</button></td></tr>`))}
    <div class="totalbar"><span class="muted">Total payable</span><strong>${money(T)}</strong></div>
    <p class="small muted">A 31-day month does not increase the salary. A 30-day month does not reduce it. The daily calculation always uses monthly salary ÷ 30.</p>
  </div>`;
}

function employees(){
  return `<div class="panel"><h2>Employees <button class="primary" data-emp="new">+ Add employee</button></h2>
  <p class="small muted">Enter total monthly salary only. The system automatically stores/calculates daily rate as monthly salary ÷ 30. Default paid-leave quota is 4 days per month.</p>
  ${tbl(['Name','Designation','Phone','Monthly salary','Daily rate','Paid leave','Joined','Status',''],P.emps.map(e=>`
    <tr><td><b>${esc(e.name)}</b></td><td>${esc(e.designation||'')}</td><td>${esc(e.phone||'')}</td><td>${money(monthlySalary(e))}</td><td>${money(dailyRate(e))}</td><td>${fmt(quota(e))} days</td><td>${esc(e.joined||'')}</td><td><span class="pill ${e.active?'':'cancel'}">${e.active?'Active':'Inactive'}</span></td><td><button class="secondary btnsm" data-emp="${e.id}">Edit</button> <button class="danger btnsm" data-edel="${e.id}">Delete</button></td></tr>`))}</div>`;
}

function adjustments(){
  return `<div class="panel"><h2>Add bonus / overtime / advance / deduction for ${esc(P.month)}</h2>
  <form id="adjForm"><div class="grid">
    <div class="field"><label>Employee *</label><select id="aE" required><option value="">Select</option>${P.emps.map(e=>`<option value="${e.id}">${esc(e.name)}</option>`).join('')}</select></div>
    <div class="field"><label>Type</label><select id="aK">${KINDS.map(k=>`<option>${k}</option>`).join('')}</select></div>
    <div class="field"><label>Amount (₹) *</label><input id="aA" type="number" min="0.01" step=".01" required></div>
    <div class="field"><label>Note</label><input id="aN" placeholder="Reason / reference"></div>
  </div><div class="actions"><button class="primary">Save entry</button></div></form></div>
  <div class="panel"><h2>Entries this month</h2>${tbl(['Employee','Type','Amount','Note',''],P.adj.map(a=>`<tr><td>${esc(P.emps.find(e=>e.id===a.emp_id)?.name||'')}</td><td>${esc(a.kind)}</td><td>${money(a.amount)}</td><td>${esc(a.note||'')}</td><td><button class="danger btnsm" data-adel="${a.id}">Delete</button></td></tr>`))}</div>`;
}

function empModal(e){
  e=e||{};
  const monthly=e.id?monthlySalary(e):'';
  openModal(e.id?'Edit employee':'Add employee',
    fld('nN','Name *',e.name)+
    fld('nD','Designation',e.designation)+
    fld('nP','Phone',e.phone)+
    fld('nS','Total monthly salary (₹) *',monthly,'number','min="0" step=".01"')+
    fld('nQ','Paid leave quota / month',e.paid_leave_quota??4,'number','min="0" max="31" step="1"')+
    fld('nJ','Joining date',e.joined,'date')+
    `<div class="field"><label>Status</label><select id="nA"><option value="1" ${e.active===false?'':'selected'}>Active</option><option value="0" ${e.active===false?'selected':''}>Inactive</option></select></div>`,
    ()=>{
      const n=$('nN').value.trim(), sal=Number($('nS').value);
      if(!n||!(sal>=0))return alert('Name and monthly salary are required.')||false;
      const row={
        name:n,designation:$('nD').value,phone:$('nP').value,
        monthly_salary:sal,daily_rate:Number((sal/30).toFixed(2)),
        paid_leave_quota:Number($('nQ').value||4),
        joined:$('nJ').value||null,active:$('nA').value==='1'
      };
      const q=e.id?sb().from('employees').update(row).eq('id',e.id):sb().from('employees').insert(row);
      q.then(r=>{if(r.error)alert(r.error.message);else{closeModal();load()}});
    }
  );
}

function slip(id){
  const e=P.emps.find(x=>x.id===id);if(!e)return;
  const s=stat(e),a=$('printArea')||document.body.appendChild(Object.assign(document.createElement('div'),{id:'printArea'}));
  const ent=P.adj.filter(x=>x.emp_id===id).map(x=>`<tr><td>${esc(x.kind)}${x.note?' · '+esc(x.note):''}</td><td>${ADD.includes(x.kind)?'+':'−'} ${money(x.amount)}</td></tr>`).join('');
  a.innerHTML=`<h2>Payslip · ${esc(P.month)}</h2>
  <p><b>${esc(e.name)}</b><br>${esc(e.designation||'')}<br>Monthly salary ${money(s.base)} · Daily rate ${money(s.dr)}<br>Paid leave quota ${fmt(quota(e))} days</p>
  <table><tbody>
  <tr><td>Present / Half / Paid leave / LW / Absent</td><td>${s.p} / ${s.h} / ${s.l} / ${s.lw} / ${s.ab}</td></tr>
  <tr><td>Paid leave used</td><td>${fmt(s.paidLeaveUsed)} / ${fmt(quota(e))}</td></tr>
  <tr><td>Attendance deduction</td><td>− ${money(s.attendanceDeduction)}</td></tr>
  <tr><td>Salary after attendance</td><td>${money(s.grossBase)}</td></tr>
  <tr><td>Worked-on-leave extra</td><td>+ ${money(s.extraLeaveWork)}</td></tr>
  ${ent}
  <tr><td><b>Net pay</b></td><td><b>${money(s.net)}</b></td></tr>
  </tbody></table>
  <p style="margin-top:40px">Employer signature __________________ &nbsp;&nbsp; Employee signature __________________</p>`;
  window.print();
}

async function mark(eid,d){
  const cur=P.att.find(x=>x.emp_id===eid&&x.date===d);
  const ix=ORD.indexOf(cur?.status||'');
  const nx=ORD[(ix+1)%ORD.length];
  const payload={emp_id:eid,date:d,status:nx};
  const r=nx?await sb().from('attendance').upsert(payload,{onConflict:'emp_id,date'}):await sb().from('attendance').delete().eq('emp_id',eid).eq('date',d);
  if(r.error)return alert(r.error.message);
  P.att=P.att.filter(x=>!(x.emp_id===eid&&x.date===d));if(nx)P.att.push({...payload});draw();
}

async function markDay(day){
  const d=dstr(day);
  const rows=P.emps.filter(e=>e.active&&!P.att.some(x=>x.emp_id===e.id&&x.date===d)).map(e=>({emp_id:e.id,date:d,status:'P'}));
  if(!rows.length)return;
  const r=await sb().from('attendance').upsert(rows,{onConflict:'emp_id,date'});
  if(r.error)return alert(r.error.message);
  load();
}

async function load(){
  const[y,m]=ym(),end=new Date(Date.UTC(y,m,1)).toISOString().slice(0,10);
  P.loading=true;
  const [a,b,c]=await Promise.all([
    sb().from('employees').select('*').order('name'),
    sb().from('attendance').select('*').gte('date',P.month+'-01').lt('date',end),
    sb().from('pay_adjustments').select('*').eq('month',P.month).order('id')
  ]);
  const er=a.error||b.error||c.error;
  P.err=er?er.message:'';
  if(!er){P.emps=a.data||[];P.att=b.data||[];P.adj=c.data||[]}
  P.loading=false;draw();
}

function build(){
  if($('[data-tab=payroll]'))return;
  const b=document.createElement('button');
  b.className='tab';b.dataset.tab='payroll';b.innerHTML='<span class="ic">👷</span>Payroll';
  document.querySelector('[data-tab=reports]').after(b);
  b.onclick=()=>showTab('payroll');
  const s=document.createElement('section');s.id='payroll';s.className='hidden';
  document.querySelector('.foot').before(s);

  s.addEventListener('click',e=>{
    const t=x=>e.target.closest(x);let g;
    if(g=t('[data-view]')){P.view=g.dataset.view;draw()}
    else if(g=t('[data-m]')){const[i,d]=g.dataset.m.split('|');mark(i,d)}
    else if(g=t('[data-col]'))markDay(g.dataset.col)
    else if(g=t('[data-emp]'))empModal(g.dataset.emp==='new'?null:P.emps.find(x=>x.id===g.dataset.emp))
    else if(g=t('[data-edel]')){if(confirm('Delete this employee and ALL their attendance and entries?'))sb().from('employees').delete().eq('id',g.dataset.edel).then(r=>{if(r.error)alert(r.error.message);load()})}
    else if(g=t('[data-slip]'))slip(g.dataset.slip)
    else if(g=t('[data-adel]')){if(confirm('Delete this entry?'))sb().from('pay_adjustments').delete().eq('id',g.dataset.adel).then(r=>{if(r.error)alert(r.error.message);load()})}
  });
  s.addEventListener('change',e=>{
    if(e.target.id==='pyMonth'&&e.target.value){P.month=e.target.value;load()}
  });
  s.addEventListener('submit',e=>{
    if(e.target.id!=='adjForm')return;
    e.preventDefault();
    sb().from('pay_adjustments').insert({
      emp_id:$('aE').value,month:P.month,kind:$('aK').value,
      amount:Number($('aA').value),note:$('aN').value
    }).then(r=>{if(r.error)alert(r.error.message);else{alert('Saved.');load()}})
  });
}

const s0=window.showTab;
window.showTab=function(t){
  s0(t);
  const h=$('payroll');
  if(h){h.classList.toggle('hidden',t!=='payroll');if(t==='payroll')load()}
};

let done=false;
setInterval(async()=>{
  if(done||!$('loginBox')||!$('loginBox').classList.contains('hidden'))return;
  done=true;
  const{data:r}=await sb().rpc('my_role');
  if(r==='admin')build();
},1000);
})();