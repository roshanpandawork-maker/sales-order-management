// Purchase WhatsApp: separate supplier master + purchase message generator.
// Does not use SalesDesk customer/party/order data.
(function(){
"use strict";
const $=id=>document.getElementById(id);
const S={suppliers:[],messages:[],loaded:false,view:"entry",err:""};
const SUP="purchase_suppliers", MSG="purchase_messages";
const escp=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const moneyp=n=>"₹"+Number(n||0).toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2});
const todayp=()=>new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,10);

function messageText(){
  const supplier=$("puSupplier")?.selectedOptions[0]?.textContent||"";
  const company=$("puCompany")?.value.trim()||"";
  const date=$("puDate")?.value||"";
  const gr=$("puGR")?.value.trim()||"";
  const truck=$("puTruck")?.value.trim()||"";
  const bags=$("puBags")?.value||"";
  const weight=$("puWeight")?.value||"";
  const rate=$("puRate")?.value||"";
  const oil=$("puOil")?.value||"";
  const ffa=$("puFFA")?.value||"";
  const remarks=$("puRemarks")?.value.trim()||"";
  return "*PURCHASE DETAILS*\n\n"+
    "Party Name: "+supplier+"\n"+
    "Date: "+date+"\n"+
    "G.R. No.: "+gr+"\n"+
    "Truck No.: "+truck+"\n"+
    "Bags: "+bags+"\n"+
    "Weight: "+weight+" MT\n"+
    "Rate: "+(rate?moneyp(rate):"")+"\n"+
    "Oil: "+(oil?oil+"%":"")+"\n"+
    "FFA: "+ffa+"\n"+
    (remarks?"Remarks: "+remarks+"\n":"")+
    (company?"\n*"+company+"*":"");
}
function phone(s){
  let x=String(s||"").replace(/\D/g,"");
  if(x.length===10)x="91"+x;
  return x;
}
function supplierOpts(){
  return '<option value="">Select supplier</option>'+S.suppliers.filter(x=>x.active!==false).sort((a,b)=>String(a.name).localeCompare(String(b.name))).map(x=>'<option value="'+escp(x.id)+'">'+escp(x.name)+" · "+escp(x.mobile||"No mobile")+"</option>").join("");
}
function tbl(h,rows){
  return '<div class="tablewrap"><table><thead><tr>'+h.map(x=>"<th>"+x+"</th>").join("")+"</tr></thead><tbody>"+(rows.join("")||'<tr><td class="empty" colspan="'+h.length+'">No records</td></tr>')+"</tbody></table></div>";
}
async function load(){
  const [a,b]=await Promise.all([
    supabaseClient.from(SUP).select("*").order("name"),
    supabaseClient.from(MSG).select("*").order("created_at",{ascending:false}).limit(100)
  ]);
  S.err=a.error?.message||b.error?.message||"";
  if(!S.err){S.suppliers=a.data||[];S.messages=b.data||[];S.loaded=true}
  draw();
}
function buildSupplierModal(id){
  const e=S.suppliers.find(x=>x.id===id)||{};
  openModal(id?"Edit supplier":"Add supplier",
    fld("psName","Supplier name *",e.name)+
    fld("psMobile","WhatsApp / mobile",e.mobile)+
    fld("psContact","Contact person",e.contact)+
    fld("psGST","GSTIN",e.gstin)+
    fld("psAddress","Address",e.address)+
    '<div class="field"><label>Status</label><select id="psActive"><option value="1" '+(e.active===false?"":"selected")+'>Active</option><option value="0" '+(e.active===false?"selected":"")+'>Inactive</option></select></div>',
    async()=>{
      const name=$("psName").value.trim(),mobile=$("psMobile").value.trim();
      if(!name)return alert("Supplier name is required."),false;
      const row={name,mobile,contact:$("psContact").value.trim(),gstin:$("psGST").value.trim().toUpperCase(),address:$("psAddress").value.trim(),active:$("psActive").value==="1"};
      if(id){
        const r=await supabaseClient.from(SUP).update(row).eq("id",id);
        if(r.error){alert(r.error.message);return false}
      }else{
        const r=await supabaseClient.from(SUP).insert(row);
        if(r.error){alert(r.error.message);return false}
      }
      await load();
    });
}
function clearEntry(){
  ["puGR","puTruck","puBags","puWeight","puRate","puOil","puFFA","puRemarks"].forEach(id=>{if($(id))$(id).value=""});
  if($("puDate"))$("puDate").value=todayp();
  if($("puSupplier"))$("puSupplier").value="";
  updatePreview();
}
function draw(){
  const s=$("purchase");if(!s)return;
  if(S.err){
    s.innerHTML='<div class="panel"><div class="emptybox">Run <b>supabase/05_purchase_whatsapp.sql</b> first.<br>'+escp(S.err)+'</div></div>';
    return;
  }
  const nav='<div class="actions" style="margin-top:0;margin-bottom:14px">'+
    '<button class="'+(S.view==="entry"?"primary":"secondary")+'" data-pview="entry">Purchase Message</button>'+
    '<button class="'+(S.view==="suppliers"?"primary":"secondary")+'" data-pview="suppliers">Supplier Master</button>'+
    '<button class="'+(S.view==="history"?"primary":"secondary")+'" data-pview="history">Message History</button></div>';
  let body=nav;
  if(S.view==="entry"){
    body+='<div class="grid">'+
      '<div class="panel" style="margin:0"><h2>Purchase details</h2>'+
      '<div class="grid" style="grid-template-columns:repeat(2,minmax(0,1fr))">'+
      '<div class="field"><label>Supplier *</label><select id="puSupplier">'+supplierOpts()+'</select></div>'+
      '<div class="field"><label>Company name</label><input id="puCompany" value="'+escp(localStorage.getItem("sd_purchase_company")||"")+'" placeholder="Your company name"></div>'+
      '<div class="field"><label>Date *</label><input id="puDate" type="date" value="'+todayp()+'"></div>'+
      '<div class="field"><label>G.R. No.</label><input id="puGR" placeholder="GR-0001"></div>'+
      '<div class="field"><label>Truck No.</label><input id="puTruck" placeholder="OD02AB1234"></div>'+
      '<div class="field"><label>Bags</label><input id="puBags" type="number" min="0" step="1"></div>'+
      '<div class="field"><label>Weight (MT)</label><input id="puWeight" type="number" min="0" step=".001"></div>'+
      '<div class="field"><label>Rate (₹)</label><input id="puRate" type="number" min="0" step=".01"></div>'+
      '<div class="field"><label>Oil %</label><input id="puOil" type="number" min="0" step=".01"></div>'+
      '<div class="field"><label>FFA</label><input id="puFFA" placeholder="OK"></div>'+
      '<div class="field" style="grid-column:1/-1"><label>Remarks</label><input id="puRemarks" placeholder="Optional"></div>'+
      '</div>'+
      '<div class="actions"><button class="primary" data-savepurchase>Save & prepare WhatsApp</button><button class="secondary" data-clearpurchase>Clear</button></div></div>'+
      '<div class="panel" style="margin:0"><h2>Message preview</h2><textarea id="puPreview" readonly style="min-height:310px;resize:vertical"></textarea>'+
      '<div class="actions"><button class="primary" data-wa>📱 Open WhatsApp</button><button class="secondary" data-copy>Copy message</button></div>'+
      '<p class="small muted">WhatsApp opens with the message prepared. You still press Send yourself.</p></div></div>';
  }else if(S.view==="suppliers"){
    body+='<div class="panel"><h2>Purchase suppliers <button class="primary" data-newsupplier>+ Add supplier</button></h2>'+
      tbl(["Supplier","WhatsApp / Mobile","Contact","GSTIN","Status",""],S.suppliers.map(x=>'<tr><td><b>'+escp(x.name)+'</b></td><td>'+escp(x.mobile||"")+'</td><td>'+escp(x.contact||"")+'</td><td>'+escp(x.gstin||"")+'</td><td><span class="pill '+(x.active===false?"cancel":"")+'">'+(x.active===false?"Inactive":"Active")+'</span></td><td><button class="secondary btnsm" data-editsupplier="'+escp(x.id)+'">Edit</button> <button class="danger btnsm" data-delsupplier="'+escp(x.id)+'">Delete</button></td></tr>'))+'</div>';
  }else{
    body+='<div class="panel"><h2>Purchase WhatsApp history</h2>'+
      tbl(["Date","Supplier","GR No.","Truck","Weight","Rate","Message",""],S.messages.map(x=>'<tr><td>'+escp(x.date)+'</td><td><b>'+escp(x.supplier_name||"")+'</b></td><td>'+escp(x.gr_no||"")+'</td><td>'+escp(x.truck_no||"")+'</td><td>'+escp(x.weight||"")+'</td><td>'+moneyp(x.rate)+'</td><td><button class="secondary btnsm" data-viewmsg="'+escp(x.id)+'">View</button></td><td><button class="danger btnsm" data-delmsg="'+escp(x.id)+'">Delete</button></td></tr>'))+'</div>';
  }
  s.innerHTML=body;
  if(S.view==="entry"){
    ["puSupplier","puCompany","puDate","puGR","puTruck","puBags","puWeight","puRate","puOil","puFFA","puRemarks"].forEach(id=>$(id)?.addEventListener("input",updatePreview));
    $("puSupplier")?.addEventListener("change",updatePreview);
    updatePreview();
  }
}
function updatePreview(){
  const t=messageText();
  if($("puPreview"))$("puPreview").value=t;
  const c=$("puCompany");if(c)localStorage.setItem("sd_purchase_company",c.value);
}
async function savePurchase(){
  const supplier=S.suppliers.find(x=>x.id===$("puSupplier").value);
  if(!supplier)return alert("Select a supplier.");
  const text=messageText(),row={
    supplier_id:supplier.id,supplier_name:supplier.name,mobile:supplier.mobile||"",
    date:$("puDate").value,gr_no:$("puGR").value.trim(),truck_no:$("puTruck").value.trim(),
    bags:Number($("puBags").value||0),weight:Number($("puWeight").value||0),rate:Number($("puRate").value||0),
    oil:Number($("puOil").value||0),ffa:$("puFFA").value.trim(),remarks:$("puRemarks").value.trim(),
    message:text
  };
  if(!row.date)return alert("Date is required.");
  const r=await supabaseClient.from(MSG).insert(row).select().single();
  if(r.error)return alert(r.error.message);
  S.messages.unshift(r.data);
  alert("Purchase message saved.");
  updatePreview();
}
function currentText(){return $("puPreview")?.value||messageText()}
function openWA(){
  const supplier=S.suppliers.find(x=>x.id===$("puSupplier")?.value);
  if(!supplier)return alert("Select a supplier.");
  const p=phone(supplier.mobile);
  if(p.length<12)return alert("Supplier does not have a valid WhatsApp/mobile number.");
  window.open("https://wa.me/"+p+"?text="+encodeURIComponent(currentText()),"_blank","noopener");
}
function viewMsg(id){
  const x=S.messages.find(m=>m.id===id);if(!x)return;
  openModal("Purchase WhatsApp message · "+escp(x.supplier_name),
    '<textarea readonly style="min-height:320px;resize:vertical">'+escp(x.message||"")+'</textarea>'+
    '<div class="small muted" style="margin-top:8px">Number: '+escp(x.mobile||"")+'</div>',
    ()=>{return true});
}
async function deleteRow(table,id,msg){
  if(!confirm(msg))return;
  const r=await supabaseClient.from(table).delete().eq("id",id);
  if(r.error)return alert(r.error.message);
  await load();
}
const baseShow=window.showTab;
window.showTab=function(t){
  baseShow(t);
  const p=$("purchase");
  if(p)p.classList.toggle("hidden",t!=="purchase");
  if(t==="purchase"&&!S.loaded)load(); else if(t==="purchase")draw();
};
document.addEventListener("click",async e=>{
  const b=e.target.closest("[data-pview]"),wa=e.target.closest("[data-wa]"),cp=e.target.closest("[data-copy]");
  if(b){S.view=b.dataset.pview;draw();return}
  if(e.target.closest("[data-newsupplier]")){buildSupplierModal();return}
  const es=e.target.closest("[data-editsupplier]");if(es){buildSupplierModal(es.dataset.editsupplier);return}
  const ds=e.target.closest("[data-delsupplier]");if(ds){deleteRow(SUP,ds.dataset.delsupplier,"Delete this supplier?");return}
  const dm=e.target.closest("[data-delmsg]");if(dm){deleteRow(MSG,dm.dataset.delmsg,"Delete this purchase message?");return}
  const vm=e.target.closest("[data-viewmsg]");if(vm){viewMsg(vm.dataset.viewmsg);return}
  if(wa){openWA();return}
  if(cp){navigator.clipboard?.writeText(currentText()).then(()=>alert("Message copied."),()=>alert("Copy failed. Select and copy the preview manually."));return}
  if(e.target.closest("[data-savepurchase]")){await savePurchase();return}
  if(e.target.closest("[data-clearpurchase]")){clearEntry();return}
});
load();
})();