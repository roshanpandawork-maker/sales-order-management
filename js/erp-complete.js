/* SalesDesk complete ERP workspace modules 1-26.
   UI-first layer over the new foundation tables. */
(function(){
"use strict";
const $=id=>document.getElementById(id), money=n=>"₹"+Number(n||0).toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2});
const esc2=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const sb=()=>window.supabaseClient;
const state={q:[],ql:[],prices:[],ph:[],inv:[],pay:[],stock:[],req:[],appr:[],notes:[]};

function moduleShell(title,sub,body){
 return '<div class="panel"><div class="sd-section-title"><div><h2>'+title+'</h2><p>'+sub+'</p></div></div>'+body+'</div>';
}
function nav(tab,label){
 return '<button class="secondary" type="button" data-ednav="'+tab+'">'+label+'</button>';
}
function k(label,value,sub=""){return '<div class="metric"><span>'+label+'</span><strong>'+value+'</strong><small class="muted">'+sub+'</small></div>'}
function table(head,rows){return '<div class="tablewrap"><table><thead><tr>'+head.map(x=>'<th>'+x+'</th>').join('')+'</tr></thead><tbody>'+ (rows.join('')||'<tr><td colspan="'+head.length+'" class="empty">No records</td></tr>')+'</tbody></table></div>'}
function section(id,title,sub,html){let s=$(id);if(!s)return; s.innerHTML=moduleShell(title,sub,html)}

async function load(){
 const q=await sb().from("quotations").select("*,quotation_lines(*)").order("quotation_date",{ascending:false});
 const p=await sb().from("party_product_prices").select("*").order("valid_from",{ascending:false});
 const ph=await sb().from("price_history").select("*").order("effective_from",{ascending:false});
 const i=await sb().from("invoices").select("*,invoice_lines(*)").order("invoice_date",{ascending:false});
 const pay=await sb().from("payments").select("*").order("payment_date",{ascending:false});
 const st=await sb().from("inventory_movements").select("*").order("movement_date",{ascending:false});
 const req=await sb().from("party_requests").select("*").order("requested_at",{ascending:false});
 const ap=await sb().from("approvals").select("*").order("created_at",{ascending:false});
 const no=await sb().from("notifications").select("*").order("created_at",{ascending:false}).limit(30);
 state.q=q.data||[];state.prices=p.data||[];state.ph=ph.data||[];state.inv=i.data||[];state.pay=pay.data||[];state.stock=st.data||[];state.req=req.data||[];state.appr=ap.data||[];state.notes=no.data||[];
 renderAll();
}

