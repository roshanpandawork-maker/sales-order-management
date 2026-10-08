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
  $('orderForm').onsubmit=e=>{e.preventDefault();const lines=[...$('orderLines').rows].map(r=>{const productCode=r.querySelector('.ol-product').value,p=db.products.find(x=>x.code===productCode),rate=Number(r.querySelector('.ol-rate').value||0),gstRate=Number(p?.gst_rate||0);return {productCode,qtyType:r.querySelector('.ol-type').value,qty:Number(r.querySelector('.ol-qty').value),rate,gstRate,rateExclGst:gstRate>0?rate/(1+gstRate/100):rate}}).filter(x=>x.productCode&&x.qty>0);if(!lines.length)return alert('Add at least one valid product line.');if(lines.length!==$('orderLines').rows.length)return alert('Complete or remove blank product lines.');if(new Set(lines.map(x=>x.productCode+'|'+x.qtyType)).size!==lines.length)return alert('Each product + QTY TYPE should appear only once per SO.');const partyName=$('soParty').value.trim();const p=db.parties.find(x=>String(x.name||'').trim().toLowerCase()===partyName.toLowerCase());if(!p)return alert('Select a valid party from the party list.');db.orders.push({no:$('soNo').value,date:$('soDate').value,partyCode:p.code,party:p.name,due:$('soDue').value,ref:$('soRef').value,remarks:$('soRemarks').value,lines,status:'Ongoing',price_includes_gst:true});save();e.target.reset();resetOrder();alert('Sales order saved.')};
  window.orderLineSold=(no,code,type)=>db.sales.filter(s=>s.so===no&&s.productCode===code&&(!type||st(s)===type)).reduce((a,s)=>a+Number(s.qty),0);
  window.orderStatus=o=>o.status==='Cancelled'?'Cancelled':o.lines.every(l=>l.qty-orderLineSold(o.no,l.productCode,lt(l))<=.000001)?'Closed':'Ongoing';
  window.orderSold=o=>o.lines.reduce((a,l)=>a+orderLineSold(o.no,l.productCode,lt(l)),0);
  function getSaleParty(){
    const raw=String($('saleSO')?.value||'').trim();
    return db.parties.find(p=>String(p.name||'').trim().toLowerCase()===raw.toLowerCase()||String(p.code||'')===raw);
  }
  function openSalesOrdersForParty(party){
    return (db.orders||[]).filter(o=>o.partyCode===party?.code&&o.status!=='Cancelled'&&orderStatus(o)==='Ongoing');
  }
  function selectedSaleSOs(){
    return [...($('saleSOSelect')?.selectedOptions||[])].map(o=>o.value).filter(Boolean);
  }
  function populateSaleSOs(party,selectAll=true){
    const el=$('saleSOSelect'); if(!el)return;
    const orders=openSalesOrdersForParty(party);
    el.innerHTML=orders.map(o=>{
      const balance=Math.max(0,Number(orderQty(o)||0)-Number(orderSold(o)||0));
      return '<option value="'+esc(o.no)+'">'+esc(o.no)+' · '+esc(o.date||'')+' · '+esc(String(balance))+' '+esc((o.lines||[])[0]?.qtyType||'')+'</option>';
    }).join('');
    [...el.options].forEach(o=>o.selected=selectAll);
    const hint=$('saleSOSelectHint');
    if(hint)hint.textContent=orders.length?(selectAll?'All open SOs selected — you can remove/add SOs below.':'Select one or more open SOs.'):'No open SOs for this party.';
  }
  function renderDispatchLines(){
    const party=getSaleParty(), chosen=selectedSaleSOs();
    $('saleLines').innerHTML='';
    if(!party){$('saleLines').innerHTML='<tr><td colspan="8" class="empty">Select a valid party to load open Sales Orders.</td></tr>';$('saleHint').textContent='Choose a party';calcSale();return}
    if(!chosen.length){$('saleLines').innerHTML='<tr><td colspan="8" class="empty">Select at least one Sales Order above.</td></tr>';$('saleHint').textContent=party.name+' · No SO selected';calcSale();return}
    const selectedOrders=(db.orders||[]).filter(o=>chosen.includes(o.no)&&o.partyCode===party.code&&o.status!=='Cancelled');
    (db.products||[]).forEach(p=>{
      const sources=[];
      selectedOrders.forEach(o=>(o.lines||[]).forEach(l=>{
        if(String(l.productCode)!==String(p.code))return;
        const u=lt(l),sold=orderLineSold(o.no,l.productCode,u),bal=Math.max(0,Number(l.qty||0)-sold);
        if(bal>0)sources.push({so:o.no,balance:bal,rate:Number(l.rate||0),unit:u});
      }));
      const total=sources.reduce((n,x)=>n+x.balance,0);
      if(total<=0)return;
      const rates=[...new Set(sources.map(x=>x.rate))];
      const defaultRate=rates.length?rates[0]:Number(p.rate||0);
      const preview=sources.map(x=>esc(x.so)+' · '+fmt(x.balance)+' '+esc(x.unit)).join(' + ');
      const tr=document.createElement('tr');
      tr.dataset.code=p.code;tr.dataset.qtyType=p.unit||'QTL';tr.dataset.sources=JSON.stringify(sources);
      tr.innerHTML='<td><b>'+esc(p.name||p.code)+'</b><div class="small muted">'+esc(p.code)+'</div></td>'+
        '<td><span class="tag">'+esc(p.unit||'QTL')+'</span></td><td><b>'+fmt(total)+'</b></td><td>—</td><td><b>'+fmt(total)+'</b></td>'+
        '<td><input class="sl-qty" type="number" min="0" max="'+total+'" step=".001" placeholder="0"></td>'+
        '<td><input class="sl-rate" type="number" min="0" step=".01" value="'+esc(defaultRate)+'" title="Dispatch rate including GST"></td>'+
        '<td><span class="tag allocation-status" title="Allocation follows the selected SO order">'+preview+'</span></td>';
      tr.querySelectorAll('input').forEach(i=>i.oninput=calcSale);
      $('saleLines').appendChild(tr);
    });
    $('saleHint').textContent=party.name+' · '+chosen.length+' SO(s) selected · Quantity will flow SO-by-SO';
    calcSale();
  }
  window.loadSaleLines=function(){
    const party=getSaleParty();
    $('saleParty').value=party?.name||'';
    if(!party){
      $('saleSOSelect').innerHTML='';
      $('saleLines').innerHTML='<tr><td colspan="8" class="empty">Select a valid party to load open Sales Orders.</td></tr>';
      $('saleHint').textContent='Choose a party';calcSale();return;
    }
    populateSaleSOs(party,true);renderDispatchLines();
  };
  window.clearSaleLines=function(){
    $('saleParty').value='';
    if($('saleSOSelect'))$('saleSOSelect').innerHTML='';
    if($('saleSO'))$('saleSO').value='';
    $('saleLines').innerHTML='<tr><td colspan="8" class="empty">Select a party to load open Sales Orders.</td></tr>';
    $('saleHint').textContent='Choose a party';
    if($('saleSOSelectHint'))$('saleSOSelectHint').textContent='Select one or more open SOs.';
    $('saleDate').value=today();calcSale();
  };
  const saleSOEl=$('saleSO');
  if(saleSOEl){
    const refreshDispatchParty=()=>{
      const party=getSaleParty();
      if(party) window.loadSaleLines();
    };
    saleSOEl.addEventListener('input',refreshDispatchParty);
    saleSOEl.addEventListener('change',refreshDispatchParty);
    saleSOEl.addEventListener('blur',refreshDispatchParty);
  }
  $('saleSOSelect')?.addEventListener('change',renderDispatchLines);
  $('saleSelectAllSO')?.addEventListener('click',()=>{const e=$('saleSOSelect');if(e)[...e.options].forEach(o=>o.selected=true);renderDispatchLines()});
  $('saleClearSO')?.addEventListener('click',()=>{const e=$('saleSOSelect');if(e)[...e.options].forEach(o=>o.selected=false);renderDispatchLines()});
  $('salesForm').onsubmit=async e=>{
    e.preventDefault();
    const party=getSaleParty(),chosen=selectedSaleSOs();
    if(!party)return alert('Select a valid party.');
    if(!chosen.length)return alert('Select at least one Sales Order.');
    const rows=[...$('saleLines').rows].filter(r=>r.querySelector('.sl-qty'));
    const requested=rows.map(r=>({productCode:r.dataset.code,qtyType:r.dataset.qtyType,qty:Number(r.querySelector('.sl-qty')?.value||0),rate:Number(r.querySelector('.sl-rate')?.value||0),sources:JSON.parse(r.dataset.sources||'[]')})).filter(x=>x.qty>0);
    if(!requested.length)return alert('Enter a dispatch quantity for at least one product.');
    const allocations=[];
    for(const line of requested){
      let remaining=line.qty;
      for(const src of line.sources){
        if(remaining<=1e-8)break;
        const q=Math.min(remaining,Number(src.balance||0));
        if(q>0){allocations.push({source:src,l:line,qty:q});remaining-=q}
      }
      if(remaining>1e-8){
        const available=line.sources.reduce((n,x)=>n+Number(x.balance||0),0);
        return alert('Not enough selected SO balance for '+line.productCode+'. Short: '+fmt(remaining)+' '+line.qtyType+'. Selected SOs have '+fmt(available)+' '+line.qtyType+' available. Select another SO above and try again.');
      }
    }
    const b='DS'+Date.now();
    const dispatchRows=allocations.map((a,i)=>({
      id:b+'-'+i,date:$('saleDate').value,so:a.source.so,party:party.name,partyCode:party.code,
      invoice:$('saleInvoice').value.trim(),productCode:a.l.productCode,qty:a.qty,
      qty_type:a.l.qtyType,rate:a.l.rate,remarks:$('saleRemarks').value
    }));
    const {error:dispatchError}=await supabaseClient.from('sales').upsert(dispatchRows,{onConflict:'id'});
    if(dispatchError){
      console.error('Dispatch Supabase save failed:',dispatchError);
      alert('Dispatch was NOT saved to Supabase.\\n\\n'+dispatchError.message);
      return;
    }
    dispatchRows.forEach(row=>db.sales.push(row));
    dispatchRows.forEach(row=>{if(prev.sales)prev.sales[row.id]=JSON.stringify(row)});
    render();e.target.reset();$('saleDate').value=today();window.clearSaleLines();
    setTag('Supabase connected · dispatch saved');
    alert('Dispatch saved to Supabase. '+allocations.length+' SO allocation(s) created under one dispatch.');
  };
  const oldRender=window.render;window.render=function(){normalize();oldRender();const oh=document.querySelector('#orders .lines thead tr'),sh=document.querySelector('#sales .lines thead tr');if(oh)oh.children[1].textContent='QTY TYPE';if(sh)sh.children[1].textContent='QTY TYPE';[...$('orderRows').rows].forEach((r,i)=>{const o=[...db.orders].reverse()[i];if(o){r.cells[4].textContent=o.lines.map(l=>qt(l.qty,lt(l))).join(' + ');r.cells[5].textContent=o.lines.map(l=>qt(orderLineSold(o.no,l.productCode,lt(l)),lt(l))).join(' + ');r.cells[6].textContent=o.lines.map(l=>qt(Math.max(0,l.qty-orderLineSold(o.no,l.productCode,lt(l))),lt(l))).join(' + ')}});[...$('salesRows').rows].forEach((r,i)=>{const s=[...db.sales].reverse()[i];if(s)r.cells[5].textContent=qt(s.qty,st(s))});const active=db.orders.filter(o=>o.status!=='Cancelled');const soPartyList=$('soPartyList');if(soPartyList)soPartyList.innerHTML=[...db.parties].sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''))).map(p=>'<option value="'+esc(p.name||'')+'">'+esc(p.code||'')+'</option>').join('');const salePartyList=$('salePartyList');if(salePartyList)salePartyList.innerHTML=[...new Set(active.map(o=>o.party).filter(Boolean))].sort((a,b)=>a.localeCompare(b)).map(p=>'<option value="'+esc(p)+'"></option>').join('');const byUnit=(rows)=>{const sums={};rows.forEach(x=>{const u=x.u||'QTL';sums[u]=(sums[u]||0)+Number(x.q||0)});return Object.entries(sums).map(([u,q])=>qt(q,u)).join(' · ')||'0'};$('mOrdered').textContent=byUnit(active.flatMap(o=>o.lines.map(l=>({q:l.qty,u:lt(l)}))));$('mBalance').textContent=byUnit(active.flatMap(o=>o.lines.map(l=>({q:Math.max(0,l.qty-orderLineSold(o.no,l.productCode,lt(l))),u:lt(l)}))));const parties=[...new Set(active.filter(o=>orderStatus(o)==='Ongoing').map(o=>o.party).filter(Boolean))];
