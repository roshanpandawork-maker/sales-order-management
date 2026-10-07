const SD_CFG=window.SALESDESK_CONFIG;
const supabaseClient=window.supabase.createClient(SD_CFG.SUPABASE_URL,SD_CFG.SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true}});
window.supabaseClient=supabaseClient;
const $=id=>document.getElementById(id),today=new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,10);
let db={parties:[],products:[],orders:[],sales:[],payments:[],invoices:[]};
const TABLES=['parties','products','orders','sales','payments','invoices'],PK={parties:'code',products:'code',orders:'no',sales:'id',payments:'id',invoices:'id'};
// The UI uses db.invoices, while Supabase stores them in sales_invoices.
const DB_TABLE={invoices:'sales_invoices'};
let prev={},chain=Promise.resolve();
function setTag(t){const e=$('syncTag');if(e)e.textContent=t}
async function load(){
  for(const t of TABLES){
    const {data,error}=await supabaseClient.from(DB_TABLE[t]||t).select('*');
    if(error){setTag('Not connected');alert('Could not load "'+t+'" from Supabase: '+error.message);return false}
    db[t]=data||[];prev[t]={};db[t].forEach(r=>prev[t][r[PK[t]]]=JSON.stringify(r));
  }
  setTag('Supabase connected');return true;
}
async function doSync(){
  setTag('Saving…');
  for(const t of TABLES){
    const k=PK[t],old=prev[t]||{},now={};
    db[t].forEach(r=>now[r[k]]=JSON.stringify(r));
    const up=db[t].filter(r=>old[r[k]]!==now[r[k]]);
    const del=Object.keys(old).filter(x=>!(x in now));
    if(up.length){const {error}=await supabaseClient.from(DB_TABLE[t]||t).upsert(up);if(error){setTag('Save failed');alert('Save failed ('+t+'): '+error.message);return}}
    if(del.length>10&&!confirm('This will permanently delete '+del.length+' records from "'+t+'". Continue?')){await load();render();setTag('Cancelled');return}
    if(del.length){const {error}=await supabaseClient.from(DB_TABLE[t]||t).delete().in(k,del);if(error){setTag('Save failed');alert('Delete failed ('+t+'): '+error.message);return}}
    prev[t]=now;
  }
  setTag('Supabase connected · saved');
}
function sync(){chain=chain.then(doSync).catch(e=>{setTag('Save failed');alert('Error: '+e.message)})}
const money=n=>'₹'+Number(n||0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2}),fmt=n=>Number(n||0).toLocaleString('en-IN',{maximumFractionDigits:3});
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function save(){render();sync()}
function id(prefix,arr,field){return prefix+String(Math.max(0,...arr.map(x=>parseInt(String(x[field]||'').replace(/\D/g,''))||0))+1).padStart(4,'0')}
function setPartyCode(){$('partyCode').value=id('PTY',db.parties,'code')}
function setProductCode(){$('productCode').value=id('PRD',db.products,'code')}
function setSO(){$('soNo').value=id('SO',db.orders,'no')}
function showTab(t){document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===t));['dashboard','orders','sales','parties','products','balances','invoices','payments','reports','purchase','inventory','quotations','priceboard','financeCenter','requests','approvals','notifications','auditCenter'].forEach(x=>$(x).classList.toggle('hidden',x!==t));if(t==='orders'&&!$('orderLines').children.length)addOrderLine()}
document.querySelectorAll('.tab').forEach(b=>b.addEventListener('click',()=>showTab(b.dataset.tab)));
function opts(arr,placeholder){return `<option value="">${placeholder}</option>`+arr.map(x=>`<option value="${esc(x.code)}">${esc(x.name)}</option>`).join('')}
$('partyForm').onsubmit=e=>{e.preventDefault();let name=$('partyName').value.trim();if(db.parties.some(p=>p.name.toLowerCase()===name.toLowerCase()))return alert('Party already exists.');db.parties.push({code:$('partyCode').value,name,contact:$('partyContact').value,phone:$('partyPhone').value,gst:$('partyGST').value.toUpperCase(),address:$('partyAddress').value});save();e.target.reset();setPartyCode();alert('Party added successfully.')};
$('productForm').onsubmit=e=>{e.preventDefault();let name=$('productName').value.trim();if(db.products.some(p=>p.name.toLowerCase()===name.toLowerCase()))return alert('Product already exists.');db.products.push({code:$('productCode').value,name,unit:$('productUnit').value,rate:Number($('productRate').value||0),hsn:$('productHSN').value.trim(),gst_rate:Number($('productGST').value||0)});save();e.target.reset();setProductCode();$('productGST').value=0;alert('Product added successfully.')};
function addOrderLine(){let tr=document.createElement('tr');tr.innerHTML=`<td><select class="ol-product" required>${opts(db.products,'Choose product')}</select></td><td class="ol-unit">—</td><td><input class="ol-qty" type="number" min=".001" step=".001" placeholder="0" required></td><td><input class="ol-rate" type="number" min="0" step=".01" placeholder="0.00" title="Enter the customer-agreed rate including GST"></td><td class="ol-value">₹0.00</td><td><button type="button" class="danger btnsm" data-act="removeLine">Remove</button></td>`;$('orderLines').appendChild(tr);tr.querySelector('.ol-product').onchange=()=>{let p=db.products.find(x=>x.code===tr.querySelector('.ol-product').value);tr.querySelector('.ol-unit').textContent=p?.unit||'—';tr.querySelector('.ol-rate').value=p?.rate||0;calcOrder()};tr.querySelectorAll('input').forEach(i=>i.oninput=calcOrder)}
function calcOrder(){let total=0;[...$('orderLines').rows].forEach(r=>{let v=Number(r.querySelector('.ol-qty').value||0)*Number(r.querySelector('.ol-rate').value||0);r.querySelector('.ol-value').textContent=money(v);total+=v});$('orderTotal').textContent=money(total)}
function resetOrder(){setSO();$('soDate').value=today;$('orderLines').innerHTML='';addOrderLine();calcOrder()}
// Sales Order interaction is owned by js/ui.js to keep one authoritative implementation.

