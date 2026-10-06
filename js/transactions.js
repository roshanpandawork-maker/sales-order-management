(function(){
"use strict";
const $=id=>document.getElementById(id),sb=()=>window.supabaseClient;
const e=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const today=()=>new Date().toISOString().slice(0,10);
const money=n=>"₹"+Number(n||0).toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2});

function injectQuotation(){
 const s=$("quotations");if(!s||s.querySelector("#saveQuotation"))return;
 const parties=(db.parties||[]).map(p=>'<option value="'+e(p.code)+'">'+e(p.name)+'</option>').join("");
 const products=(db.products||[]).map(p=>'<option value="'+e(p.code)+'">'+e(p.name)+'</option>').join("");
 s.insertAdjacentHTML("afterbegin",'<div class="panel"><h3>Create quotation</h3><div class="grid"><div class="field"><label>Party</label><select id="txQParty"><option value="">Select</option>'+parties+'</select></div><div class="field"><label>Valid until</label><input id="txQValid" type="date"></div><div class="field"><label>Product</label><select id="txQProduct"><option value="">Select</option>'+products+'</select></div><div class="field"><label>Quantity</label><input id="txQQty" type="number" min=".001" step=".001"></div><div class="field"><label>Rate</label><input id="txQRate" type="number" min="0" step=".01"></div></div><button class="primary" id="saveQuotation">Save quotation</button></div>');
 $("saveQuotation").onclick=async()=>{
  const party=$("txQParty").value,product=$("txQProduct").value,qty=Number($("txQQty").value),rate=Number($("txQRate").value);
  if(!party||!product||qty<=0||rate<0)return alert("Complete quotation details.");
  const no="QT-"+String(Date.now()).slice(-7);
  const q=await sb().from("quotations").insert({quotation_no:no,party_code:party,valid_until:$("txQValid").value||null,status:"DRAFT"}).select().single();
  if(q.error)return alert(q.error.message);
  const l=await sb().from("quotation_lines").insert({quotation_id:q.data.id,product_code:product,quantity:qty,rate,unit:(db.products.find(x=>x.code===product)||{}).unit||null});
  if(l.error)return alert(l.error.message);
  alert(no+" saved.");window.location.reload();
 };
}

async function loadInvoiceBalances(){
 const r=await sb().from("invoice_balances").select("*").order("invoice_date",{ascending:false});
 if(r.error)return {data:[],error:r.error};
 return r;
}

async function injectDispatchInvoice(){
 const s=$("financeCenter");if(!s||s.querySelector("#createDispatchInvoice"))return;
 const dispatches=(db.sales||[]).filter(x=>x.partyCode&&(!x.invoice_id||String(x.invoice_id).trim()===""));
 const groups={};
 dispatches.forEach(x=>{const key=x.partyCode+"|"+(x.so||"");(groups[key]??=[]).push(x)});
 const options=Object.entries(groups).map(([key,rows])=>{
   const [party,so]=key.split("|");const name=(db.parties||[]).find(p=>p.code===party)?.name||party;
   const total=rows.reduce((a,x)=>a+Number(x.qty||0)*Number(x.rate||0),0);
   return '<option value="'+e(key)+'">'+e((so||"Dispatch")+' · '+name+' · '+money(total)+' · '+rows.length+' line(s)')+'</option>';
 }).join("");
 s.insertAdjacentHTML("afterbegin",'<div class="panel"><h3>Dispatch → GST Invoice</h3><p class="muted small">Select an uninvoiced dispatch group. The database creates the invoice and links every selected dispatch row atomically.</p><div class="grid"><div class="field"><label>Dispatch / SO</label><select id="txDISO"><option value="">Select dispatch</option>'+options+'</select></div><div class="field"><label>Invoice date</label><input id="txDID" type="date" value="'+today()+'"></div></div><button class="primary" id="createDispatchInvoice">Create GST invoice from dispatch</button></div>');
 $("createDispatchInvoice").onclick=async()=>{
  const key=$("txDISO").value;if(!key)return alert("Select a dispatch group.");
  const rows=groups[key]||[];if(!rows.length)return alert("No uninvoiced dispatch rows found.");
  const r=await sb().rpc("create_invoice_from_dispatch",{p_sales_ids:rows.map(x=>x.id),p_invoice_date:$("txDID").value||today()});
  if(r.error)return alert(r.error.message);
  const x=Array.isArray(r.data)?r.data[0]:r.data;
  alert((x?.invoice_no||"Invoice")+" created and linked to dispatch.");
  window.location.reload();
 };
}