if($('saleSO').value)loadSaleLines()};
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

// Mobile navigation: start collapsed so the accordion is always reachable on touch screens.
(function(){
  const nav=document.querySelector('.erpSidebarNav');
  if(!nav)return;
  const mq=window.matchMedia('(max-width:900px)');
  const sync=()=>{
    if(!mq.matches)return;
    nav.querySelectorAll('.nav-group[data-group]').forEach(g=>{
      g.classList.add('is-collapsed');
      const t=g.querySelector(':scope > .nav-title'),items=g.querySelector(':scope > .nav-items');
      if(t)t.setAttribute('aria-expanded','false');
      if(items)items.setAttribute('aria-hidden','true');
    });
  };
  sync();
  mq.addEventListener?.('change',()=>setTimeout(sync,0));
})();


/* Mobile app navigation: bottom tabs + contextual menu */
(function(){
  const nav=document.getElementById('mobileBottomNav');
  const sub=document.getElementById('mobileSubnav');
  const grid=document.getElementById('mobileSubnavGrid');
  const title=document.getElementById('mobileSubnavTitle');
  const close=document.getElementById('mobileSubnavClose');
  if(!nav||!sub||!grid)return;
  const groups={
    overview:{label:'Home',items:[['dashboard','Overview']]},
    sales:{label:'Sales',items:[['orders','Sales Orders'],['sales','Sales / Dispatch'],['parties','Party Master'],['products','Products & Prices'],['balances','Party Balances'],['quotations','Quotations'],['priceboard','Price Board']]},
    purchase:{label:'Purchase',items:[['purchase','Purchase WhatsApp']]},
    finance:{label:'Finance',items:[['invoices','Invoices (GST)'],['payments','Payments'],['reports','Reports'],['financeCenter','Finance Center'],['requests','Customer Requests'],['approvals','Approvals'],['notifications','Notifications'],['auditCenter','Audit Center']]},
    more:{label:'More',items:[['inventory','Inventory']]}
  };
  const icon={dashboard:'⌂',orders:'▣',sales:'↗',parties:'♙',products:'◈',balances:'₹',quotations:'⌑',priceboard:'◆',purchase:'⇩',inventory:'▤',invoices:'▤',payments:'●',reports:'▥',financeCenter:'▤',requests:'◌',approvals:'✓',notifications:'●',auditCenter:'◌'};
  const isMobile=()=>window.matchMedia('(max-width:900px)').matches;
  function activate(tab){
    const b=document.querySelector('.tab[data-tab="'+tab+'"]');
    if(b)b.click();
    document.querySelectorAll('.mbnav-item').forEach(x=>x.classList.remove('active'));
    const group=Object.keys(groups).find(k=>groups[k].items.some(i=>i[0]===tab))||'more';
    document.querySelector('.mbnav-item[data-mobile-group="'+group+'"]')?.classList.add('active');
    grid.querySelectorAll('button').forEach(x=>x.classList.toggle('active',x.dataset.tab===tab));
    // Selecting a submenu item navigates to that page; the menu must close immediately.
    sub.classList.add('hidden');
    sub.setAttribute('aria-hidden','true');
  }
  function openGroup(key){
    const g=groups[key];if(!g)return;
    const current=document.querySelector('.mbnav-item.active')?.dataset.mobileGroup;
    const isOpen=!sub.classList.contains('hidden');
    if(isOpen && current===key){
      sub.classList.add('hidden');
      sub.setAttribute('aria-hidden','true');
      return;
    }
    document.querySelectorAll('.mbnav-item').forEach(x=>x.classList.toggle('active',x.dataset.mobileGroup===key));
    title.textContent=g.label;
    grid.innerHTML=g.items.map(([tab,label])=>'<button type="button" data-tab="'+tab+'"><span>'+icon[tab]+'</span><span>'+label+'</span></button>').join('');
    grid.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>activate(b.dataset.tab)));
    if(g.items.length===1){activate(g.items[0][0]);return}
    sub.classList.remove('hidden');sub.setAttribute('aria-hidden','false');
  }
  nav.querySelectorAll('.mbnav-item').forEach(b=>b.addEventListener('click',()=>openGroup(b.dataset.mobileGroup)));
  close?.addEventListener('click',()=>{sub.classList.add('hidden');sub.setAttribute('aria-hidden','true')});
  document.addEventListener('click',e=>{
    if(!isMobile()||sub.classList.contains('hidden'))return;
    if(sub.contains(e.target)||nav.contains(e.target))return;
    sub.classList.add('hidden');sub.setAttribute('aria-hidden','true');
  });
  window.addEventListener('resize',()=>{if(!isMobile())sub.classList.add('hidden')});
})();

