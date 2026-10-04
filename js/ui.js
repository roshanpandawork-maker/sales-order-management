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

(function(){
  const U=['QTL','KG','MT','PCS','BAG'];
  const lt=l=>String(l?.qtyType||db.products.find(p=>p.code===l?.productCode)?.unit||'QTL').toUpperCase();
  const st=s=>String(s?.qty_type||s?.qtyType||db.products.find(p=>p.code===s?.productCode)?.unit||'QTL').toUpperCase();
  const optsU=s=>U.map(u=>`<option value="${u}" ${u===s?'selected':''}>${u}</option>`).join('');
  const qt=(q,u)=>`${fmt(q)} ${u}`;
  function normalize(){db.orders.forEach(o=>(o.lines||[]).forEach(l=>{if(!l.qtyType)l.qtyType=lt(l)}));db.sales.forEach(s=>{if(!s.qty_type)s.qty_type=st(s)});}
  window.addOrderLine=function(){const tr=document.createElement('tr');tr.innerHTML=`<td><select class="ol-product" required>${opts(db.products,'Choose product')}</select></td><td><select class="ol-type">${optsU('QTL')}</select></td><td><input class="ol-qty" type="number" min=".001" step=".001" placeholder="0" required></td><td><input class="ol-rate" type="number" min="0" step=".01" placeholder="0.00"></td><td class="ol-value">₹0.00</td><td><button type="button" class="danger btnsm" data-act="removeLine">Remove</button></td>`;$('orderLines').appendChild(tr);const p=tr.querySelector('.ol-product'),u=tr.querySelector('.ol-type');p.onchange=()=>{const x=db.products.find(v=>v.code===p.value);u.value=U.includes(x?.unit)?x.unit:'QTL';tr.querySelector('.ol-rate').value=x?.rate||0;calcOrder()};u.onchange=calcOrder;tr.querySelectorAll('input').forEach(i=>i.oninput=calcOrder)};
  $('orderForm').onsubmit=e=>{e.preventDefault();const lines=[...$('orderLines').rows].map(r=>{const productCode=r.querySelector('.ol-product').value,p=db.products.find(x=>x.code===productCode),rate=Number(r.querySelector('.ol-rate').value||0),gstRate=Number(p?.gst_rate||0);return {productCode,qtyType:r.querySelector('.ol-type').value,qty:Number(r.querySelector('.ol-qty').value),rate,gstRate,rateExclGst:gstRate>0?rate/(1+gstRate/100):rate}}).filter(x=>x.productCode&&x.qty>0);if(!lines.length)return alert('Add at least one valid product line.');if(lines.length!==$('orderLines').rows.length)return alert('Complete or remove blank product lines.');if(new Set(lines.map(x=>x.productCode+'|'+x.qtyType)).size!==lines.length)return alert('Each product + QTY TYPE should appear only once per SO.');const p=db.parties.find(x=>x.code===$('soParty').value);if(!p)return alert('Select a party.');db.orders.push({no:$('soNo').value,date:$('soDate').value,partyCode:p.code,party:p.name,due:$('soDue').value,ref:$('soRef').value,remarks:$('soRemarks').value,lines,status:'Ongoing',price_includes_gst:true});save();e.target.reset();resetOrder();alert('Sales order saved.')};
  window.orderLineSold=(no,code,type)=>db.sales.filter(s=>s.so===no&&s.productCode===code&&(!type||st(s)===type)).reduce((a,s)=>a+Number(s.qty),0);
  window.orderStatus=o=>o.status==='Cancelled'?'Cancelled':o.lines.every(l=>l.qty-orderLineSold(o.no,l.productCode,lt(l))<=.000001)?'Closed':'Ongoing';
  window.orderSold=o=>o.lines.reduce((a,l)=>a+orderLineSold(o.no,l.productCode,lt(l)),0);
  window.loadSaleLines=function(){const o=db.orders.find(x=>x.no===$('saleSO').value);$('saleParty').value=o?.party||'';$('saleLines').innerHTML='';if(!o){$('saleLines').innerHTML='<tr><td colspan="8" class="empty">Select an SO to load its products.</td></tr>';return}o.lines.forEach(l=>{const p=db.products.find(x=>x.code===l.productCode),u=lt(l),sold=orderLineSold(o.no,l.productCode,u),bal=l.qty-sold,tr=document.createElement('tr');tr.dataset.code=l.productCode;tr.dataset.qtyType=u;tr.innerHTML=`<td>${esc(p?.name||l.productCode)}</td><td><span class="tag">${u}</span></td><td>${fmt(l.qty)}</td><td>${fmt(sold)}</td><td class="available">${fmt(bal)}</td><td><input class="sl-qty" type="number" min="0" max="${bal}" step=".001" placeholder="0" ${bal<=0?'disabled':''}></td><td><input class="sl-rate" type="number" min="0" step=".01" value="${esc(l.rate)}"></td><td class="sl-value">${money(0)}</td>`;tr.querySelectorAll('input').forEach(i=>i.oninput=calcSale);$('saleLines').appendChild(tr)});$('saleHint').textContent=o.no+' · '+o.party;calcSale()};
  const saleSOEl=$('saleSO');
  if(saleSOEl){saleSOEl.onchange=()=>window.loadSaleLines()}
  $('salesForm').onsubmit=e=>{e.preventDefault();const o=db.orders.find(x=>x.no===$('saleSO').value);if(!o)return alert('Select an SO.');const lines=[...$('saleLines').rows].map(r=>({productCode:r.dataset.code,qtyType:r.dataset.qtyType,qty:Number(r.querySelector('.sl-qty')?.value||0),rate:Number(r.querySelector('.sl-rate')?.value||0)})).filter(x=>x.qty>0);if(!lines.length)return alert('Enter a dispatch quantity for at least one product.');for(const l of lines){const wantedCode=String(l.productCode||'').trim();let original=o.lines.find(x=>String(x.productCode||'').trim()===wantedCode);if(!original){const product=db.products.find(p=>String(p.code||'').trim()===wantedCode);if(!product)return alert('Product not found in this Sales Order.');return alert('Product is not part of this Sales Order.');}const orderType=lt(original);l.qtyType=orderType;const available=Number(original.qty||0)-orderLineSold(o.no,wantedCode,orderType);if(l.qty>available+1e-8)return alert('Dispatch quantity exceeds available balance. Available: '+fmt(available)+' '+orderType)}const b='DS'+Date.now();lines.forEach(l=>db.sales.push({id:b+'-'+l.productCode,date:$('saleDate').value,so:o.no,party:o.party,partyCode:o.partyCode,invoice:$('saleInvoice').value.trim(),productCode:l.productCode,qty:l.qty,qty_type:l.qtyType,rate:l.rate,remarks:$('saleRemarks').value}));save();e.target.reset();$('saleDate').value=today;clearSaleLines();alert('Dispatch saved for '+lines.length+' product(s).')};
  const oldRender=window.render;window.render=function(){normalize();oldRender();const oh=document.querySelector('#orders .lines thead tr'),sh=document.querySelector('#sales .lines thead tr');if(oh)oh.children[1].textContent='QTY TYPE';if(sh)sh.children[1].textContent='QTY TYPE';[...$('orderRows').rows].forEach((r,i)=>{const o=[...db.orders].reverse()[i];if(o){r.cells[4].textContent=o.lines.map(l=>qt(l.qty,lt(l))).join(' + ');r.cells[5].textContent=o.lines.map(l=>qt(orderLineSold(o.no,l.productCode,lt(l)),lt(l))).join(' + ');r.cells[6].textContent=o.lines.map(l=>qt(Math.max(0,l.qty-orderLineSold(o.no,l.productCode,lt(l))),lt(l))).join(' + ')}});[...$('salesRows').rows].forEach((r,i)=>{const s=[...db.sales].reverse()[i];if(s)r.cells[5].textContent=qt(s.qty,st(s))});const active=db.orders.filter(o=>o.status!=='Cancelled');const byUnit=(rows)=>{const sums={};rows.forEach(x=>{const u=x.u||'QTL';sums[u]=(sums[u]||0)+Number(x.q||0)});return Object.entries(sums).map(([u,q])=>qt(q,u)).join(' · ')||'0'};$('mOrdered').textContent=byUnit(active.flatMap(o=>o.lines.map(l=>({q:l.qty,u:lt(l)}))));$('mBalance').textContent=byUnit(active.flatMap(o=>o.lines.map(l=>({q:Math.max(0,l.qty-orderLineSold(o.no,l.productCode,lt(l))),u:lt(l)}))));$('saleSO').innerHTML='<option value="">Select open order</option>'+active.filter(o=>orderStatus(o)==='Ongoing').map(o=>`<option value="${esc(o.no)}">${esc(o.no)} · ${esc(o.party)} · ${o.lines.map(l=>qt(Math.max(0,l.qty-orderLineSold(o.no,l.productCode,lt(l))),lt(l))).join(' + ')}</option>`).join('');if($('saleSO').value)loadSaleLines()};
  normalize();
})();

(function(){
  const nav=document.querySelector('.erpSidebarNav');
  if(!nav)return;
  nav.querySelectorAll('.nav-group[data-group]').forEach(group=>{
    const title=group.querySelector(':scope > .nav-title');
    const items=group.querySelector(':scope > .nav-items');
    if(!title||!items||title.dataset.bound==='1')return;
    title.dataset.bound='1';
    title.addEventListener('click',e=>{
      e.preventDefault();
      const closed=!group.classList.contains('is-collapsed');
      group.classList.toggle('is-collapsed',closed);
      title.setAttribute('aria-expanded',closed?'false':'true');
      items.setAttribute('aria-hidden',closed?'true':'false');
      try{localStorage.setItem('salesdesk_sidebar_'+group.dataset.group,closed?'closed':'open')}catch(_){}
    });
    let closed=false;
    try{closed=localStorage.getItem('salesdesk_sidebar_'+group.dataset.group)==='closed'}catch(_){}
    group.classList.toggle('is-collapsed',closed);
    title.setAttribute('aria-expanded',closed?'false':'true');
    items.setAttribute('aria-hidden',closed?'true':'false');
  });
})();