function renderAll(){
 renderQuotations();renderPriceBoard();renderFinance();renderInventory();renderRequests();renderApprovals();renderReports();renderNotifications();
}
function renderQuotations(){
 const rows=state.q.map(q=>'<tr><td><b>'+esc2(q.quotation_no)+'</b></td><td>'+esc2(q.quotation_date)+'</td><td>'+esc2(q.party_code)+'</td><td>'+money((q.quotation_lines||[]).reduce((a,x)=>a+Number(x.quantity||0)*Number(x.rate||0),0))+'</td><td><span class="pill">'+esc2(q.status)+'</span></td><td><button class="secondary btnsm" data-convert="'+q.id+'">Convert to SO</button></td></tr>');
 section("quotations","Quotations","Prepare customer pricing and convert accepted quotations into Sales Orders.",
 '<div class="sd-quickbar">'+nav("orders","Open Sales Orders")+nav("products","Manage Products")+nav("parties","Manage Parties")+'</div>'+table(["Quotation","Date","Party","Value","Status","Action"],rows));
}
function renderPriceBoard(){
 const rows=(db.products||[]).map(p=>{
  const partyPrice=state.prices.find(x=>x.product_code===p.code);
  return '<tr><td><b>'+esc2(p.name)+'</b></td><td>'+esc2(p.code)+'</td><td>'+esc2(p.unit||"")+'</td><td>'+money(partyPrice?.rate??p.rate)+'</td><td>'+esc2(partyPrice?.valid_from||"Default")+'</td><td><button class="secondary btnsm" data-price="'+esc2(p.code)+'">Price history</button></td></tr>'
 });
 section("priceboard","Live Price Board","Current selling rates with a path toward party-specific and historical pricing.",
 '<div class="metrics">'+k("Products",(db.products||[]).length,"Active master")+k("Price rules",state.prices.length,"Party-specific")+k("History",state.ph.length,"Recorded rates")+k("Today",new Date().toLocaleDateString("en-IN"),"Current price date")+'</div>'+table(["Product","Code","Unit","Current rate","Effective",""],rows));
}
function renderFinance(){
 const receivable=state.inv.reduce((a,x)=>a+Number(x.grand_total||0),0)-state.pay.reduce((a,x)=>a+Number(x.amount||0),0);
 const rows=state.inv.map(x=>'<tr><td><b>'+esc2(x.invoice_no)+'</b></td><td>'+esc2(x.invoice_date)+'</td><td>'+esc2(x.party_code)+'</td><td>'+money(x.grand_total)+'</td><td>'+esc2(x.status)+'</td></tr>');
 const payrows=state.pay.map(x=>'<tr><td>'+esc2(x.receipt_no)+'</td><td>'+esc2(x.payment_date)+'</td><td>'+esc2(x.party_code)+'</td><td>'+esc2(x.mode)+'</td><td>'+money(x.amount)+'</td></tr>');
 section("financeCenter","Finance & Party Ledger","Invoice → payment → outstanding balance, with transaction history.",
 '<div class="metrics">'+k("Invoices",state.inv.length,"GST billing")+k("Payments",state.pay.length,"Receipts")+k("Gross invoiced",money(state.inv.reduce((a,x)=>a+Number(x.grand_total||0),0)),"All loaded invoices")+k("Outstanding",money(Math.max(0,receivable)),"Requires allocation")+'</div><h3>Invoices</h3>'+table(["Invoice","Date","Party","Total","Status"],rows)+'<h3>Payments</h3>'+table(["Receipt","Date","Party","Mode","Amount"],payrows));
}
function renderInventory(){
 const map={};state.stock.forEach(x=>{map[x.product_code]=(map[x.product_code]||0)+Number(x.quantity||0)*(["PURCHASE","OPENING","PRODUCTION","IN"].includes(String(x.movement_type).toUpperCase())?1:-1)});
 const rows=Object.entries(map).map(([c,q])=>'<tr><td><b>'+esc2(c)+'</b></td><td>'+esc2((db.products||[]).find(p=>p.code===c)?.name||c)+'</td><td>'+q.toFixed(3)+'</td><td>'+esc2((db.products||[]).find(p=>p.code===c)?.unit||"")+'</td><td><span class="pill">'+(q<0?"Negative":"Healthy")+'</span></td></tr>');
 section("inventory","Inventory Intelligence","Stock balance, movement and exceptions. Production/purchase/sales can feed the same movement ledger.",
 '<div class="metrics">'+k("Movements",state.stock.length,"Stock ledger")+k("Products tracked",Object.keys(map).length,"With movements")+k("Negative",Object.values(map).filter(x=>x<0).length,"Investigate")+'</div>'+table(["Code","Product","Balance","Unit","Status"],rows));
}
function renderRequests(){
 const rows=state.req.map(x=>'<tr><td>'+esc2(x.request_type)+'</td><td>'+esc2(x.party_code||"Public")+'</td><td>'+esc2(x.product_code||"")+'</td><td>'+esc2(x.message||"")+'</td><td><span class="pill">'+esc2(x.status)+'</span></td><td>'+esc2(x.requested_at||"")+'</td></tr>');
 section("requests","Customer Requests","Product, price, dispatch and balance requests from the customer portal.",
 table(["Type","Party","Product","Message","Status","Requested"],rows));
}
function renderApprovals(){
 const rows=state.appr.map(x=>'<tr><td>'+esc2(x.entity_type)+'</td><td>'+esc2(x.action)+'</td><td>'+esc2(x.entity_id)+'</td><td><span class="pill">'+esc2(x.status)+'</span></td><td>'+esc2(x.reason||"")+'</td></tr>');
 section("approvals","Approvals","Controlled workflow for price changes, discounts, cancellations and other sensitive actions.",
 table(["Entity","Action","ID","Status","Reason"],rows));
}
function renderReports(){
 const sales=(db.sales||[]).reduce((a,x)=>a+Number(x.value||x.total||0),0);
 const orders=db.orders||[];
 const open=orders.filter(x=>String(x.status||"").toLowerCase()!=="closed").length;
 section("reports","Management Reports","Decision-focused summaries instead of raw transaction screens.",
 '<div class="metrics">'+k("Sales records",(db.sales||[]).length,"Dispatch transactions")+k("Sales value",money(sales),"Loaded records")+k("Orders",orders.length,"All SOs")+k("Open orders",open,"Needs fulfilment")+'</div><div class="grid"><div class="panel"><h3>Management priorities</h3><p>1. Review overdue/open SOs.</p><p>2. Review outstanding invoices.</p><p>3. Investigate negative stock.</p><p>4. Review pending approvals and customer requests.</p></div><div class="panel"><h3>Analytics roadmap</h3><p>Sales by party/product, monthly trend, gross margin, receivables ageing, stock velocity and price movement.</p></div></div>');
}
function renderNotifications(){
 const rows=state.notes.map(x=>'<tr><td>'+esc2(x.type)+'</td><td><b>'+esc2(x.title)+'</b><div class="small muted">'+esc2(x.message||"")+'</div></td><td>'+esc2(x.created_at||"")+'</td><td>'+ (x.read_at?"Read":"<span class=\"pill\">New</span>")+'</td></tr>');
 section("notifications","Notifications","Due orders, payment follow-ups, approvals and customer requests in one queue.",table(["Type","Notification","Created","Status"],rows));
}