async function injectPayment(){
 const s=$("financeCenter");if(!s||s.querySelector("#savePayment"))return;
 const parties=(db.parties||[]).map(p=>'<option value="'+e(p.code)+'">'+e(p.name)+'</option>').join("");
 s.insertAdjacentHTML("afterbegin",'<div class="panel"><h3>Record & allocate payment</h3><div class="grid"><div class="field"><label>Party</label><select id="txPP"><option value="">Select</option>'+parties+'</select></div><div class="field"><label>Invoice</label><select id="txPI" disabled><option value="">Select party first</option></select></div><div class="field"><label>Date</label><input id="txPD" type="date" value="'+today()+'"></div><div class="field"><label>Amount</label><input id="txPA" type="number" min=".01" step=".01"></div><div class="field"><label>Mode</label><select id="txPM"><option>BANK</option><option>UPI</option><option>CASH</option><option>CHEQUE</option><option>NEFT</option><option>RTGS</option></select></div><div class="field"><label>Reference</label><input id="txPR"></div></div><button class="primary" id="savePayment">Record payment</button></div>');
 $("txPP").onchange=async()=>{
  const party=$("txPP").value;$("txPI").innerHTML='<option value="">Unallocated payment</option>';$("txPI").disabled=!party;if(!party)return;
  const r=await loadInvoiceBalances();if(r.error)return alert(r.error.message);
  (r.data||[]).filter(x=>x.party_code===party&&Number(x.balance_amount)>0.005).forEach(x=>{$("txPI").insertAdjacentHTML("beforeend",'<option value="'+e(x.id)+'" data-balance="'+e(x.balance_amount)+'">'+e(x.invoice_no)+' · Balance '+e(money(x.balance_amount))+' · '+e(x.ageing_bucket)+'</option>')});
 };
 $("savePayment").onclick=async()=>{
  const party=$("txPP").value,invoice=$("txPI").value,amount=Number($("txPA").value);
  if(!party||amount<=0)return alert("Enter party and a valid payment amount.");
  const r=await sb().from("payments").insert({receipt_no:"RC-"+String(Date.now()).slice(-8),party_code:party,payment_date:$("txPD").value,amount,mode:$("txPM").value,reference_no:$("txPR").value||null}).select("id,receipt_no").single();
  if(r.error)return alert(r.error.message);
  if(invoice){
   const max=Number($("txPI").selectedOptions[0]?.dataset.balance||0);
   if(amount>max+0.005){await sb().from("payments").delete().eq("id",r.data.id);return alert("Payment exceeds selected invoice balance of "+money(max)+".");}
   const a=await sb().rpc("allocate_payment",{p_payment_id:r.data.id,p_invoice_id:invoice,p_amount:amount});
   if(a.error){await sb().from("payments").delete().eq("id",r.data.id);return alert(a.error.message);}
   alert(r.data.receipt_no+" recorded and allocated. Invoice status: "+(a.data?.[0]?.invoice_status||"updated"));
  }else alert(r.data.receipt_no+" recorded as unallocated payment.");
  window.location.reload();
 };
}

async function renderLedger(){
 const s=$("financeCenter");if(!s)return;
 const r=await loadInvoiceBalances();if(r.error)return;
 const rows=r.data||[];
 const total=rows.reduce((a,x)=>a+Number(x.grand_total||0),0),paid=rows.reduce((a,x)=>a+Number(x.paid_amount||0),0),bal=rows.reduce((a,x)=>a+Number(x.balance_amount||0),0);
 const buckets={"0-30":0,"31-60":0,"61-90":0,"90+":0};
 rows.filter(x=>Number(x.balance_amount)>0.005).forEach(x=>buckets[x.ageing_bucket]=(buckets[x.ageing_bucket]||0)+Number(x.balance_amount));
 let panel=document.getElementById("txLedger");
 if(!panel){panel=document.createElement("div");panel.id="txLedger";s.appendChild(panel)}
 panel.innerHTML='<div class="panel"><h3>Receivables ageing</h3><div class="metrics"><div class="metric"><span>Invoiced</span><strong>'+money(total)+'</strong></div><div class="metric"><span>Allocated</span><strong>'+money(paid)+'</strong></div><div class="metric"><span>Outstanding</span><strong>'+money(bal)+'</strong></div><div class="metric"><span>90+ days</span><strong>'+money(buckets["90+"])+'</strong></div></div><div class="grid"><div class="panel"><b>0–30</b><div>'+money(buckets["0-30"])+'</div></div><div class="panel"><b>31–60</b><div>'+money(buckets["31-60"])+'</div></div><div class="panel"><b>61–90</b><div>'+money(buckets["61-90"])+'</div></div><div class="panel"><b>90+</b><div>'+money(buckets["90+"])+'</div></div></div>'+('<div class="tablewrap"><table><thead><tr><th>Invoice</th><th>Party</th><th>Date</th><th>Total</th><th>Paid</th><th>Balance</th><th>Age</th><th>Status</th></tr></thead><tbody>'+rows.map(x=>'<tr><td><b>'+e(x.invoice_no)+'</b></td><td>'+e((db.parties||[]).find(p=>p.code===x.party_code)?.name||x.party_code)+'</td><td>'+e(x.invoice_date)+'</td><td>'+money(x.grand_total)+'</td><td>'+money(x.paid_amount)+'</td><td><b>'+money(x.balance_amount)+'</b></td><td>'+e(x.age_days)+'d</td><td><span class="pill">'+e(x.calculated_status)+'</span></td></tr>').join('')+'</tbody></table></div>')+'</div>';
}

async function init(){
 injectQuotation();
 injectDispatchInvoice();
 injectPayment();
 await renderLedger();
}
document.addEventListener("DOMContentLoaded",()=>setTimeout(init,1200));
})();
