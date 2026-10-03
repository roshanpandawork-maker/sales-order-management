// ERP layer: Inventory, Invoices (GST), Payments, Reports. Uses globals from app.js (db, supabaseClient, esc, money, fmt, opts, render).
(function(){
"use strict";
const $=id=>document.getElementById(id);
const E={pay:[],led:[],on:false,loading:false,err:'',gst:5};
const SECS=['dashboard','orders','sales','parties','products','balances','inventory','invoices','payments','reports'];
const pn=c=>db.products.find(p=>p.code===c)?.name||c;
const tbl=(h,r)=>`<div class="tablewrap"><table><thead><tr>${h.map(x=>'<th>'+x+'</th>').join('')}</tr></thead><tbody>${r.join('')||'<tr><td class="empty" colspan="'+h.length+'">No records</td></tr>'}</tbody></table></div>`;
const row=c=>'<tr>'+c.map(x=>'<td>'+x+'</td>').join('')+'</tr>';
window.showTab=function(t){document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===t));SECS.forEach(x=>$(x).classList.toggle('hidden',x!==t));if(t==='orders'&&!$('orderLines').children.length)addOrderLine()};
async function loadERP(){
  if(E.loading)return;E.loading=true;
  const a=await supabaseClient.from('payments').select('*'),b=await supabaseClient.from('stock_ledger').select('*');
  E.err=(a.error||b.error)?(a.error||b.error).message:'';if(!E.err){E.pay=a.data;E.led=b.data}
  E.on=true;E.loading=false;draw();
}
const _r=window.render;
window.render=function(){_r();if(!E.on)loadERP();else draw()};
function invoices(){
  const m={};
  db.sales.filter(s=>s.invoice).forEach(s=>{const i=m[s.invoice]??={no:s.invoice,date:s.date,party:s.party,pc:s.partyCode,so:s.so,amt:0,rows:[]};i.amt+=s.qty*s.rate;i.rows.push(s)});
  return Object.values(m).map(i=>{i.gst=i.amt*E.gst/100;i.total=i.amt+i.gst;i.paid=E.pay.filter(p=>p.invoice_no===i.no).reduce((a,p)=>a+Number(p.amount),0);i.due=i.total-i.paid;return i});
}
function stock(){
  const m={};db.products.forEach(p=>m[p.code]=0);
  E.led.forEach(l=>m[l.product_code]=(m[l.product_code]||0)+Number(l.qty));
  db.sales.forEach(s=>m[s.productCode]=(m[s.productCode]||0)-Number(s.qty));return m;
}
function draw(){
  if(!E.on||!db)return;
  if(E.err){['inventory','invoices','payments','reports'].forEach(s=>$(s).innerHTML='<div class="panel"><div class="emptybox">Run supabase/03_erp_schema.sql first.<br>'+esc(E.err)+'</div></div>');return}
  const st=stock(),pend={};
  db.orders.filter(o=>o.status!=='Cancelled').forEach(o=>o.lines.forEach(l=>pend[l.productCode]=(pend[l.productCode]||0)+Math.max(0,l.qty-orderLineSold(o.no,l.productCode))));
  $('inventory').innerHTML=`<div class="panel"><h2>Stock entry</h2><form id="erpStock"><div class="grid"><div class="field"><label>Product *</label><select id="stP" required>${opts(db.products,'Select product')}</select></div><div class="field"><label>Type</label><select id="stK"><option>Opening</option><option>Receipt</option><option>Adjustment</option></select></div><div class="field"><label>Quantity * (negative = stock out)</label><input id="stQ" type="number" step=".001" required></div><div class="field"><label>Note</label><input id="stN"></div></div><div class="actions"><button class="primary">Save entry</button></div></form></div>
  <div class="panel"><h2>Stock on hand <span class="tag">ledger minus dispatches</span></h2>${tbl(['Code','Product','Unit','On hand','Pending SO qty','Check'],db.products.map(p=>row([esc(p.code),'<b>'+esc(p.name)+'</b>',esc(p.unit),fmt(st[p.code]),fmt(pend[p.code]||0),(st[p.code]<(pend[p.code]||0))?'<span class="pill warn">Short</span>':'<span class="pill">OK</span>'])))}</div>
  <div class="panel"><h2>Recent stock ledger</h2>${tbl(['Date','Product','Type','Qty','Note'],[...E.led].sort((a,b)=>b.id-a.id).slice(0,20).map(l=>row([esc(l.date),esc(pn(l.product_code)),esc(l.kind),fmt(l.qty),esc(l.note||'')])))}</div>`;
  const inv=invoices().sort((a,b)=>String(b.date).localeCompare(a.date));
  $('invoices').innerHTML=`<div class="panel"><h2>Invoices <span class="tag">built from dispatches that have an invoice no.</span></h2><div class="filters"><label style="margin:0">GST %</label><input id="gstRate" type="number" min="0" step=".1" value="${E.gst}" style="max-width:90px"></div>${tbl(['Invoice','Date','Party','SO','Amount','GST','Total','Paid','Due','Status',''],inv.map(i=>row([`<b>${esc(i.no)}</b>`,esc(i.date),esc(i.party),esc(i.so),money(i.amt),money(i.gst),money(i.total),money(i.paid),`<b>${money(i.due)}</b>`,i.due<=.005?'<span class="pill">Paid</span>':i.paid>0?'<span class="pill warn">Part paid</span>':'<span class="pill open">Unpaid</span>',`<button class="secondary btnsm" data-print="${esc(i.no)}">Print</button>`])))}</div>`;
  const dues=inv.filter(i=>i.due>.005);
  $('payments').innerHTML=`<div class="panel"><h2>Record payment received</h2><form id="erpPay"><div class="grid"><div class="field"><label>Invoice *</label><select id="pyI" required><option value="">Select invoice</option>${dues.map(i=>`<option value="${esc(i.no)}">${esc(i.no)} · ${esc(i.party)} · due ${money(i.due)}</option>`).join('')}</select></div><div class="field"><label>Date *</label><input id="pyD" type="date" value="${today}" required></div><div class="field"><label>Amount (₹) *</label><input id="pyA" type="number" min="0.01" step=".01" required></div><div class="field"><label>Mode</label><select id="pyM"><option>Bank</option><option>Cash</option><option>UPI</option><option>Cheque</option></select></div><div class="field"><label>Reference</label><input id="pyR"></div></div><div class="actions"><button class="primary">Save payment</button></div></form></div>
  <div class="panel"><h2>Payment register</h2>${tbl(['Receipt','Date','Party','Invoice','Amount','Mode','Ref',''],[...E.pay].sort((a,b)=>String(b.date).localeCompare(a.date)).map(p=>row([`<b>${esc(p.receipt_no||'')}</b>`,esc(p.date),esc(db.parties.find(x=>x.code===p.party_code)?.name||p.party_code||''),esc(p.invoice_no||''),money(p.amount),esc(p.mode||''),esc(p.ref||''),`<button class="danger btnsm" data-delpay="${esc(p.id)}">Delete</button>`])))}</div>`;
  const byP={},byI={},age={};
  db.sales.forEach(s=>{byP[s.party]=(byP[s.party]||0)+s.qty*s.rate;byI[s.productCode]=(byI[s.productCode]||{q:0,v:0});byI[s.productCode].q+=s.qty;byI[s.productCode].v+=s.qty*s.rate});
  dues.forEach(i=>{const d=Math.floor((Date.now()-new Date(i.date))/864e5),a=age[i.party]??=[0,0,0];a[d<=30?0:d<=60?1:2]+=i.due});
  $('reports').innerHTML=`<div class="panel"><h2>Receivables ageing</h2>${tbl(['Party','0-30 days','31-60 days','61+ days','Total due'],Object.entries(age).map(([k,a])=>row([esc(k),money(a[0]),money(a[1]),money(a[2]),`<b>${money(a[0]+a[1]+a[2])}</b>`])))}</div>
  <div class="panel"><h2>Sales by party</h2>${tbl(['Party','Sales value'],Object.entries(byP).sort((a,b)=>b[1]-a[1]).map(([k,v])=>row([esc(k),money(v)])))}</div>
  <div class="panel"><h2>Sales by product</h2>${tbl(['Product','Qty','Value'],Object.entries(byI).map(([k,v])=>row([esc(pn(k)),fmt(v.q),money(v.v)])))}</div>`;
}
async function reload(){E.on=false;E.loading=false;await loadERP()}
document.addEventListener('input',e=>{if(e.target.id==='gstRate'){E.gst=Number(e.target.value)||0;draw();$('gstRate').focus()}});
document.addEventListener('submit',async e=>{
  const f=e.target.id;
  if(f==='erpStock'){e.preventDefault();const {error}=await supabaseClient.from('stock_ledger').insert({product_code:$('stP').value,kind:$('stK').value,qty:Number($('stQ').value),note:$('stN').value});if(error)return alert(error.message);await reload()}
  if(f==='erpPay'){e.preventDefault();const i=invoices().find(x=>x.no===$('pyI').value),amt=Number($('pyA').value);
    if(!i||!(amt>0))return alert('Choose an invoice and amount.');if(amt>i.due+.005)return alert('Amount exceeds due '+money(i.due));
    const {data:rn,error:e1}=await supabaseClient.rpc('next_number',{p:'RCT'});if(e1)return alert(e1.message);
    const {error}=await supabaseClient.from('payments').insert({receipt_no:rn,date:$('pyD').value,party_code:i.pc,invoice_no:i.no,amount:amt,mode:$('pyM').value,ref:$('pyR').value});
    if(error)return alert(error.message);await reload()}
});
document.addEventListener('click',async e=>{
  const p=e.target.closest('[data-print]'),d=e.target.closest('[data-delpay]');
  if(p){const i=invoices().find(x=>x.no===p.dataset.print);if(!i)return;let a=$('printArea');if(!a){a=document.createElement('div');a.id='printArea';document.body.appendChild(a)}
    a.innerHTML=`<h2>Tax Invoice ${esc(i.no)}</h2><p>Date: ${esc(i.date)} · SO: ${esc(i.so)}<br>Party: <b>${esc(i.party)}</b></p>`+tbl(['Product','Qty','Rate','Value'],i.rows.map(s=>row([esc(pn(s.productCode)),fmt(s.qty),money(s.rate),money(s.qty*s.rate)])))+`<p>Amount ${money(i.amt)} · GST @${E.gst}% ${money(i.gst)} · <b>Total ${money(i.total)}</b></p>`;window.print()}
  if(d&&confirm('Delete this payment? (admin only)')){const {error}=await supabaseClient.from('payments').delete().eq('id',d.dataset.delpay);if(error)return alert(error.message);await reload()}
});
window.ERP={E,invoices,stock};
})();