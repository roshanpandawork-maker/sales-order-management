/* SalesDesk Stage 3: party ledger, controlled pricing, inventory intelligence, requests and approvals. */
(function(){
"use strict";
const $=id=>document.getElementById(id);
const sb=()=>window.supabaseClient;
const esc=window.esc;
const money=n=>"₹"+Number(n||0).toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2});
const qty=n=>Number(n||0).toLocaleString("en-IN",{maximumFractionDigits:3});
const today=()=>new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,10);
let loaded=false, loading=false, priceBoardParty="", data={summary:[],ledger:[],prices:[],daily:[],history:[],quotes:[],stock:[],moves:[],requests:[],approvals:[],notes:[]};

function opts(arr,valueKey="code",labelKey="name",blank="Select…"){
  return '<option value="">'+esc(blank)+'</option>'+arr.map(x=>'<option value="'+esc(x[valueKey])+'">'+esc(x[labelKey])+'</option>').join("");
}
function shell(title,sub,body){
  return '<div class="panel"><div class="sd-section-title"><div><h2>'+title+'</h2><p>'+sub+'</p></div></div>'+body+'</div>';
}
function table(head,rows){
  return '<div class="tablewrap"><table><thead><tr>'+head.map(x=>'<th>'+x+'</th>').join("")+'</tr></thead><tbody>'+(rows.join("")||'<tr><td colspan="'+head.length+'" class="empty">No records</td></tr>')+'</tbody></table></div>';
}
function metric(label,value,sub){
  return '<div class="metric"><span>'+label+'</span><strong>'+value+'</strong><small class="muted">'+esc(sub||"")+'</small></div>';
}
function setSection(id,title,sub,body){
  const el=$(id); if(el)el.innerHTML=shell(title,sub,body);
}
function partyName(code){return db.parties.find(x=>x.code===code)?.name||code||"—"}
function productName(code){return db.products.find(x=>x.code===code)?.name||code||"—"}
function activePartyPrice(party,product){
  return data.prices.find(x=>x.party_code===party&&x.product_code===product&&(!x.valid_to||x.valid_to>=today()));
}
async function loadAll(){
  if(loading||!sb())return;
  loading=true;
  const queries=await Promise.all([
    sb().from("party_receivable_summary").select("*").order("outstanding_amount",{ascending:false}),
    sb().from("party_ledger").select("*").order("transaction_date",{ascending:true}),
    sb().from("party_product_prices").select("*").order("valid_from",{ascending:false}),
    sb().from("price_history").select("*").order("effective_from",{ascending:false}).limit(250),
    sb().from("inventory_balances").select("*").order("product_name",{ascending:true}),
    sb().from("inventory_ledger").select("*").order("movement_date",{ascending:false}).limit(250),
    sb().from("party_requests").select("*").order("requested_at",{ascending:false}).limit(250),
    sb().from("approvals").select("*").order("created_at",{ascending:false}).limit(250),
    sb().from("notifications").select("*").order("created_at",{ascending:false}).limit(100)
  ]);
  const names=["summary","ledger","prices","history","stock","moves","requests","approvals","notes"];
  queries.forEach((r,i)=>{
    if(r.error) console.warn("Stage 3 "+names[i]+" load:",r.error);
    data[names[i]]=r.data||[];
  });
  loaded=true;loading=false;renderAll();
}
function renderAll(){
  renderLedger();
  renderPrices();
  renderQuotations();
  renderInventory();
  renderRequests();
  renderApprovals();
  renderNotifications();
}
function renderLedger(){
  const summaryRows=data.summary.map(x=>{
    const cls=Number(x.outstanding_amount)>0?"pill":"small";
    return '<tr><td><b>'+esc(x.party_name)+'</b><div class="small muted">'+esc(x.party_code)+'</div></td><td>'+money(x.invoiced_amount)+'</td><td>'+money(x.allocated_amount)+'</td><td><span class="'+cls+'">'+money(x.outstanding_amount)+'</span></td><td>'+money(x.unallocated_receipt_amount)+'</td><td><button type="button" class="secondary btnsm" data-ledger-party="'+esc(x.party_code)+'">View ledger</button></td></tr>';
  });
  setSection("financeCenter","Party Ledger & Receivables","Customer-wise outstanding, receipt allocation and a chronological debit/credit ledger.",
    '<div class="metrics">'+
      metric("Parties",data.summary.length,"Ledger-ready masters")+
      metric("Invoiced",money(data.summary.reduce((a,x)=>a+Number(x.invoiced_amount||0),0)),"All non-cancelled invoices")+
      metric("Outstanding",money(data.summary.reduce((a,x)=>a+Number(x.outstanding_amount||0),0)),"Invoice balance")+
      metric("Unallocated receipts",money(data.summary.reduce((a,x)=>a+Number(x.unallocated_receipt_amount||0),0)),"Customer advances / on-account")+
    '</div>'+
    '<div class="panel"><div class="field"><label>Party ledger</label><select id="stage3LedgerParty">'+opts(db.parties,"code","name","Choose a party")+'</select></div><div id="stage3LedgerDetail"><div class="emptybox">Choose a party to open its full ledger.</div></div></div>'+
    '<h3>Receivable summary</h3>'+table(["Party","Invoiced","Allocated","Outstanding","Unallocated receipts",""],summaryRows)
  );
  const s=$("stage3LedgerParty");
  if(s)s.onchange=()=>showLedger(s.value);
}
async function showLedger(code){
  const box=$("stage3LedgerDetail"); if(!box)return;
  if(!code){box.innerHTML='<div class="emptybox">Choose a party to open its full ledger.</div>';return}
  const rows=data.ledger.filter(x=>x.party_code===code);
  const outstanding=data.summary.find(x=>x.party_code===code);
  box.innerHTML='<div class="metrics">'+
    metric("Party",partyName(code),code)+
    metric("Outstanding",money(outstanding?.outstanding_amount),"Invoice balance")+
    metric("Unallocated receipts",money(outstanding?.unallocated_receipt_amount),"Advance / on-account")+
  '</div>'+
  table(["Date","Type","Reference","Source","Description","Debit","Credit","Running balance"],
    rows.map(x=>'<tr><td>'+esc(x.transaction_date)+'</td><td><span class="tag">'+esc(x.transaction_type)+'</span></td><td><b>'+esc(x.reference_no)+'</b></td><td>'+esc(x.source_ref||"")+'</td><td>'+esc(x.description||"")+'</td><td>'+money(x.debit)+'</td><td>'+money(x.credit)+'</td><td><b>'+money(x.running_balance)+'</b></td></tr>')
  );
}
function renderPrices(){
  const selected=priceBoardParty;
  const partyRows=(db.products||[]).map(p=>{
    const pp=selected?activePartyPrice(selected,p.code):null;
    const rate=pp?.rate??p.rate??0;
    return '<tr><td><b>'+esc(p.name)+'</b><div class="small muted">'+esc(p.code)+'</div></td><td>'+esc(p.unit||"")+'</td><td>'+money(rate)+'</td><td>'+esc(pp?.valid_from||"Default")+'</td><td>'+esc(pp?.valid_to||"Open")+'</td><td><button type="button" class="secondary btnsm" data-load-price="'+esc(p.code)+'">Use rate</button></td></tr>';
  });
  const historyRows=data.history.slice(0,100).map(x=>'<tr><td>'+esc(x.effective_from?.slice(0,10)||"")+'</td><td>'+esc(partyName(x.party_code))+'</td><td>'+esc(productName(x.product_code))+'</td><td>'+money(x.rate)+'</td><td>'+esc(x.source||"")+'</td><td>'+esc(x.note||"")+'</td></tr>');
  setSection("priceboard","Price Management & Live Price Board","Party-specific rates, effective dates and immutable price history for sales decisions.",
    '<div class="panel"><h3>Set party-specific price</h3><form id="stage3PriceForm"><div class="grid">'+
      '<div class="field"><label>Party *</label><select id="stage3PriceParty" required>'+opts(db.parties,"code","name","Select party")+'</select></div>'+
      '<div class="field"><label>Product *</label><select id="stage3PriceProduct" required>'+opts(db.products,"code","name","Select product")+'</select></div>'+
      '<div class="field"><label>Rate incl. GST (₹) *</label><input id="stage3PriceRate" type="number" min="0" step=".01" required></div>'+
      '<div class="field"><label>Valid from *</label><input id="stage3PriceDate" type="date" value="'+today()+'" required></div>'+
      '<div class="field"><label>Source</label><select id="stage3PriceSource"><option>MANUAL</option><option>APPROVED</option><option>CUSTOMER_REQUEST</option><option>IMPORT</option></select></div>'+
      '<div class="field"><label>Note</label><input id="stage3PriceNote" placeholder="Reason / customer agreement"></div>'+
    '</div><div class="actions"><button class="primary">Save price & record history</button></div></form></div>'+
    '<div class="metrics">'+metric("Products",db.products.length,"Selling masters")+metric("Party prices",data.prices.length,"Effective / historical rules")+metric("History",data.history.length,"Rate changes recorded")+metric("Selected party",selected?partyName(selected):"None","Board filter")+'</div>'+
    '<div class="filters"><select id="stage3BoardParty">'+opts(db.parties,"code","name","All parties / default rates")+'</select></div>'+
    '<h3>Current price board</h3>'+table(["Product","Unit","Current rate","Valid from","Valid to",""],partyRows)+
    '<h3>Recent price history</h3>'+table(["Effective","Party","Product","Rate","Source","Note"],historyRows)
  );
  const board=$("stage3BoardParty"); if(board){board.value=selected;board.onchange=()=>{priceBoardParty=board.value;renderPrices()}}
  const party=$("stage3PriceParty"),prod=$("stage3PriceProduct"),rate=$("stage3PriceRate");
  const fill=()=>{const pp=activePartyPrice(party.value,prod.value);if(pp)rate.value=pp.rate;else{const p=db.products.find(x=>x.code===prod.value);rate.value=p?.rate??""}};
  if(party)party.onchange=fill;if(prod)prod.onchange=fill;
  const form=$("stage3PriceForm");
  if(form)form.onsubmit=async e=>{
    e.preventDefault();
    const {error}=await sb().rpc("set_party_product_price",{
      p_party_code:party.value,p_product_code:prod.value,p_rate:Number(rate.value),
      p_valid_from:$("stage3PriceDate").value,p_source:$("stage3PriceSource").value,p_note:$("stage3PriceNote").value.trim()||null
    });
    if(error)return alert(error.message);
    alert("Party price saved and added to price history.");
    await loadAll();
  };
}
function renderInventory(){
  const negative=data.stock.filter(x=>Number(x.stock_balance)<-0.0005);
  const rows=data.stock.map(x=>'<tr><td><b>'+esc(x.product_name)+'</b><div class="small muted">'+esc(x.product_code)+'</div></td><td>'+esc(x.unit||"")+'</td><td>'+qty(x.stock_balance)+'</td><td>'+esc(String(x.movement_count))+'</td><td>'+(Number(x.stock_balance)<-0.0005?'<span class="pill">NEGATIVE</span>':'<span class="small">OK</span>')+'</td></tr>');
  const moves=data.moves.slice(0,100).map(x=>'<tr><td>'+esc(x.movement_date)+'</td><td>'+esc(x.product_name||x.product_code)+'</td><td>'+esc(x.movement_type)+'</td><td>'+qty(x.quantity)+' '+esc(x.unit||"")+'</td><td>'+qty(x.signed_quantity)+'</td><td>'+esc(x.reference_type||"")+' '+esc(x.reference_id||"")+'</td></tr>');
  setSection("inventory","Inventory Intelligence","Automatic OUT movements from dispatches, opening stock, movement ledger and negative-stock detection.",
    '<div class="metrics">'+metric("Products",data.stock.length,"Tracked products")+metric("Movements",data.moves.length,"Latest ledger window")+metric("Negative stock",negative.length,"Requires review")+metric("Total units",qty(data.stock.reduce((a,x)=>a+Number(x.stock_balance||0),0)),"Mixed units — review by product")+'</div>'+
    '<div class="panel"><h3>Post opening stock / adjustment</h3><p class="small muted">Use positive quantity. Dispatches automatically create OUT movements; this form records IN/OPENING stock.</p><form id="stage3StockForm"><div class="grid">'+
      '<div class="field"><label>Product *</label><select id="stage3StockProduct" required>'+opts(db.products,"code","name","Select product")+'</select></div>'+
      '<div class="field"><label>Date *</label><input id="stage3StockDate" type="date" value="'+today()+'" required></div>'+
      '<div class="field"><label>Quantity *</label><input id="stage3StockQty" type="number" min=".001" step=".001" required></div>'+
      '<div class="field"><label>Movement</label><select id="stage3StockType"><option>OPENING</option><option>IN</option><option>PURCHASE</option><option>PRODUCTION</option></select></div>'+
      '<div class="field"><label>Remarks</label><input id="stage3StockRemark" placeholder="GR / purchase / production reference"></div>'+
    '</div><div class="actions"><button class="primary">Post stock movement</button></div></form></div>'+
    (negative.length?'<div class="notice"><b>Negative stock detected:</b> '+negative.map(x=>esc(x.product_name)+' ('+qty(x.stock_balance)+' '+esc(x.unit||"")+')').join(", ")+'.</div>':"")+
    '<h3>Stock balance</h3>'+table(["Product","Unit","Balance","Movements","Status"],rows)+
    '<h3>Movement ledger</h3>'+table(["Date","Product","Type","Quantity","Signed","Reference"],moves)
  );
  const form=$("stage3StockForm");
  if(form)form.onsubmit=async e=>{
    e.preventDefault();
    const p=db.products.find(x=>x.code===$("stage3StockProduct").value);
    const {error}=await sb().from("inventory_movements").insert({
      movement_date:$("stage3StockDate").value,product_code:p?.code,movement_type:$("stage3StockType").value,
      quantity:Number($("stage3StockQty").value),unit:p?.unit||null,reference_type:"MANUAL",
      reference_id:"MANUAL-"+Date.now(),remarks:$("stage3StockRemark").value.trim()||null
    });
    if(error)return alert(error.message);
    alert("Stock movement posted.");
    await loadAll();
  };
}
function renderRequests(){
  const rows=data.requests.map(x=>{
    const actions=x.status==="OPEN"?
      '<button class="secondary btnsm" data-request-status="'+x.id+'|IN_PROGRESS">Start</button> <button class="primary btnsm" data-request-status="'+x.id+'|DONE">Done</button> <button class="danger btnsm" data-request-status="'+x.id+'|REJECTED">Reject</button>':
      (x.status==="IN_PROGRESS"?'<button class="primary btnsm" data-request-status="'+x.id+'|DONE">Done</button> <button class="danger btnsm" data-request-status="'+x.id+'|REJECTED">Reject</button>':"");
    return '<tr><td><span class="tag">'+esc(x.request_type)+'</span></td><td>'+esc(partyName(x.party_code))+'</td><td>'+esc(productName(x.product_code))+'</td><td>'+qty(x.quantity||0)+'</td><td>'+esc(x.message||"")+'</td><td><span class="pill">'+esc(x.status)+'</span></td><td>'+esc(x.requested_at?.slice(0,16).replace("T"," ")||"")+'</td><td>'+actions+'</td></tr>';
  });
  setSection("requests","Customer Requests","Capture product, price, dispatch and balance requests with ownership, status and notifications.",
    '<div class="panel"><h3>Create customer request</h3><form id="stage3RequestForm"><div class="grid">'+
      '<div class="field"><label>Party</label><select id="stage3RequestParty">'+opts(db.parties,"code","name","Select party")+'</select></div>'+
      '<div class="field"><label>Request type *</label><select id="stage3RequestType" required><option>PRODUCT</option><option>PRICE</option><option>DISPATCH</option><option>BALANCE</option><option>OTHER</option></select></div>'+
      '<div class="field"><label>Product</label><select id="stage3RequestProduct">'+opts(db.products,"code","name","Optional product")+'</select></div>'+
      '<div class="field"><label>Quantity</label><input id="stage3RequestQty" type="number" min="0" step=".001"></div>'+
      '<div class="field"><label>Message</label><input id="stage3RequestMessage" placeholder="Customer requirement / instruction"></div>'+
    '</div><div class="actions"><button class="primary">Create request</button></div></form></div>'+
    '<div class="metrics">'+metric("Open",data.requests.filter(x=>x.status==="OPEN").length,"New requests")+metric("In progress",data.requests.filter(x=>x.status==="IN_PROGRESS").length,"Being handled")+metric("Done",data.requests.filter(x=>x.status==="DONE").length,"Resolved")+metric("Rejected",data.requests.filter(x=>x.status==="REJECTED").length,"Closed without action")+'</div>'+
    table(["Type","Party","Product","Qty","Message","Status","Requested","Action"],rows)
  );
  const form=$("stage3RequestForm");
  if(form)form.onsubmit=async e=>{
    e.preventDefault();
    const {error}=await sb().rpc("create_party_request",{
      p_party_code:$("stage3RequestParty").value||null,p_request_type:$("stage3RequestType").value,
      p_product_code:$("stage3RequestProduct").value||null,p_quantity:Number($("stage3RequestQty").value||0)||null,
      p_message:$("stage3RequestMessage").value.trim()||null
    });
    if(error)return alert(error.message);
    alert("Customer request created.");
    await loadAll();
  };
}
function renderApprovals(){
  const rows=data.approvals.map(x=>{
    const action=x.status==="PENDING"?
      '<button class="primary btnsm" data-approval="'+x.id+'|APPROVED">Approve</button> <button class="danger btnsm" data-approval="'+x.id+'|REJECTED">Reject</button>':"";
    return '<tr><td>'+esc(x.entity_type)+'</td><td><b>'+esc(x.entity_id)+'</b></td><td>'+esc(x.action)+'</td><td>'+esc(x.requested_by||"")+'</td><td><span class="pill">'+esc(x.status)+'</span></td><td>'+esc(x.reason||"")+'</td><td>'+action+'</td></tr>';
  });
  setSection("approvals","Approval Center","Controlled approval requests for sensitive sales, finance and inventory actions.",
    '<div class="panel"><h3>Request an approval</h3><form id="stage3ApprovalForm"><div class="grid">'+
      '<div class="field"><label>Entity type *</label><select id="stage3ApprovalEntity"><option>PRICE</option><option>DISPATCH</option><option>INVOICE</option><option>PAYMENT</option><option>SALES_ORDER</option><option>OTHER</option></select></div>'+
      '<div class="field"><label>Entity ID *</label><input id="stage3ApprovalId" required placeholder="SO / invoice / record ID"></div>'+
      '<div class="field"><label>Action *</label><input id="stage3ApprovalAction" required placeholder="Approve special rate / cancellation / etc."></div>'+
      '<div class="field"><label>Reason</label><input id="stage3ApprovalReason" placeholder="Why approval is required"></div>'+
    '</div><div class="actions"><button class="primary">Submit approval request</button></div></form></div>'+
    '<div class="metrics">'+metric("Pending",data.approvals.filter(x=>x.status==="PENDING").length,"Needs decision")+metric("Approved",data.approvals.filter(x=>x.status==="APPROVED").length,"Accepted")+metric("Rejected",data.approvals.filter(x=>x.status==="REJECTED").length,"Declined")+'</div>'+
    table(["Entity","ID","Action","Requested by","Status","Reason","Decision"],rows)
  );
  const form=$("stage3ApprovalForm");
  if(form)form.onsubmit=async e=>{
    e.preventDefault();
    const {error}=await sb().rpc("create_approval",{
      p_entity_type:$("stage3ApprovalEntity").value,p_entity_id:$("stage3ApprovalId").value.trim(),
      p_action:$("stage3ApprovalAction").value.trim(),p_reason:$("stage3ApprovalReason").value.trim()||null
    });
    if(error)return alert(error.message);
    alert("Approval request submitted.");
    await loadAll();
  };
}
function renderNotifications(){
  const unread=data.notes.filter(x=>!x.read_at).length;
  const rows=data.notes.map(x=>'<tr><td><span class="tag">'+esc(x.type)+'</span></td><td><b>'+esc(x.title)+'</b><div class="small muted">'+esc(x.message||"")+'</div></td><td>'+esc(x.created_at?.slice(0,16).replace("T"," ")||"")+'</td><td>'+(x.read_at?'<span class="small">Read</span>':'<button class="secondary btnsm" data-notify-read="'+x.id+'">Mark read</button>')+'</td></tr>');
  setSection("notifications","Notifications","Requests, approvals and operational follow-ups generated by the ERP workflow.",
    '<div class="metrics">'+metric("Unread",unread,"Requires attention")+metric("Total",data.notes.length,"Latest notification queue")+'</div>'+
    table(["Type","Notification","Created","Status"],rows)
  );
}
async function markRead(id){
  const {error}=await sb().from("notifications").update({read_at:new Date().toISOString()}).eq("id",id);
  if(error)return alert(error.message);
  await loadAll();
}
async function requestStatus(id,status){
  const {error}=await sb().rpc("set_party_request_status",{p_request_id:id,p_status:status});
  if(error)return alert(error.message);
  await loadAll();
}
async function approvalDecision(id,status){
  const reason=prompt(status==="APPROVED"?"Approval note (optional):":"Rejection reason:");
  if(status==="REJECTED"&&reason===null)return;
  const {error}=await sb().rpc("decide_approval",{p_approval_id:id,p_status:status,p_reason:reason||null});
  if(error)return alert(error.message);
  await loadAll();
}
function wire(){
  if(window.__sdStage3Wired)return;window.__sdStage3Wired=true;
  document.addEventListener("click",e=>{
    const ledger=e.target.closest("[data-ledger-party]");if(ledger){const s=$("stage3LedgerParty");if(s){s.value=ledger.dataset.ledgerParty;showLedger(s.value)}return}
    const use=e.target.closest("[data-load-price]");if(use){const p=$("stage3PriceProduct"),party=$("stage3PriceParty"),rate=$("stage3PriceRate");if(p){p.value=use.dataset.loadPrice;const pp=activePartyPrice(party?.value,p.value);if(rate)rate.value=pp?.rate??db.products.find(x=>x.code===p.value)?.rate??""}return}
    const rs=e.target.closest("[data-request-status]");if(rs){const [id,status]=rs.dataset.requestStatus.split("|");requestStatus(id,status);return}
    const ap=e.target.closest("[data-approval]");if(ap){const [id,status]=ap.dataset.approval.split("|");approvalDecision(id,status);return}
    const nr=e.target.closest("[data-notify-read]");if(nr){markRead(nr.dataset.notifyRead);return}
  });
  document.addEventListener("click",e=>{
    const tab=e.target.closest(".tab[data-tab]");
    if(tab&&["financeCenter","priceboard","inventory","requests","approvals","notifications"].includes(tab.dataset.tab))setTimeout(()=>{if(loaded)renderAll()},0);
  });
}
function init(){
  if(!sb()||window.__sdStage3Init)return;
  window.__sdStage3Init=true;wire();
  window.addEventListener("salesdesk:ready",()=>setTimeout(loadAll,100));
  sb().auth.getSession().then(r=>{if(r.data?.session && db.parties.length)setTimeout(loadAll,100)});
  window.SD_STAGE3={reload:loadAll};
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();