function orderLineSold(no,code){return db.sales.filter(s=>s.so===no&&s.productCode===code).reduce((a,s)=>a+Number(s.qty),0)}
function orderStatus(o){if(o.status==='Cancelled')return'Cancelled';return o.lines.every(l=>l.qty-orderLineSold(o.no,l.productCode)<=.000001)?'Closed':'Ongoing'}
function orderQty(o){return o.lines.reduce((a,l)=>a+l.qty,0)}function orderSold(o){return o.lines.reduce((a,l)=>a+orderLineSold(o.no,l.productCode),0)}function orderValue(o){return o.lines.reduce((a,l)=>a+l.qty*l.rate,0)}
$('saleSO').onchange=loadSaleLines;
function loadSaleLines(){let o=db.orders.find(x=>x.no===$('saleSO').value);$('saleParty').value=o?.party||'';$('saleLines').innerHTML='';if(!o){$('saleLines').innerHTML='<tr><td colspan="8" class="empty">Select an SO to load its products.</td></tr>';$('saleHint').textContent='Choose an SO to load items';calcSale();return}o.lines.forEach(l=>{let p=db.products.find(x=>x.code===l.productCode),sold=orderLineSold(o.no,l.productCode),bal=l.qty-sold,tr=document.createElement('tr');tr.dataset.code=l.productCode;tr.innerHTML=`<td>${esc(p?.name||l.productCode)}</td><td>${esc(p?.unit||'')}</td><td>${fmt(l.qty)}</td><td>${fmt(sold)}</td><td class="available">${fmt(bal)}</td><td><input class="sl-qty" type="number" min="0" max="${bal}" step=".001" placeholder="0" ${bal<=0?'disabled':''}></td><td><input class="sl-rate" type="number" min="0" step=".01" value="${esc(l.rate)}" title="Rate from sales order (including GST)"></td><td class="sl-value">${money(0)}</td>`;tr.querySelectorAll('input').forEach(i=>i.oninput=calcSale);$('saleLines').appendChild(tr)});$('saleHint').textContent=o.no+' · '+o.party;calcSale()}
function calcSale(){let total=0;[...$('saleLines').rows].forEach(r=>{let q=Number(r.querySelector('.sl-qty')?.value||0),rate=Number(r.querySelector('.sl-rate')?.value||0),v=q*rate;r.querySelector('.sl-value').textContent=money(v);total+=v});$('saleTotal').textContent=money(total)}
function clearSaleLines(){$('saleParty').value='';$('saleLines').innerHTML='<tr><td colspan="8" class="empty">Select an SO to load its products.</td></tr>';$('saleHint').textContent='Choose an SO to load items';$('saleDate').value=today;calcSale()}
// Dispatch interaction is owned by js/ui.js to keep one authoritative implementation.

