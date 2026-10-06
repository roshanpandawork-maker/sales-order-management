(function(){
"use strict";
const $=id=>document.getElementById(id),sb=()=>window.supabaseClient;
const e=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const today=()=>new Date().toISOString().slice(0,10);
async function quotation(){
 const s=$("quotations");if(!s||s.querySelector("#saveQuotation"))return;
 const parties=(db.parties||[]).map(p=>'<option value="'+e(p.code)+'">'+e(p.name)+'</option>').join("");
 const products=(db.products||[]).map(p=>'<option value="'+e(p.code)+'">'+e(p.name)+'</option>').join("");
 s.insertAdjacentHTML("afterbegin",'<div class="panel"><h3>Create quotation</h3><div class="grid"><div class="field"><label>Party</label><select id="txQParty"><option value="">Select</option>'+parties+'</select></div><div class="field"><label>Valid until</label><input id="txQValid" type="date"></div><div class="field"><label>Product</label><select id="txQProduct"><option value="">Select</option>'+products+'</select></div><div class="field"><label>Quantity</label><input id="txQQty" type="number" min=".001" step=".001"></div><div class="field"><label>Rate</label><input id="txQRate" type="number" min="0" step=".01"></div></div><button class="primary" id="saveQuotation">Save quotation</button></div>');
 $("saveQuotation").onclick=async()=>{const party=$("txQParty").value,product=$("txQProduct").value,qty=Number($("txQQty").value),rate=Number($("txQRate").value);if(!party||!product||qty<=0)return alert("Complete quotation details.");const no="QT-"+String(Date.now()).slice(-7);const q=await sb().from("quotations").insert({quotation_no:no,party_code:party,valid_until:$("txQValid").value||null,status:"DRAFT"}).select().single();if(q.error)return alert(q.error.message);const l=await sb().from("quotation_lines").insert({quotation_id:q.data.id,product_code:product,quantity:qty,rate,unit:(db.products.find(x=>x.code===product)||{}).unit||null});if(l.error)return alert(l.error.message);alert(no+" saved.");window.location.reload()};
}
async function payment(){
 const s=$("financeCenter");if(!s||s.querySelector("#savePayment"))return;
 const parties=(db.parties||[]).map(p=>'<option value="'+e(p.code)+'">'+e(p.name)+'</option>').join("");
 s.insertAdjacentHTML("afterbegin",'<div class="panel"><h3>Record payment</h3><div class="grid"><div class="field"><label>Party</label><select id="txPP"><option value="">Select</option>'+parties+'</select></div><div class="field"><label>Date</label><input id="txPD" type="date" value="'+today()+'"></div><div class="field"><label>Amount</label><input id="txPA" type="number" min=".01" step=".01"></div><div class="field"><label>Mode</label><select id="txPM"><option>BANK</option><option>UPI</option><option>CASH</option><option>CHEQUE</option><option>NEFT</option><option>RTGS</option></select></div><div class="field"><label>Reference</label><input id="txPR"></div></div><button class="primary" id="savePayment">Record payment</button></div>');
 $("savePayment").onclick=async()=>{const party=$("txPP").value,amount=Number($("txPA").value);if(!party||amount<=0)return alert("Enter party and amount.");const r=await sb().from("payments").insert({receipt_no:"RC-"+String(Date.now()).slice(-8),party_code:party,payment_date:$("txPD").value,amount,mode:$("txPM").value,reference_no:$("txPR").value||null});if(r.error)return alert(r.error.message);alert("Payment recorded.")};
}
document.addEventListener("DOMContentLoaded",()=>setTimeout(()=>{quotation();payment()},1200));
})();