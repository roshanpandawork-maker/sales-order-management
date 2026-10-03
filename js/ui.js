// UI upgrade: toasts, dark mode, sidebar icons, dashboard charts, sortable tables, Esc closes modal.
(function(){
"use strict";
const $=id=>document.getElementById(id);
// 1) Toasts replace alert()
const box=document.createElement('div');box.id='toasts';document.body.appendChild(box);
window.alert=m=>{const t=document.createElement('div'),bad=/fail|error|exceed|cannot|could|invalid|already|must|required|not |select|add at least|enter|complete|denied|too large/i.test(m);
  t.className='toast '+(bad?'bad':'ok');t.textContent=m;box.appendChild(t);setTimeout(()=>t.remove(),bad?6000:3000)};
// 2) Dark mode (remembered)
const root=document.documentElement,btn=document.createElement('button');
btn.id='themeBtn';btn.className='secondary';btn.type='button';
function theme(t){root.dataset.theme=t;btn.textContent=t==='dark'?'☀️':'🌙';try{localStorage.setItem('sd_theme',t)}catch(e){}}
btn.onclick=()=>theme(root.dataset.theme==='dark'?'light':'dark');
let saved='light';try{saved=localStorage.getItem('sd_theme')||'light'}catch(e){}
theme(saved);document.querySelector('.toolbar')?.prepend(btn);
// 3) Sidebar icons
const IC={dashboard:'📊',orders:'📝',sales:'🚚',parties:'👥',products:'📦',balances:'⚖️',inventory:'🏬',invoices:'🧾',payments:'💰',reports:'📈'};
document.querySelectorAll('.tab').forEach(b=>{const s=document.createElement('span');s.className='ic';s.textContent=IC[b.dataset.tab]||'•';b.prepend(s)});
// 4) Dashboard charts
const bars=(title,items)=>{const mx=Math.max(1,...items.map(i=>i.v));
  return `<div class="panel"><h2>${esc(title)}</h2>${items.map(i=>`<div class="bar"><span title="${esc(i.l)}">${esc(i.l)}</span><u><i style="width:${Math.round(i.v/mx*100)}%"></i></u><b>${esc(i.t)}</b></div>`).join('')||'<div class="emptybox">No data yet</div>'}</div>`};
function charts(){
  const d=$('dashboard'),m=d?.querySelector('.metrics');if(!m)return;
  let c=$('uiCharts');if(!c){c=document.createElement('div');c.id='uiCharts';c.className='grid2';m.after(c)}
  const out={};db.orders.filter(o=>o.status!=='Cancelled').forEach(o=>o.lines.forEach(l=>{out[o.party]=(out[o.party]||0)+Math.max(0,l.qty-orderLineSold(o.no,l.productCode))*l.rate}));
  const top=Object.entries(out).filter(x=>x[1]>0).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([l,v])=>({l,v,t:money(v)}));
  const mon={};db.sales.forEach(s=>{const k=String(s.date).slice(0,7);mon[k]=(mon[k]||0)+s.qty*s.rate});
  const last=Object.keys(mon).sort().slice(-6).map(k=>({l:k,v:mon[k],t:money(mon[k])}));
  c.innerHTML=bars('Top parties by outstanding value',top)+bars('Dispatch value by month',last);
}
const r2=window.render;window.render=function(){r2();try{charts()}catch(e){}};
// 5) Click a table header to sort
document.addEventListener('click',e=>{
  const th=e.target.closest('th');if(!th||!th.closest('.tablewrap'))return;
  const tb=th.closest('table').tBodies[0],i=[...th.parentNode.children].indexOf(th),dir=th.dataset.d==='a'?-1:1,rows=[...tb.rows];
  th.parentNode.querySelectorAll('th').forEach(x=>delete x.dataset.d);th.dataset.d=dir===1?'a':'d';
  if(rows.length<2||rows[0].cells.length<2)return;
  const v=r=>{const s=(r.cells[i]?.textContent||'').trim(),n=parseFloat(s.replace(/[₹,]/g,''));return isNaN(n)?s.toLowerCase():n};
  rows.sort((a,b)=>{const x=v(a),y=v(b);return(x>y?1:x<y?-1:0)*dir});rows.forEach(r=>tb.appendChild(r));
});
// 6) Esc closes the edit window
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal()});
})();