(function(){
  const makeToken=()=>{const a=new Uint8Array(24);crypto.getRandomValues(a);return 'sd_pt_'+Array.from(a,b=>b.toString(16).padStart(2,'0')).join('')};

  window.partyLiveWhatsApp=async function(code){
    const p=db.parties.find(x=>x.code===code); if(!p)return;
    try{
      const {data,error}=await supabaseClient.from('party_public_links').select('token,public_slug').eq('party_code',code).eq('active',true).limit(1).maybeSingle();
      if(error)throw error;
      let token=data?.token, slug=data?.public_slug;
      if(!token||!slug){
        token=token||makeToken();
        slug=slug||('c-'+Array.from(crypto.getRandomValues(new Uint8Array(6)),b=>b.toString(16).padStart(2,'0')).join(''));
        const ins=await supabaseClient.from('party_public_links').upsert({party_code:code,token,public_slug:slug,active:true},{onConflict:'party_code'}).select('token,public_slug').single();
        if(ins.error)throw ins.error;
        slug=ins.data.public_slug;
      }
      const url=new URL('p/'+encodeURIComponent(slug),location.href);
      const message='Hello '+p.name+',%0A%0A📦 *LIVE SALES ORDER BALANCE*%0A%0AYour Sales Order balance is updated automatically after every dispatch.%0A%0A👉 *OPEN LIVE BALANCE*%0A'+encodeURIComponent(url.href)+'%0A%0AThank you.';
      const phone=String(p.phone||'').replace(/\D/g,'');
      const wa=phone?'https://wa.me/'+(phone.length===10?'91':'')+phone+'?text='+message:'https://wa.me/?text='+message;
      window.open(wa,'_blank','noopener');
    }catch(e){alert('Could not create WhatsApp link: '+(e.message||e))}
  };
  window.partyLiveLink=async function(code){
    const p=db.parties.find(x=>x.code===code); if(!p)return;
    try{
      const {data,error}=await supabaseClient.from('party_public_links').select('token,public_slug').eq('party_code',code).eq('active',true).limit(1).maybeSingle();
      if(error)throw error;
      let token=data?.token, slug=data?.public_slug;
      if(!token||!slug){
        token=token||makeToken();
        slug=slug||('c-'+Array.from(crypto.getRandomValues(new Uint8Array(6)),b=>b.toString(16).padStart(2,'0')).join(''));
        const ins=await supabaseClient.from('party_public_links').upsert({party_code:code,token,public_slug:slug,active:true},{onConflict:'party_code'}).select('token,public_slug').single();
        if(ins.error)throw ins.error;
        slug=ins.data.public_slug;
      }
      const url=new URL('p/'+encodeURIComponent(slug),location.href);
      try{await navigator.clipboard.writeText(url.href);alert('Live balance link copied for '+p.name+'.\n\n'+url.href)}
      catch(_){prompt('Copy this live balance link for '+p.name,url.href)}
    }catch(e){alert('Could not create live party link: '+(e.message||e))}
  };
  document.addEventListener('click',e=>{
    const b=e.target.closest('[data-act="partyLiveLink"]');if(b)partyLiveLink(b.dataset.arg);
    const w=e.target.closest('[data-act="partyLiveWhatsApp"]');
    if(w) partyLiveWhatsApp(w.dataset.arg);
  });
})();