function addNav(){
 const groups=[
  ["sales","quotations","Quotations"],["sales","priceboard","Live Price Board"],
  ["finance","financeCenter","Party Ledger / Receivables"],
  ["operations","inventory","Inventory Intelligence"],
  ["sales","requests","Customer Requests"],
  ["finance","approvals","Approvals"],["finance","notifications","Notifications"]
 ];
 groups.forEach(([g,id,label])=>{
  if(document.querySelector('[data-tab="'+id+'"]'))return;
  const ng=document.querySelector('.nav-group[data-group="'+g+'"] .nav-items');
  if(ng){const b=document.createElement("button");b.className="tab";b.dataset.tab=id;b.innerHTML='<span class="navIcon">◆</span><span>'+label+'</span>';ng.appendChild(b)}
 });
}
function wire(){
 addNav();
 ["quotations","priceboard","financeCenter","inventory","requests","approvals","notifications","reports"].forEach(id=>{
  const s=$(id); if(s)s.addEventListener("click",e=>{const b=e.target.closest("[data-ednav]");if(b&&typeof showTab==="function")showTab(b.dataset.ednav)});
 });
 document.addEventListener("click",e=>{
  const c=e.target.closest("[data-convert]"); if(c){alert("Quotation is ready to convert. The next step will prefill the Sales Order form."); if(typeof showTab==="function")showTab("orders")}
 });
 const old=window.showTab;
 window.showTab=function(t){old(t); if(["quotations","priceboard","financeCenter","inventory","requests","approvals","notifications"].includes(t)){renderAll()}};
}
document.addEventListener("DOMContentLoaded",()=>{setTimeout(()=>{wire();load()},800)});
})();