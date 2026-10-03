// Purchase WhatsApp: separate supplier master + purchase message generator.
// Does not use SalesDesk customer/party/order data.
(function(){
"use strict";
const $=id=>document.getElementById(id);
const S={suppliers:[],messages:[],loaded:false,view:"entry",err:""};
const SUP="purchase_suppliers", MSG="purchase_messages";
const escp=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function numbersOf(s){return String(s||"").split(/[\n,;]+/).map(x=>x.trim()).filter(Boolean)}
function firstPhone(s){return numbersOf(s)[0]||""}
function numberOptions(s){return numbersOf(s).map((n,i)=>'<option value="'+escp(n)+'">'+escp(n)+(i===0?" · Primary":"")+'</option>').join("")}
const moneyp=n=>"₹"+Number(n||0).toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2});
const todayp=()=>new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,10);

function messageText(){
  const supplier=$("puSupplierName")?.value.trim()||$("puSupplier")?.selectedOptions[0]?.textContent||"";
  const supplierObj=S.suppliers.find(x=>x.id===($("puSupplier")?.value||""));
  const supplierNo=$("puManualNumber")?.value.trim()||$("puNumber")?.value||firstPhone(supplierObj?.mobile||"");
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
    "Supplier Name: "+supplier+"\n"+
    "Supplier No.: "+supplierNo+"\n"+
    "Date: "+date+"\n"+
    "G.R. No.: "+gr+"\n"+
    "Truck No.: "+truck+"\n"+
    "Bags: "+bags+"\n"+
    "Weight: "+weight+" QTL\n"+
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
    '<div class="field"><label>WhatsApp numbers</label><textarea id="psMobile" rows="3" placeholder="One number per line\n9876543210\n9123456789">'+escp(String(e.mobile||"").split(/[,;]+/).join("\n"))+'</textarea><div class="small muted">Add more numbers on separate lines. The first number is the primary number.</div></div>'+
    fld("psContact","Contact person",e.contact)+
    fld("psGST","GSTIN",e.gstin)+
    fld("psAddress","Address",e.address)+
    '<div class="field"><label>Status</label><select id="psActive"><option value="1" '+(e.active===false?"":"selected")+'>Active</option><option value="0" '+(e.active===false?"selected":"")+'>Inactive</option></select></div>',
    async()=>{
      const name=$("psName").value.trim(),mobile=String($("psMobile").value||"").split(/[\n,;]+/).map(x=>x.trim()).filter(Boolean).join(",");
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
  const nav='<div class="purchaseNav">'+
    '<button class="'+(S.view==="entry"?"primary":"secondary")+'" data-pview="entry">✚ New Message</button>'+
    '<button class="'+(S.view==="suppliers"?"primary":"secondary")+'" data-pview="suppliers">👥 Suppliers</button>'+
    '<button class="'+(S.view==="history"?"primary":"secondary")+'" data-pview="history">🕘 History</button></div>';
  let body=nav;
  if(S.view==="entry"){
    body+=`
      <div class="purchaseHero">
        <div><div class="eyebrow">PURCHASE COMMUNICATION</div><h2>Send purchase details to supplier</h2><p>Enter the truck receipt details once. The WhatsApp message updates automatically.</p></div>
        <div class="heroBadge">WhatsApp Ready</div>
      </div>
      <div class="purchaseLayout">
        <div class="panel purchaseForm">
          <div class="sectionHead"><div><h2>1. Purchase details</h2><span>Basic truck and quality information</span></div><span class="stepNo">01</span></div>
          <div class="formSection">
            <div class="sectionTitle">Supplier</div>
            <div class="grid two">
              <div class="field"><label>Supplier from master</label><select id="puSupplier">${supplierOpts()}</select><div class="small muted">Select an existing supplier, or type a name below.</div></div>\n              <div class="field"><label>Supplier name for message *</label><input id="puSupplierName" placeholder="Type or paste supplier name"></div>\n              <div class="field"><label>Supplier number</label><select id="puNumber"><option value="">Select saved number</option></select><div class="small muted">If needed, type a number below.</div></div>\n              <div class="field"><label>WhatsApp number for this message</label><input id="puManualNumber" inputmode="tel" placeholder="9876543210"></div>
              <div class="field"><label>Company name</label><input id="puCompany" value="${escp(localStorage.getItem("sd_purchase_company")||"")}" placeholder="Your company name"></div>
            </div>
          </div>
          <div class="formSection">
            <div class="sectionTitle">Truck / receipt</div>
            <div class="grid three">
              <div class="field"><label>Date *</label><input id="puDate" type="date" value="${todayp()}"></div>
              <div class="field"><label>G.R. No.</label><input id="puGR" placeholder="GR-0001"></div>
              <div class="field"><label>Truck No.</label><input id="puTruck" placeholder="OD02AB1234"></div>
              <div class="field"><label>Bags</label><input id="puBags" type="number" min="0" step="1" placeholder="0"></div>
              <div class="field"><label>Weight (QTL)</label><input id="puWeight" type="number" min="0" step=".001" placeholder="0.000"></div>
              <div class="field"><label>Rate (₹ / QTL)</label><input id="puRate" type="number" min="0" step=".01" placeholder="0.00"></div>
            </div>
          </div>
          <div class="formSection">
            <div class="sectionTitle">Quality</div>
            <div class="grid two">
              <div class="field"><label>Oil %</label><input id="puOil" type="number" min="0" step=".01" placeholder="19.50"></div>
              <div class="field"><label>FFA</label><input id="puFFA" placeholder="OK"></div>
            </div>
          </div>
          <div class="formSection">
            <div class="sectionTitle">Remarks <span>Optional</span></div>
            <div class="field"><input id="puRemarks" placeholder="Shortage, quality note, payment note, etc."></div>
          </div>
          <div class="actions purchaseActions"><button class="primary" data-savepurchase>💾 Save message</button><button class="secondary" data-clearpurchase>Clear form</button></div>
        </div>
        <div class="panel purchasePreview">
          <div class="sectionHead"><div><h2>2. WhatsApp preview</h2><span>What the supplier will receive</span></div><span class="liveDot">● LIVE</span></div>
          <div class="waCard">
            <div class="waTop"><span>WhatsApp message</span><span>Preview</span></div>
            <textarea id="puPreview" readonly></textarea>
          </div>
          <div class="previewActions"><button class="primary" data-wa>📱 Open WhatsApp</button><button class="secondary" data-copy>Copy</button></div>
          <div class="tipBox"><b>How it works</b><br>Save the message for your records, then open WhatsApp. The message will already be filled in; you press <b>Send</b>.</div>
        </div>
      </div>
      <style>
        .purchaseNav{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px}
        .purchaseHero{display:flex;justify-content:space-between;align-items:center;gap:20px;padding:22px 24px;margin-bottom:14px;border:1px solid #dce3ec;border-radius:14px;background:linear-gradient(135deg,#f8fafc,#eef5ff)}
        .purchaseHero h2{margin:4px 0 6px}.purchaseHero p{margin:0;color:#667085}.eyebrow{font-size:11px;font-weight:800;letter-spacing:.12em;color:#315fe9}.heroBadge{padding:8px 12px;border-radius:999px;background:#e9f7ef;color:#147a42;font-size:12px;font-weight:700;white-space:nowrap}
        .purchaseLayout{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(340px,.85fr);gap:14px}.purchaseForm,.purchasePreview{margin:0}
        .sectionHead{display:flex;justify-content:space-between;align-items:center;gap:12px;border-bottom:1px solid #e8edf3;padding-bottom:13px;margin-bottom:18px}.sectionHead h2{margin:0 0 3px}.sectionHead span{font-size:12px;color:#7a8797}.stepNo{font-weight:800;font-size:12px!important;color:#315fe9!important;background:#edf3ff;padding:7px 9px;border-radius:8px}.liveDot{font-size:11px!important;font-weight:800;color:#16834b!important}
        .formSection{padding:0 0 18px;margin-bottom:18px;border-bottom:1px solid #eef1f5}.formSection:last-of-type{border-bottom:0}.sectionTitle{font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px;color:#475467}.sectionTitle span{font-weight:500;text-transform:none;letter-spacing:0;color:#98a2b3;margin-left:5px}
        .grid.two{grid-template-columns:repeat(2,minmax(0,1fr))}.grid.three{grid-template-columns:repeat(3,minmax(0,1fr))}
        .purchaseActions{margin-top:4px}.previewActions{display:flex;gap:8px;margin-top:12px}.waCard{border:1px solid #d9e1ea;border-radius:12px;overflow:hidden;background:#f5f7fa}.waTop{display:flex;justify-content:space-between;padding:10px 12px;background:#eef2f6;font-size:11px;font-weight:700;color:#667085}.waCard textarea{display:block;width:100%;min-height:350px;border:0;border-radius:0;background:#fff;padding:16px;font:13px/1.65 inherit;resize:vertical;box-sizing:border-box;outline:none}.tipBox{margin-top:14px;padding:12px 14px;border-radius:10px;background:#f8fafc;border:1px solid #e7ebf0;color:#667085;font-size:12px;line-height:1.5}.tipBox b{color:#344054}
        @media(max-width:900px){.purchaseLayout{grid-template-columns:1fr}.grid.three{grid-template-columns:repeat(2,minmax(0,1fr))}}
        @media(max-width:600px){.purchaseHero{align-items:flex-start;flex-direction:column}.grid.two,.grid.three{grid-template-columns:1fr}.purchaseHero{padding:18px}.purchasePreview .waCard textarea{min-height:280px}}
      </style>`;
  }else if(S.view==="suppliers"){
    body+='<div class="panel"><div class="sectionHead"><div><h2>Purchase suppliers</h2><span>Separate from Sales customers and parties</span></div><button class="primary" data-newsupplier>+ Add supplier</button></div>'+
      tbl(["Supplier","WhatsApp / Mobile","Contact","GSTIN","Status",""],S.suppliers.map(x=>'<tr><td><b>'+escp(x.name)+'</b></td><td>'+escp(x.mobile||"")+'</td><td>'+escp(x.contact||"")+'</td><td>'+escp(x.gstin||"")+'</td><td><span class="pill '+(x.active===false?"cancel":"")+'">'+(x.active===false?"Inactive":"Active")+'</span></td><td><button class="secondary btnsm" data-editsupplier="'+escp(x.id)+'">Edit</button> <button class="danger btnsm" data-delsupplier="'+escp(x.id)+'">Delete</button></td></tr>'))+'</div>';
  }else{
    body+='<div class="panel"><div class="sectionHead"><div><h2>Purchase WhatsApp history</h2><span>Last 100 saved purchase messages</span></div></div>'+
      tbl(["Date","Supplier","GR No.","Truck","Weight (QTL)","Rate / QTL","Message",""],S.messages.map(x=>'<tr><td>'+escp(x.date)+'</td><td><b>'+escp(x.supplier_name||"")+'</b></td><td>'+escp(x.gr_no||"")+'</td><td>'+escp(x.truck_no||"")+'</td><td>'+escp(x.weight||"")+'</td><td>'+moneyp(x.rate)+'</td><td><button class="secondary btnsm" data-viewmsg="'+escp(x.id)+'">View</button></td><td><button class="danger btnsm" data-delmsg="'+escp(x.id)+'">Delete</button></td></tr>'))+'</div>';
  }
  s.innerHTML=body;
  if(S.view==="entry"){
    ["puSupplier","puSupplierName","puNumber","puManualNumber","puCompany","puDate","puGR","puTruck","puBags","puWeight","puRate","puOil","puFFA","puRemarks"].forEach(id=>$(id)?.addEventListener("input",updatePreview));
    $("puSupplier")?.addEventListener("change",()=>{updateSupplierNumbers();updatePreview()});
    updateSupplierNumbers();
    updatePreview();
  }
}
function updateSupplierNumbers(){
  const s=S.suppliers.find(x=>x.id===($("puSupplier")?.value||""));
  const el=$("puNumber"); if(!el)return;
  el.innerHTML='<option value="">Select number</option>'+numberOptions(s?.mobile||"");
  if(numbersOf(s?.mobile||"").length===1) el.value=firstPhone(s.mobile);
}
function updatePreview(){
  const selected=$("puSupplier")?.value||"";
  const master=S.suppliers.find(x=>x.id===selected);
  const nameInput=$("puSupplierName");
  if(nameInput && !nameInput.value && master) nameInput.value=master.name;
  const t=messageText();
  if($("puPreview"))$("puPreview").value=t;
  const c=$("puCompany");if(c)localStorage.setItem("sd_purchase_company",c.value);
}
async function savePurchase(){
  const supplier=S.suppliers.find(x=>x.id===$("puSupplier").value);
  const supplierName=$("puSupplierName")?.value.trim();
  if(!supplierName)return alert("Enter or select a supplier name.");
  if(!supplier)return alert("Select a supplier from the list when saving to a master supplier.");
  const selectedNumber=$("puNumber")?.value||firstPhone(supplier.mobile);
  if(!selectedNumber)return alert("Add a supplier WhatsApp/mobile number first.");
  const text=messageText(),row={
    supplier_id:supplier?.id||null,supplier_name:supplierName,mobile:selectedNumber,
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
  const supplierName=$("puSupplierName")?.value.trim();
  if(!supplierName)return alert("Enter or select a supplier name.");
  if(!supplier)return alert("Select a supplier first so WhatsApp number can be used.");
  const selectedNumber=$("puNumber")?.value||firstPhone(supplier.mobile);
  const p=phone(selectedNumber);
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