// Dashboard upgrade: KPIs, alerts, sales-vs-collection chart, fulfilment, recent activity.
// Needs: app.js, erp.js (with window.ERP line), ui.js loaded before this file.
(function(){
"use strict";
const $=id=>document.getElementById(id);
const css=document.createElement('style');
css.textContent=`.dtop{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin:0 0 14px}.dtop b{font-size:18px}
.kpis{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:14px;margin-bottom:17px}
.kpi{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);padding:16px;box-shadow:var(--shadow);border-top:4px solid var(--blue)}
.kpi small{display:block;color:var(--muted);font-size:11px;font-weight:700}.kpi strong{display:block;font-size:21px;margin:6px 0 2px;font-variant-numeric:tabular-nums}.kpi span{font-size:11px;color:var(--muted)}
.kpi.g{border-top-color:#16834a}.kpi.r{border-top-color:#c2413b}.kpi.y{border-top-color:#d9930d}
.alert{display:flex;gap:10px;align-items:center;padding:9px 11px;border-radius:9px;margin:7px 0;font-size:12px;cursor:pointer;background:#fff7e6;border:1px solid #f6e3b4;color:#7a4e06}
.alert.bad{background:#fff0ee;border-color:#ffded9;color:#9b2f29}.alert.ok{background:#eaf8ef;border-color:#cdebd8;color:#16683c;cursor:default}
.cols{display:flex;align-items:flex-end;gap:16px;height:170px;padding-top:8px}.col{flex:1;text-align:center;font-size:11px;color:var(--muted)}
.pair{display:flex;gap:4px;align-items:flex-end;justify-content:center;height:130px}.pair i{display:block;width:16px;min-height:2px;border-radius:5px 5px 0 0;background:var(--blue);transition:height .5s}.pair i.c{background:#16a35a}
.leg{font-size:11px;color:var(--muted);margin-top:6px}.leg i{display:inline-block;width:10px;height:10px;border-radius:3px;background:var(--blue);margin:0 4px 0 8px}.leg i.c{background:#16a35a}
@media(max-width:1100px){.kpis{grid-template-columns:repeat(2,minmax(0,1fr))}}
[data-theme=dark] .alert{background:#2b2411;border-color:#4a3c14;color:#f0c674}[data-theme=dark] .alert.bad{background:#2d1715;border-color:#552522;color:#ff9b93}[data-theme=dark] .alert.ok{background:#12281c;border-color:#1d4a30;color:#7fd8a4}`;
document.head.appendChild(css);
const bars=(t,items)=>{const mx=Math.max(1,...items.map(i=>i.v));return `<div class="panel"><h2>${esc(t)}</h2>${items.map(i=>`<div class="bar"><span title="${esc(i.l)}">${esc(i.l)}</span><u><i style="width:${Math.round(i.v/mx*100)}%"></i></u><b>${esc(i.t)}</b></div>`).join('')||'<div class="emptybox">No data yet</div>'}</div>`};
function draw(){
  const d=$('dashboard'),m=d&&d.querySelector('.metrics');if(!m||!window.ERP||!window.db)return;
  $('uiCharts')?.remove();
  let c=$('dashPlus');if(!c){c=document.createElement('div');c.id='dashPlus';m.after(c)}
  const E=ERP.E,inv=ERP.invoices(),stk=ERP.stock(),active=db.orders.filter(o=>o.status!=='Cancelled');
  const age=i=>Math.floor((Date.now()-new Date(i.date))/864e5),pn=k=>db.products.find(p=>p.code===k)?.name||k;
  const pend={},ord={},sold={};let pendVal=0;
  active.forEach(o=>o.lines.forEach(l=>{const s=orderLineSold(o.no,l.productCode),r=Math.max(0,l.qty-s);pend[l.productCode]=(pend[l.productCode]||0)+r;pendVal+=r*l.rate;ord[l.productCode]=(ord[l.productCode]||0)+l.qty;sold[l.productCode]=(sold[l.productCode]||0)+s}));
  const salesTot=db.sales.reduce((a,s)=>a+s.qty*s.rate,0),recv=inv.reduce((a,i)=>a+Math.max(0,i.due),0),over=inv.filter(i=>i.due>.005&&age(i)>30),
    mon=today.slice(0,7),coll=E.pay.filter(p=>String(p.date).startsWith(mon)).reduce((a,p)=>a+Number(p.amount),0),
    short=db.products.filter(p=>(stk[p.code]||0)<(pend[p.code]||0)),late=active.filter(o=>o.due&&o.due<today&&orderStatus(o)==='Ongoing');
  const kpi=(cls,l,v,s)=>`<div class="kpi ${cls}"><small>${l}</small><strong>${v}</strong><span>${s}</span></div>`;
  const al=[];
  late.slice(0,4).forEach(o=>al.push(['bad',`Order ${esc(o.no)} · ${esc(o.party)} is past due date ${esc(o.due)}`,'orders']));
  over.slice(0,4).forEach(i=>al.push(['bad',`Invoice ${esc(i.no)} · ${esc(i.party)}: ${money(i.due)} unpaid for ${age(i)} days`,'invoices']));
  short.slice(0,4).forEach(p=>al.push(['',`Low stock: ${esc(p.name)} has ${fmt(stk[p.code]||0)}, pending orders need ${fmt(pend[p.code]||0)}`,'inventory']));
  const ms={};db.sales.forEach(s=>{const k=String(s.date).slice(0,7);(ms[k]??={s:0,c:0}).s+=s.qty*s.rate});E.pay.forEach(p=>{const k=String(p.date).slice(0,7);(ms[k]??={s:0,c:0}).c+=Number(p.amount)});
  const keys=Object.keys(ms).sort().slice(-6),mx=Math.max(1,...keys.map(k=>Math.max(ms[k].s,ms[k].c)));
  const byP={};db.sales.forEach(s=>byP[s.party]=(byP[s.party]||0)+s.qty*s.rate);
  const topP=Object.entries(byP).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([l,v])=>({l,v,t:money(v)}));
  const ful=Object.keys(ord).sort((a,b)=>(pend[b]||0)-(pend[a]||0)).slice(0,5).map(k=>({l:pn(k),v:ord[k]?sold[k]/ord[k]*100:0,t:Math.round(ord[k]?sold[k]/ord[k]*100:0)+'%'}));
  const act=[...db.sales.map(s=>({d:String(s.date),k:'Dispatch',t:`${s.so} · ${s.party} · ${pn(s.productCode)} × ${fmt(s.qty)}`,v:s.qty*s.rate})),...E.pay.map(p=>({d:String(p.date),k:'Payment',t:`${p.receipt_no||''} · ${db.parties.find(x=>x.code===p.party_code)?.name||''} · ${p.invoice_no||''}`,v:Number(p.amount)}))].sort((a,b)=>b.d.localeCompare(a.d)).slice(0,8);
  c.innerHTML=`<div class="dtop"><div><b>Business overview</b><div class="muted small">${new Date().toDateString()}</div></div><div class="actions" style="margin:0"><button class="primary" data-go="orders">+ New order</button><button class="secondary" data-go="sales">+ Dispatch</button><button class="secondary" data-go="payments">+ Payment</button></div></div>
  <div class="kpis">${kpi('','Total dispatched value',money(salesTot),db.sales.length+' dispatch lines')}${kpi('y','Pending order value',money(pendVal),active.filter(o=>orderStatus(o)==='Ongoing').length+' open orders')}${kpi(recv>0?'r':'g','Receivable (unpaid)',money(recv),over.length+' invoices over 30 days')}${kpi('g','Collected this month',money(coll),E.pay.length+' payments recorded')}${kpi(short.length?'r':'g','Low stock items',short.length,short.length?'Stock below pending orders':'Stock is enough')}</div>
  <div class="grid2"><div class="panel"><h2>Needs attention</h2>${al.map(a=>`<div class="alert ${a[0]}" data-go="${a[2]}">${a[1]}</div>`).join('')||'<div class="alert ok">All clear. Nothing needs attention.</div>'}</div>
  <div class="panel"><h2>Sales vs collections <span class="tag">last 6 months</span></h2><div class="cols">${keys.map(k=>`<div class="col"><div class="pair"><i style="height:${Math.round(ms[k].s/mx*100)}%" title="Sales ${money(ms[k].s)}"></i><i class="c" style="height:${Math.round(ms[k].c/mx*100)}%" title="Collected ${money(ms[k].c)}"></i></div>${k.slice(2)}</div>`).join('')||'<div class="emptybox" style="width:100%">No data yet</div>'}</div><div class="leg"><i></i>Sales<i class="c"></i>Collected</div></div></div>
  <div class="grid2">${bars('Top parties by sales',topP)}${bars('Order fulfilment by product',ful)}</div>
  <div class="panel"><h2>Recent activity</h2><div class="tablewrap"><table><thead><tr><th>Date</th><th>Type</th><th>Details</th><th>Amount</th></tr></thead><tbody>${act.map(a=>`<tr><td>${esc(a.d)}</td><td><span class="pill ${a.k==='Payment'?'':'open'}">${a.k}</span></td><td>${esc(a.t)}</td><td>${money(a.v)}</td></tr>`).join('')||'<tr><td colspan="4" class="empty">No activity yet</td></tr>'}</tbody></table></div></div>`;
}
const r3=window.render;window.render=function(){r3();try{draw()}catch(e){}};
document.addEventListener('click',e=>{const g=e.target.closest('[data-go]');if(g)showTab(g.dataset.go);else if(e.target.closest('.tab'))setTimeout(()=>{try{draw()}catch(x){}},50)});
setInterval(()=>{if(!$('dashboard').classList.contains('hidden'))try{draw()}catch(e){}},4000);
})();