function pill(s){return `<span class="pill ${s==='Ongoing'?'open':s==='Cancelled'?'cancel':''}">${s}</span>`}
function trRows(id,arr,fn,span=8){$(id).innerHTML=arr.length?arr.map(x=>'<tr>'+fn(x)+'</tr>').join(''):`<tr><td colspan="${span}" class="empty">No records found</td></tr>`}
function render(){let partyOpts=opts(db.parties,'Select party');$('soParty').innerHTML=partyOpts;$('partyList').innerHTML=db.parties.map(p=>`<option value="${esc(p.name)}">`).join('');$('partyOptions')?.replaceChildren();
let oq=($('orderSearch')?.value||'').toLowerCase(),os=$('orderStatus')?.value||'',orders=[...db.orders].reverse();
trRows('orderRows',orders.filter(o=>(!oq||(o.no+' '+o.party+' '+o.lines.map(l=>db.products.find(p=>p.code===l.productCode)?.name).join(' ')).toLowerCase().includes(oq))&&(!os||orderStatus(o)===os)),o=>`<td><b>${esc(o.no)}</b></td><td>${esc(o.date)}</td><td>${esc(o.party)}</td><td>${o.lines.length}</td><td>${fmt(orderQty(o))}</td><td>${fmt(orderSold(o))}</td><td><b>${fmt(orderQty(o)-orderSold(o))}</b></td><td>${money(orderValue(o))}</td><td>${pill(orderStatus(o))}</td><td><button class="secondary btnsm" data-act="editOrder" data-arg="${esc(o.no)}">Edit</button> <button class="secondary btnsm" data-act="toggleCancel" data-arg="${esc(o.no)}">${o.status==='Cancelled'?'Reopen':'Cancel'}</button></td>`,10);
trRows('dashRows',orders.slice(0,8),o=>`<td><b>${esc(o.no)}</b></td><td>${esc(o.date)}</td><td>${esc(o.party)}</td><td>${o.lines.length}</td><td>${fmt(orderQty(o))}</td><td>${fmt(orderSold(o))}</td><td>${fmt(orderQty(o)-orderSold(o))}</td><td>${pill(orderStatus(o))}</td>`,8);
let sq=($('salesSearch')?.value||'').toLowerCase();
let sfParty=$('salesFilterParty')?.value||'',sfProduct=$('salesFilterProduct')?.value||'',sfFrom=$('salesFilterFrom')?.value||'',sfTo=$('salesFilterTo')?.value||'',sfSO=($('salesFilterSO')?.value||'').toLowerCase(),sfInvoice=($('salesFilterInvoice')?.value||'').toLowerCase();
if($('salesFilterParty')){const pv=$('salesFilterParty').value;$('salesFilterParty').innerHTML='<option value="">All parties</option>'+db.parties.map(p=>`<option value="${esc(p.code)}">${esc(p.name)}</option>`).join('');$('salesFilterParty').value=pv||sfParty}
if($('salesFilterProduct')){const pv=$('salesFilterProduct').value;$('salesFilterProduct').innerHTML='<option value="">All products</option>'+db.products.map(p=>`<option value="${esc(p.code)}">${esc(p.name)}</option>`).join('');$('salesFilterProduct').value=pv||sfProduct}
sfParty=$('salesFilterParty')?.value||'';sfProduct=$('salesFilterProduct')?.value||'';
let sales=[...db.sales].reverse();
sales=sales.filter(s=>{
  const pname=(db.products.find(p=>p.code===s.productCode)?.name||s.productCode);
  return (!sq||(s.so+' '+s.party+' '+s.invoice+' '+pname).toLowerCase().includes(sq))
    &&(!sfParty||s.partyCode===sfParty)
    &&(!sfProduct||s.productCode===sfProduct)
    &&(!sfFrom||s.date>=sfFrom)
    &&(!sfTo||s.date<=sfTo)
    &&(!sfSO||(s.so||'').toLowerCase().includes(sfSO))
    &&(!sfInvoice||(s.invoice||'').toLowerCase().includes(sfInvoice));
});
trRows('salesRows',sales,s=>`<td>${esc(s.date)}</td><td>${esc(s.so)}</td><td>${esc(s.party)}</td><td>${esc(s.invoice)}</td><td>${esc(db.products.find(p=>p.code===s.productCode)?.name||s.productCode)}</td><td>${fmt(s.qty)}</td><td>${money(s.rate)}</td><td>${money(s.qty*s.rate)}</td><td><button class="secondary btnsm" data-act="editSale" data-arg="${esc(s.id)}">Edit</button> <button class="danger btnsm" data-act="removeSale" data-arg="${esc(s.id)}">Delete</button></td>`,9);
let pm=($('partyMasterSearch')?.value||'').toLowerCase();trRows('partyMasterRows',db.parties.filter(p=>(p.name+' '+p.code+' '+(p.phone||'')).toLowerCase().includes(pm)),p=>`<td>${esc(p.code)}</td><td><b>${esc(p.name)}</b></td><td>${esc(p.contact)}</td><td>${esc(p.phone)}</td><td>${esc(p.gst)}</td><td><button class="secondary btnsm" data-act="editParty" data-arg="${esc(p.code)}">Edit</button> <button class="danger btnsm" data-act="deleteParty" data-arg="${esc(p.code)}">Remove</button></td><td><div style="display:flex;gap:6px;flex-wrap:wrap"><button class="secondary btnsm" data-act="partyLiveLink" data-arg="${esc(p.code)}">Generate / Copy</button><button class="primary btnsm" data-act="partyLiveWhatsApp" data-arg="${esc(p.code)}">WhatsApp</button></div></td>`,7);
let pr=($('productSearch')?.value||'').toLowerCase();trRows('productRows',db.products.filter(p=>(p.name+' '+p.code).toLowerCase().includes(pr)),p=>`<td>${esc(p.code)}</td><td><b>${esc(p.name)}</b></td><td>${esc(p.unit)}</td><td>${money(p.rate)}</td><td>${esc(p.hsn||'')}</td><td>${fmt(p.gst_rate||0)}%</td><td><button class="secondary btnsm" data-act="editProduct" data-arg="${esc(p.code)}">Edit</button> <button class="danger btnsm" data-act="deleteProduct" data-arg="${esc(p.code)}">Remove</button></td>`,7);
let active=db.orders.filter(o=>o.status!=='Cancelled');$('mOrders').textContent=db.orders.length;$('mOpen').textContent=active.filter(o=>orderStatus(o)==='Ongoing').length;$('mOrdered').textContent=fmt(active.reduce((a,o)=>a+orderQty(o),0))+' QTL';$('mBalance').textContent=fmt(active.reduce((a,o)=>a+o.lines.reduce((b,l)=>b+Math.max(0,l.qty-orderLineSold(o.no,l.productCode)),0),0))+' QTL';
$('saleSO').innerHTML='<option value="">Select open order</option>'+db.orders.filter(o=>o.status!=='Cancelled'&&orderStatus(o)==='Ongoing').map(o=>`<option value="${esc(o.no)}">${esc(o.no)} · ${esc(o.party)} · ${fmt(orderQty(o)-orderSold(o))} QTL left</option>`).join('');if($('saleSO').value)loadSaleLines()}
function toggleCancel(no){let o=db.orders.find(x=>x.no===no);if(o.status==='Cancelled')o.status='Ongoing';else{if(!confirm('Cancel this SO? Existing dispatch history will be retained.'))return;o.status='Cancelled'}save()}
function removeSale(id){if(!confirm('Delete this dispatch line? The available balance will recalculate.'))return;db.sales=db.sales.filter(s=>s.id!==id);save()}

async function partyLiveLink(code){try{const r=await supabaseClient.rpc('create_party_public_link',{p_party_code:code});if(r.error)throw r.error;const slug=r.data.public_slug;const url=new URL('customer.html',location.href);url.searchParams.set('c',slug);const link=url.toString();try{await navigator.clipboard.writeText(link)}catch(e){};alert('Customer portal link copied:\\n'+link)}catch(e){alert('Could not create customer link: '+(e.message||e))}}
async function partyLiveWhatsApp(code){try{const r=await supabaseClient.rpc('create_party_public_link',{p_party_code:code});if(r.error)throw r.error;const slug=r.data.public_slug;const url=new URL('customer.html',location.href);url.searchParams.set('c',slug);const p=db.parties.find(x=>x.code===code);const msg='Hello '+(p?.name||'Customer')+',\\n\\nYour SalesDesk customer portal is ready. View today\\'s prices, your orders, balances and quotations here:\\n'+url.toString();window.open('https://wa.me/'+String(p?.phone||'').replace(/\\D/g,'')+'?text='+encodeURIComponent(msg),'_blank','noopener')}catch(e){alert('Could not create customer link: '+(e.message||e))}}
function deleteParty(code){if(db.orders.some(o=>o.partyCode===code))return alert('This party has order history and cannot be removed.');if(confirm('Remove this party?')){db.parties=db.parties.filter(p=>p.code!==code);save()}}
function deleteProduct(code){if(db.orders.some(o=>o.lines.some(l=>l.productCode===code)))return alert('This product is used in an order and cannot be removed.');if(confirm('Remove this product?')){db.products=db.products.filter(p=>p.code!==code);save()}}
function renderBalances(){let q=$('balanceSearch').value.trim().toLowerCase(),p=db.parties.find(x=>x.name.toLowerCase()===q||x.code.toLowerCase()===q);if(!p){$('balanceDetail').innerHTML='<div class="emptybox">Select an exact party name from the suggestions to view its balances.</div>';return}let orders=db.orders.filter(o=>o.partyCode===p.code&&o.status!=='Cancelled'),map={};orders.forEach(o=>o.lines.forEach(l=>{let k=l.productCode;map[k]??={ordered:0,sold:0,rate:l.rate,unit:(db.products.find(x=>x.code===k)?.unit||'')};map[k].ordered+=l.qty;map[k].sold+=orderLineSold(o.no,k);map[k].rate=l.rate}));let items=Object.entries(map);$('balanceDetail').innerHTML=`<div class="partycard"><h3>${esc(p.name)} <span class="tag">${esc(p.code)}</span></h3><div class="muted small">${esc(p.phone||'')} ${p.gst?' · GSTIN '+esc(p.gst):''}</div><div class="partygrid" style="margin-top:12px"><div><small>Active orders</small><b>${orders.filter(o=>orderStatus(o)==='Ongoing').length}</b></div><div><small>Total ordered</small><b>${fmt(orders.reduce((a,o)=>a+orderQty(o),0))} QTL</b></div><div><small>Outstanding</small><b>${fmt(items.reduce((a,[,v])=>a+Math.max(0,v.ordered-v.sold),0))} QTL</b></div></div></div><div class="tablewrap"><table><thead><tr><th>Product</th><th>Unit</th><th>Ordered</th><th>Sold</th><th>Available balance</th><th>Last SO rate</th><th>Balance value*</th></tr></thead><tbody>${items.map(([k,v])=>`<tr><td>${esc(db.products.find(x=>x.code===k)?.name||k)}</td><td>${esc(v.unit)}</td><td>${fmt(v.ordered)}</td><td>${fmt(v.sold)}</td><td><b>${fmt(v.ordered-v.sold)}</b></td><td>${money(v.rate)}</td><td>${money(Math.max(0,v.ordered-v.sold)*v.rate)}</td></tr>`).join('')||'<tr><td colspan="7" class="empty">No active order history for this party.</td></tr>'}</tbody></table></div><p class="small muted">*Indicative balance value uses the latest encountered SO rate for each product; actual order-line rates remain recorded individually.</p>`}
$('balanceSearch').addEventListener('input',()=>{if(db.parties.some(p=>p.name.toLowerCase()===$('balanceSearch').value.trim().toLowerCase()))renderBalances()});
['orderSearch','orderStatus','salesSearch','partyMasterSearch','productSearch','salesFilterParty','salesFilterProduct','salesFilterFrom','salesFilterTo','salesFilterSO','salesFilterInvoice'].forEach(id=>$(id)?.addEventListener('input',render));
$('salesMoreFilters')?.addEventListener('click',()=>{const e=$('salesAdvancedFilters');e.classList.toggle('hidden');$('salesMoreFilters').textContent=e.classList.contains('hidden')?'More Filters ▾':'Hide Filters ▴'});
$('salesClearFilters')?.addEventListener('click',()=>{['salesFilterParty','salesFilterProduct','salesFilterFrom','salesFilterTo','salesFilterSO','salesFilterInvoice'].forEach(id=>{const e=$(id);if(e)e.value=''});render()});
function backup(){let blob=new Blob([JSON.stringify(db,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='salesdesk-backup.json';a.click();URL.revokeObjectURL(a.href)}
function restore(e){
  const f=e.target.files[0];e.target.value='';if(!f)return;
  if(f.size>5*1024*1024)return alert('Backup file is too large (max 5 MB).');
  const r=new FileReader();
  r.onload=()=>{try{
    const x=JSON.parse(r.result),ID=/^[A-Za-z0-9_-]{1,40}$/,num=v=>Number.isFinite(Number(v));
    const clean={};
    for(const t of TABLES){
      if(!Array.isArray(x[t])||x[t].length>20000)throw Error('Bad table '+t);
      clean[t]=x[t].map(row=>{
        if(!row||typeof row!=='object'||Array.isArray(row))throw Error('Bad row in '+t);
        if(!ID.test(String(row[PK[t]]??'')))throw Error('Bad ID in '+t);
        for(const k of ['qty','rate'])if(k in row&&!num(row[k]))throw Error('Bad number in '+t);
        if(t==='orders'&&(!Array.isArray(row.lines)||row.lines.some(l=>!l||!ID.test(String(l.productCode))||!num(l.qty)||!num(l.rate))))throw Error('Bad order lines');
        return row;
      });
    }
    if(prompt('This REPLACES all data and deletes records not in the file.\nA backup of current data will download first.\nType REPLACE to continue.')!=='REPLACE')return;
    backup();db=clean;save();alert('Backup imported.');
  }catch(err){alert('Invalid backup file: '+err.message)}};
  r.readAsText(f);
}
function csv(v){return '"'+String(v??'').replace(/"/g,'""')+'"'}
function exportCSV(){let lines=['TYPE,RECORD_ID,DATE,PARTY,SO_NO,PRODUCT,QUANTITY,UNIT,RATE,VALUE,INVOICE,STATUS'];db.orders.forEach(o=>o.lines.forEach(l=>lines.push(['ORDER',o.no,o.date,o.party,o.no,db.products.find(p=>p.code===l.productCode)?.name||l.productCode,l.qty,db.products.find(p=>p.code===l.productCode)?.unit,l.rate,l.qty*l.rate,'',orderStatus(o)].map(csv).join(','))));db.sales.forEach(s=>lines.push(['SALE',s.id,s.date,s.party,s.so,db.products.find(p=>p.code===s.productCode)?.name||s.productCode,s.qty,db.products.find(p=>p.code===s.productCode)?.unit,s.rate,s.qty*s.rate,s.invoice,''].map(csv).join(',')));let blob=new Blob([lines.join('\r\n')],{type:'text/csv;charset=utf-8;'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='salesdesk-register.csv';a.click();URL.revokeObjectURL(a.href)}
function closeModal(){$('modal').classList.add('hidden')}
function openModal(title,body,onSave){
  $('mbox').innerHTML='<h2 style="margin:0 0 12px">'+title+'</h2><div>'+body+'</div><div class="actions"><button class="primary" id="mSave">Save changes</button><button class="secondary" data-act="closeModal">Cancel</button></div>';
  $('modal').classList.remove('hidden');
  $('mSave').onclick=()=>{if(onSave()!==false)closeModal()};
}
const fld=(fid,label,val,type='text',extra='')=>`<div class="field" style="margin-bottom:10px"><label>${label}</label><input id="${fid}" type="${type}" value="${esc(val??'')}" ${extra}></div>`;
function editSale(sid){
  const s=db.sales.find(x=>x.id===sid);if(!s)return;
  openModal('Edit sale · '+esc(s.so)+' · '+esc(db.products.find(p=>p.code===s.productCode)?.name||s.productCode),
    fld('eDate','Date',s.date,'date')+fld('eInv','Invoice / dispatch no.',s.invoice)+fld('eQty','Quantity',s.qty,'number','step=".001" min="0"')+fld('eRate','Rate (₹)',s.rate,'number','step=".01" min="0"')+fld('eRem','Remarks',s.remarks),
    ()=>{
      const q=Number($('eQty').value),r=Number($('eRate').value||0);
      if(!(q>0)){alert('Quantity must be more than 0.');return false}
      const o=db.orders.find(x=>x.no===s.so),line=o?.lines.find(l=>l.productCode===s.productCode);
      if(line){const room=line.qty-(orderLineSold(s.so,s.productCode)-s.qty);if(q>room+1e-8){alert('Quantity exceeds the order balance. Maximum allowed: '+fmt(room));return false}}
      s.date=$('eDate').value;s.invoice=$('eInv').value.trim();s.qty=q;s.rate=r;s.remarks=$('eRem').value;
      save();
    });
}
function editOrder(no){
  const o=db.orders.find(x=>x.no===no);if(!o)return;
  const hasSales=db.sales.some(s=>s.so===no);
  const rows=o.lines.map((l,i)=>{const p=db.products.find(x=>x.code===l.productCode),gst=Number(l.gstRate??p?.gst_rate??0),ex=Number(l.rate||0)/(1+gst/100);return `<tr><td>${esc(p?.name||l.productCode)}</td><td>${fmt(orderLineSold(no,l.productCode))}</td><td><input class="eq" type="number" step=".001" min="0" value="${esc(l.qty)}"></td><td><input class="er" type="number" step=".01" min="0" value="${esc(l.rate)}"><small class="muted">Incl. GST · Ex GST ${money(ex)} · GST ${fmt(gst)}%</small></td></tr>`}).join('');
  const body='<div class="grid" style="grid-template-columns:1fr 1fr">'+fld('eDate','Order date',o.date,'date')+fld('eDue','Delivery due date',o.due,'date')+fld('eRef','Reference / PO no.',o.ref)+fld('eRem','Remarks',o.remarks)+'</div><div class="field" style="margin-bottom:10px"><label>Party '+(hasSales?'(locked because dispatch exists)':'')+'</label><select id="eParty" '+(hasSales?'disabled':'')+'>'+db.parties.map(p=>`<option value="${esc(p.code)}" ${p.code===o.partyCode?'selected':''}>${esc(p.name)}</option>`).join('')+'</select></div><div class="lines"><table style="min-width:420px"><thead><tr><th>Product</th><th>Already sold</th><th>Order qty</th><th>Rate (₹)</th></tr></thead><tbody>'+rows+'</tbody></table></div>';
  openModal('Edit sales order '+esc(no),body,()=>{
    const qs=[...document.querySelectorAll('#mbox .eq')],rs=[...document.querySelectorAll('#mbox .er')];
    for(let i=0;i<o.lines.length;i++){
      const q=Number(qs[i].value),sold=orderLineSold(no,o.lines[i].productCode);
      if(!(q>0)){alert('Quantity must be more than 0.');return false}
      if(q<sold-1e-8){alert('Order quantity cannot be less than the quantity already sold ('+fmt(sold)+').');return false}
    }
    o.lines.forEach((l,i)=>{l.qty=Number(qs[i].value);l.rate=Number(rs[i].value||0);const p=db.products.find(x=>x.code===l.productCode),gst=Number(l.gstRate??p?.gst_rate??0);l.gstRate=gst;l.rateExclGst=gst>0?l.rate/(1+gst/100):l.rate});o.price_includes_gst=true;
    o.date=$('eDate').value;o.due=$('eDue').value;o.ref=$('eRef').value;o.remarks=$('eRem').value;
    if(!hasSales){const p=db.parties.find(x=>x.code===$('eParty').value);if(p){o.partyCode=p.code;o.party=p.name}}
    save();
  });
}
function editParty(code){
  const p=db.parties.find(x=>x.code===code);if(!p)return;
  openModal('Edit party '+esc(code),fld('eName','Party name *',p.name)+fld('eContact','Contact person',p.contact)+fld('ePhone','Phone',p.phone)+fld('eGst','GSTIN',p.gst,'text','maxlength="15"')+fld('eAddr','Address',p.address),()=>{
    const name=$('eName').value.trim();
    if(!name){alert('Party name is required.');return false}
    if(db.parties.some(x=>x.code!==code&&x.name.toLowerCase()===name.toLowerCase())){alert('Another party already has this name.');return false}
    p.name=name;p.contact=$('eContact').value;p.phone=$('ePhone').value;p.gst=$('eGst').value.toUpperCase();p.address=$('eAddr').value;
    db.orders.filter(o=>o.partyCode===code).forEach(o=>o.party=name);
    db.sales.filter(x=>x.partyCode===code).forEach(x=>x.party=name);
    save();
  });
}
function editProduct(code){
  const p=db.products.find(x=>x.code===code);if(!p)return;
  const unit='<div class="field" style="margin-bottom:10px"><label>Unit</label><select id="eUnit">'+['QTL','KG','MT','PCS','BAG'].map(u=>`<option ${u===p.unit?'selected':''}>${u}</option>`).join('')+'</select></div>';
  openModal('Edit product '+esc(code),fld('eName','Product name *',p.name)+unit+fld('eRateP','Default rate (₹)',p.rate,'number','step=".01" min="0"')+'<div class="field" style="margin-bottom:10px"><label>HSN code</label><input id="eHsn" maxlength="8" value="'+esc(p.hsn||'')+'"></div>'+fld('eGstP','GST rate %',p.gst_rate||0,'number','step=".01" min="0" max="100"'),()=>{
    const name=$('eName').value.trim();
    if(!name){alert('Product name is required.');return false}
    if(db.products.some(x=>x.code!==code&&x.name.toLowerCase()===name.toLowerCase())){alert('Another product already has this name.');return false}
    p.name=name;p.unit=$('eUnit').value;p.rate=Number($('eRateP').value||0);p.hsn=$('eHsn').value.trim();p.gst_rate=Number($('eGstP').value||0);
    save();
  });
}
let started=false;
async function startApp(){
  if(started)return;started=true;
  const roleCheck=await supabaseClient.rpc('my_role');
  if(roleCheck.error){
    console.error('SalesDesk role check failed:',roleCheck.error);
    $('loginMsg').textContent='Could not verify your SalesDesk access. Please refresh and try again.';
    started=false;
    return;
  }
  if(!roleCheck.data){
    $('loginMsg').textContent='Your account is not authorised for SalesDesk. Contact the administrator.';
    await supabaseClient.auth.signOut();
    return;
  }
  $('loginBox').classList.add('hidden');SD_SECURITY.armIdleLogout(()=>logout());
  const ok=await load();
  $('soDate').value=today;$('saleDate').value=today;
  if(ok&&!db.products.length)db.products.push({code:'PRD0001',name:'Refined Rice Bran Oil',unit:'QTL',rate:0});
  setPartyCode();setProductCode();setSO();
  render();if(ok)sync();
  addOrderLine();
}
async function doLogin(e){
  e.preventDefault();$('loginMsg').textContent='';
  if(Date.now()<(window.__lockUntil||0))return $('loginMsg').textContent='Too many attempts. Wait 30 seconds.';
  const {error}=await supabaseClient.auth.signInWithPassword({email:$('loginEmail').value.trim(),password:$('loginPass').value});
  if(error){window.__fails=(window.__fails||0)+1;if(window.__fails>=5){window.__lockUntil=Date.now()+30000;window.__fails=0}$('loginMsg').textContent='Invalid email or password.';return}
  window.__fails=0;
  startApp();
}
async function logout(){await supabaseClient.auth.signOut();location.reload()}
(async()=>{
  const {data}=await supabaseClient.auth.getSession();
  if(data.session)startApp();
})();
function removeLine(el){el.closest('tr').remove();calcOrder()}
$('loginForm').addEventListener('submit',doLogin);
$('restoreFile').addEventListener('change',restore);
$('googleBtn').addEventListener('click',()=>supabaseClient.auth.signInWithOAuth({provider:'google',options:{redirectTo:location.origin+location.pathname}}));
