/* SalesDesk Bill Studio
 * Standalone editable invoice composer. Drafts stay in this browser; existing
 * SalesDesk authentication, Supabase tables and invoice workflows are untouched.
 */
(function(){
"use strict";
const $=id=>document.getElementById(id), STORE="salesdesk_bill_studio_v1";
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const today=()=>{const d=new Date();return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10)};
const num=v=>Number(v||0), money=v=>"₹"+num(v).toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2});
const fmt=v=>num(v).toLocaleString("en-IN",{maximumFractionDigits:3});
const field=(id,label,value="",type="text",hint="")=>'<div class="field"><label for="'+id+'">'+label+'</label><input id="'+id+'" type="'+type+'" value="'+esc(value)+'" '+hint+'></div>';
const defaults={
 coName:"Sriyansh Solvent Solutions Pvt Ltd",coAddress:"At-Kamira, Po-Singhijuba, Via-Binka, Dist-Sonepur-767045 (Odisha)",
 coCin:"U15400OR2021PTC036324",coFssai:"12023029000027",coGst:"21ABFCS9819Q1ZN",coState:"Odisha",coStateCode:"21",coEmail:"sriyanshsolvent2023@gmail.com",
 bankName:"Bank of Baroda (CC) - 1244",bankBranch:"Barpali",bankAccount:"39790500001244",bankIfsc:"BARB0BARAPA"
};
const defs=[
["invNo","Invoice No.","SRO/26-27/","text"],["invDate","Dated",today(),"date"],["ewayNo","e-Way Bill No.","","text"],["deliveryNote","Delivery Note","","text"],
["paymentTerms","Mode / Terms of Payment","","text"],["qualityCondition","Quality Condition","NILL","text"],["referenceNo","Reference No. & Date.","","text"],["lrNo","LR No.","","text"],["lrDate","LR Date","","date"],
["transporter","Transporter","","text"],["dispatchFrom","Despatch From (Place)","Singhijuba","text"],["destination","Destination","GAJABANDH","text"],["bolNo","Bill of Lading / LR-RR No.","","text"],["vehicleNo","Vehicle No.","","text"],["broker","Broker Name","","text"],["driverMobile","Driver Mobile No.","","text"],["driverName","Driver Name","","text"],["driverDL","Driver DL No.","","text"],["ownerName","Owner Name","","text"],["poDate","PO No. & Date.","","text"],["termsDelivery","Terms of Delivery","Ex-Factory","text"],
["buyerName","Buyer (Bill to)","","text"],["buyerAddress","Buyer Address","","text"],["buyerGst","Buyer GSTIN / UIN","","text"],["buyerPin","Buyer PIN Code","","text"],["buyerState","Buyer State","","text"],["buyerStateCode","Buyer State Code","","text"],["buyerContactPerson","Contact Person","","text"],["buyerContact","Contact","","text"],
["shipName","Despatch To","","text"],["shipAddress","Despatch To Address","","text"],["shipGst","Despatch To GSTIN","","text"],["shipState","Despatch To State","","text"],["shipStateCode","Despatch To State Code","","text"],["shipPin","Despatch To PIN Code","","text"],["remarks","Remarks / Quality / Weight","","text"]
];
let lineSeq=0;
function render(){
 const root=$("billStudio");if(!root||root.dataset.ready)return;root.dataset.ready="1";
 root.innerHTML='<div class="panel"><div class="billstudio-head"><div><h2>Bill Studio</h2><p>Create an editable tax invoice in the same structured format as the supplied company bill.</p></div><span class="tag">No QR · No IRN / ACK panel · No e-Way annexure</span></div>'+
 '<div class="bs-upload" style="margin-top:14px"><div><strong>Upload an existing invoice PDF</strong><small>Extract text from digital PDFs, then review and edit every field before printing.</small><div id="bsUploadStatus" class="bs-status" role="status">PDF extraction is processed in this browser.</div></div><label class="secondary" for="bsPdf" style="cursor:pointer">Choose PDF<input id="bsPdf" type="file" accept="application/pdf,.pdf" hidden></label></div>'+
 '<p class="bs-help">Note: scanned/image-only PDFs need OCR and may not extract automatically. No uploaded PDF is sent to the server.</p></div>'+
 '<form id="bsForm" class="panel"><div class="bs-block-title">Company details</div><div class="bs-grid">'+
 field("coName","Company Name",defaults.coName)+field("coGst","GSTIN / UIN",defaults.coGst)+field("coCin","CIN",defaults.coCin)+field("coFssai","FSSAI",defaults.coFssai)+
 field("coAddress","Registered Address",defaults.coAddress)+field("coState","State Name",defaults.coState)+field("coStateCode","State Code",defaults.coStateCode)+field("coEmail","E-mail",defaults.coEmail)+
 field("bankName","Bank Name",defaults.bankName)+field("bankBranch","Branch",defaults.bankBranch)+field("bankAccount","A/c No.",defaults.bankAccount)+field("bankIfsc","Branch & IFSC Code",defaults.bankIfsc)+'</div>'+
 '<div class="bs-block-title">Invoice details</div><div class="bs-grid">'+defs.slice(0,21).map(x=>field(...x)).join("")+'</div>'+
 '<div class="bs-block-title">Buyer (Bill to)</div><div class="bs-grid">'+defs.slice(21,30).map(x=>field(...x)).join("")+'</div>'+
 '<div class="bs-block-title">Despatch To</div><div class="bs-grid">'+defs.slice(30,36).map(x=>field(...x)).join("")+'</div>'+
 '<div class="bs-block-title">Goods / Services</div><div class="bs-lines tablewrap"><table><thead><tr><th>Sl No.</th><th>Description of Goods</th><th>Bags / TIN</th><th>HSN/SAC</th><th>Quantity</th><th>Unit</th><th>Rate (Incl. Tax)</th><th>Rate</th><th>Per</th><th>Amount</th><th></th></tr></thead><tbody id="bsLines"></tbody></table></div><div class="bs-actions"><button type="button" class="secondary" id="bsAddLine">＋ Add item</button></div>'+
 '<div class="bs-totals"><div><div class="bs-block-title" style="margin-top:0">Tax / adjustment settings</div><div class="bs-grid">'+
 '<div class="field"><label for="taxMode">Tax mode</label><select id="taxMode"><option value="intra">Output CGST + Output SGST</option><option value="inter">Output IGST</option></select></div>'+
 field("gstRate","GST Rate %","5","number",'min="0" max="100" step=".01"')+field("otherAmount","Other Amount (₹)","0","number",'step=".01"')+field("roundOff","Round Off (₹)","0","number",'step=".01"')+'</div>'+
 '<div class="bs-block-title">Declaration / signature</div><div class="bs-grid">'+field("declaration","Declaration","We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.")+field("jurisdiction","Jurisdiction","SUBARNAPUR JURISDICTION")+field("preparedBy","Prepared By","")+field("checkedBy","Checked By","")+field("authorisedBy","Authorised Signatory","Authorised Signatory")+'</div></div>'+
 '<div class="bs-total-list" id="bsTotals"></div></div>'+
 '<div class="field" style="margin-top:12px"><label for="remarks">Remarks</label><textarea id="remarks" rows="2">'+esc(defs[36][2])+'</textarea></div>'+
 '<div class="bs-actions"><button type="button" class="primary" id="bsPrint">Preview / Print / Save as PDF</button><button type="button" class="secondary" id="bsSave">Save Draft</button><button type="button" class="secondary" id="bsClear">Clear Form</button></div></form>'+
 '<div class="panel"><h2>Saved drafts on this device</h2><div id="bsDrafts" class="bs-drafts"></div></div>';
 addLine();
 $("bsAddLine").addEventListener("click",()=>addLine());
 $("bsForm").addEventListener("input",calc);
 $("bsForm").addEventListener("change",calc);
 $("bsPrint").addEventListener("click",printBill);
 $("bsSave").addEventListener("click",saveDraft);
 $("bsClear").addEventListener("click",()=>{if(confirm("Clear the current bill form?"))resetForm()});
 $("bsPdf").addEventListener("change",uploadPdf);
 renderDrafts();calc();
}
function addLine(v={}){
 const body=$("bsLines");if(!body)return;const id=++lineSeq,tr=document.createElement("tr");tr.dataset.line=id;
 tr.innerHTML='<td class="bs-sno"></td><td><input class="bs-desc" aria-label="Description" value="'+esc(v.description||"")+'"></td><td><input class="bs-bags" type="number" min="0" step=".001" value="'+esc(v.bags??"")+'"></td><td><input class="bs-hsn" value="'+esc(v.hsn||"")+'"></td><td><input class="bs-qty" type="number" min="0" step=".001" value="'+esc(v.qty??"")+'"></td><td><input class="bs-unit" value="'+esc(v.unit||"Tin")+'"></td><td><input class="bs-incl" type="number" min="0" step=".01" value="'+esc(v.inclRate??"")+'"></td><td><input class="bs-rate" type="number" min="0" step=".01" value="'+esc(v.rate??"")+'"></td><td><input class="bs-per" value="'+esc(v.per||"Tin")+'"></td><td class="bs-amount">₹0.00</td><td><button type="button" class="danger bs-remove" aria-label="Remove item">×</button></td>';
 tr.querySelector(".bs-remove").addEventListener("click",()=>{tr.remove();renumber();calc()});
 tr.querySelectorAll("input").forEach(x=>x.addEventListener("input",calc));body.appendChild(tr);renumber();calc();
}
function renumber(){[...($("bsLines")?.rows||[])].forEach((r,i)=>r.querySelector(".bs-sno").textContent=i+1)}
function lines(){return [...($("bsLines")?.rows||[])].map(r=>({description:r.querySelector(".bs-desc").value.trim(),bags:num(r.querySelector(".bs-bags").value),hsn:r.querySelector(".bs-hsn").value.trim(),qty:num(r.querySelector(".bs-qty").value),unit:r.querySelector(".bs-unit").value.trim(),inclRate:num(r.querySelector(".bs-incl").value),rate:num(r.querySelector(".bs-rate").value),per:r.querySelector(".bs-per").value.trim(),gst:num($("gstRate").value)})).filter(x=>x.description||x.qty||x.rate)}
function totals(){
 const ls=lines(),taxable=ls.reduce((a,x)=>a+x.qty*x.rate,0),gst=taxable*num($("gstRate").value)/100,inter=$("taxMode").value==="inter",cg=inter?0:gst/2,sg=inter?0:gst/2,ig=inter?gst:0,other=num($("otherAmount").value),round=num($("roundOff").value),total=taxable+cg+sg+ig+other+round;
 return{ls,taxable,cg,sg,ig,other,round,total};
}
function calc(){
 if(!$("bsTotals"))return;const t=totals();[...$("bsLines").rows].forEach(r=>{const q=num(r.querySelector(".bs-qty").value),rate=num(r.querySelector(".bs-rate").value);r.querySelector(".bs-amount").textContent=money(q*rate)});
 $("bsTotals").innerHTML='<div class="bs-total-row"><span>Taxable Value</span><strong>'+money(t.taxable)+'</strong></div>'+
 '<div class="bs-total-row"><span>Output CGST</span><strong>'+money(t.cg)+'</strong></div><div class="bs-total-row"><span>Output SGST</span><strong>'+money(t.sg)+'</strong></div>'+
 '<div class="bs-total-row"><span>Output IGST</span><strong>'+money(t.ig)+'</strong></div><div class="bs-total-row"><span>Other Amount</span><strong>'+money(t.other)+'</strong></div>'+
 '<div class="bs-total-row"><span>Round Off</span><strong>'+money(t.round)+'</strong></div><div class="bs-total-row grand"><span>Total</span><strong>'+money(t.total)+'</strong></div>';
}
function val(id){return $(id)?.value||""}
function readBill(){const o={};[...defaults&&Object.keys(defaults),...defs.map(x=>x[0]),"taxMode","gstRate","otherAmount","roundOff","declaration","jurisdiction","preparedBy","checkedBy","authorisedBy","remarks"].forEach(k=>o[k]=val(k));o.lines=lines();return o}
function setVal(id,v){if($(id)&&v!==undefined&&v!==null)$(id).value=v}
function fillBill(o){Object.keys(o||{}).forEach(k=>{if(k!=="lines")setVal(k,o[k])});$("bsLines").innerHTML="";lineSeq=0;(o.lines||[]).forEach(addLine);if(!(o.lines||[]).length)addLine();calc()}
function amountWords(n){
 let x=Math.round(num(n));if(!x)return"Zero Only";const a=["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"],b=["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];
 const h=v=>v<20?a[v]:v<100?b[Math.floor(v/10)]+(v%10?" "+a[v%10]:""):a[Math.floor(v/100)]+" Hundred"+(v%100?" "+h(v%100):"");
 let s="";if(x>=1e7){s+=h(Math.floor(x/1e7))+" Crore ";x%=1e7}if(x>=1e5){s+=h(Math.floor(x/1e5))+" Lakh ";x%=1e5}if(x>=1e3){s+=h(Math.floor(x/1e3))+" Thousand ";x%=1e3}if(x){s+=h(x)+" "}return("INR "+s.trim()+" Only").replace(/\s+/g," ");
}
function printHTML(o){
 const t=(()=>{const ls=o.lines||[],tax=ls.reduce((a,x)=>a+num(x.qty)*num(x.rate),0),gst=tax*num(o.gstRate)/100,inter=o.taxMode==="inter";return{tax,cg:inter?0:gst/2,sg:inter?0:gst/2,ig:inter?gst:0,total:tax+gst+num(o.otherAmount)+num(o.roundOff)}})();
 const f=k=>esc(o[k]||"—"),m=money;
 const detail=(label,key)=>'<div class="d"><b>'+label+'</b><span>'+f(key)+'</span></div>';
 const rows=(o.lines||[]).map((x,i)=>'<tr><td>'+ (i+1)+'</td><td><b>'+esc(x.description)+'</b></td><td>'+esc(x.bags||"")+'</td><td>'+esc(x.hsn)+'</td><td class="r">'+fmt(x.qty)+' '+esc(x.unit)+'</td><td class="r">'+m(x.inclRate)+'</td><td class="r">'+m(x.rate)+'</td><td>'+esc(x.per)+'</td><td class="r">'+m(x.qty*x.rate)+'</td></tr>').join("");
 return '<!doctype html><html><head><meta charset="utf-8"><title>'+f("invNo")+'</title><style>'+
 '@page{size:A4;margin:9mm}*{box-sizing:border-box}body{font:10px Arial,sans-serif;color:#202a36;margin:0}.page{width:100%;margin:auto}.top{display:grid;grid-template-columns:1.45fr .75fr;border-bottom:1px solid #222;padding-bottom:8px}.co h1{font-size:17px;margin:0 0 4px}.co p{margin:2px 0;line-height:1.3}.title{text-align:right}.title h2{font-size:18px;margin:0 0 7px}.title b{font-size:12px}.twocol{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin:9px 0}.box{border:1px solid #777;padding:7px;min-height:76px}.box h3{font-size:10px;margin:0 0 5px;text-decoration:underline}.box p{margin:2px 0;line-height:1.25}.meta{display:grid;grid-template-columns:1fr 1fr 1fr;gap:0;border:1px solid #777;margin:7px 0}.meta .cell{padding:5px 6px;border-right:1px solid #aaa;border-bottom:1px solid #aaa;min-height:29px}.meta .cell:nth-child(3n){border-right:0}.meta small{display:block;color:#555;font-size:8px}.meta b{display:block;margin-top:2px;font-size:9px;min-height:10px}.items{width:100%;border-collapse:collapse;margin-top:7px}.items th,.items td{border:1px solid #777;padding:5px 4px;vertical-align:top}.items th{font-size:8px;background:#f1f1f1;text-align:left}.items td{font-size:9px}.r{text-align:right}.summary{display:grid;grid-template-columns:1.1fr .9fr;gap:12px;margin-top:8px}.taxes{width:100%;border-collapse:collapse}.taxes td{padding:3px 5px;border-bottom:1px solid #ddd}.taxes td:last-child{text-align:right}.grand td{font-weight:bold;border-top:1px solid #222;font-size:12px;padding-top:6px}.words{border:1px solid #777;padding:7px;margin-top:8px}.bottom{display:grid;grid-template-columns:1.2fr .8fr;gap:12px;margin-top:8px}.bottom h4{font-size:9px;margin:0 0 4px}.bottom p{margin:2px 0;line-height:1.3}.sign{border-top:1px solid #777;margin-top:25px;padding-top:6px;text-align:right}.sign .space{height:26px}.declaration{border:1px solid #aaa;padding:6px;margin-top:7px}.jur{text-align:center;font-weight:bold;margin-top:8px;border-top:1px solid #777;padding-top:5px;font-size:9px}.muted{color:#555}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body><main class="page">'+
 '<header class="top"><div class="co"><h1>'+f("coName")+'</h1><p>'+f("coAddress")+'</p><p>CIN: '+f("coCin")+' &nbsp; FSSAI: '+f("coFssai")+'</p><p>GSTIN/UIN: '+f("coGst")+'</p><p>State Name: '+f("coState")+', Code: '+f("coStateCode")+'</p><p>E-Mail: '+f("coEmail")+'</p></div><div class="title"><h2>TAX INVOICE</h2><b>Invoice No. &nbsp; Dated</b><p>'+f("invNo")+' &nbsp; '+f("invDate")+'</p><p><b>e-Way Bill No.</b> '+f("ewayNo")+'</p></div></header>'+
 '<div class="twocol"><section class="box"><h3>Buyer (Bill to)</h3><p><b>'+f("buyerName")+'</b></p><p>'+f("buyerAddress")+'</p><p>GSTIN/UIN: '+f("buyerGst")+'</p><p>PIN Code: '+f("buyerPin")+'</p><p>State Name: '+f("buyerState")+', Code: '+f("buyerStateCode")+'</p><p>Contact Person: '+f("buyerContactPerson")+' &nbsp; Contact: '+f("buyerContact")+'</p></section><section class="box"><h3>Despatch To</h3><p><b>'+f("shipName")+'</b></p><p>'+f("shipAddress")+'</p><p>GSTIN/UIN: '+f("shipGst")+'</p><p>State Name: '+f("shipState")+', Code: '+f("shipStateCode")+'</p><p>PIN Code: '+f("shipPin")+'</p></section></div>'+
 '<div class="meta">'+detail("Delivery Note","deliveryNote")+detail("Mode / Terms of Payment","paymentTerms")+detail("Quality Condition","qualityCondition")+detail("Reference No. & Date","referenceNo")+detail("LR No.","lrNo")+detail("LR Date","lrDate")+detail("Transporter","transporter")+detail("Despatch From (Place)","dispatchFrom")+detail("Destination","destination")+detail("Bill of Lading / LR-RR No.","bolNo")+detail("Vehicle No.","vehicleNo")+detail("Broker Name","broker")+detail("Driver Mobile No.","driverMobile")+detail("Driver Name","driverName")+detail("Driver DL No.","driverDL")+detail("Owner Name","ownerName")+detail("PO No. & Date","poDate")+detail("Terms of Delivery","termsDelivery")+'</div>'+
 '<table class="items"><thead><tr><th>Sl No.</th><th>Description of Goods</th><th>Bags/TIN</th><th>HSN/SAC</th><th>Quantity</th><th>Rate (Incl. Tax)</th><th>Rate</th><th>Per</th><th>Amount</th></tr></thead><tbody>'+rows+'</tbody></table>'+
 '<div class="summary"><div><div class="words"><b>Amount Chargeable (in words)</b><p>'+esc(amountWords(t.total))+'</p><small class="muted">E. &amp; O.E.</small></div><div class="declaration"><b>Declaration</b><p>'+f("declaration")+'</p></div></div><table class="taxes"><tr><td>Taxable Amount</td><td>'+m(t.tax)+'</td></tr><tr><td>Output CGST</td><td>'+m(t.cg)+'</td></tr><tr><td>Output SGST</td><td>'+m(t.sg)+'</td></tr><tr><td>Output IGST</td><td>'+m(t.ig)+'</td></tr><tr><td>Other Amount</td><td>'+m(o.otherAmount)+'</td></tr><tr><td>Round Off</td><td>'+m(o.roundOff)+'</td></tr><tr class="grand"><td>Total</td><td>'+m(t.total)+'</td></tr></table></div>'+
 '<p><b>Remarks:</b> '+f("remarks")+'</p><div class="bottom"><div><h4>Bank Details</h4><p>'+f("bankName")+'</p><p>Branch: '+f("bankBranch")+'</p><p>A/c No.: '+f("bankAccount")+'</p><p>Branch &amp; IFSC Code: '+f("bankIfsc")+'</p></div><div><h4>For '+f("coName")+'</h4><div class="sign"><div class="space"></div><b>'+f("authorisedBy")+'</b><p>Authorised Signatory</p></div></div></div>'+
 '<div class="declaration"><b>Prepared By:</b> '+f("preparedBy")+' &nbsp;&nbsp; <b>Checked By:</b> '+f("checkedBy")+'</div><div class="jur">SUBJECT TO '+f("jurisdiction")+'</div></main></body></html>';
}
function printBill(){const o=readBill();if(!o.invNo.trim())return alert("Enter invoice number.");if(!o.lines.length)return alert("Add at least one invoice item.");const w=window.open("","_blank","width=1000,height=800");if(!w)return alert("Allow pop-ups to preview or save as PDF.");w.document.open();w.document.write(printHTML(o));w.document.close();w.focus();setTimeout(()=>w.print(),350)}
function getDrafts(){try{return JSON.parse(localStorage.getItem(STORE)||"[]")}catch(e){return[]}}
function saveDraft(){const o=readBill();if(!o.invNo.trim())return alert("Enter invoice number before saving.");const a=getDrafts(),id=Date.now(),existing=a.findIndex(x=>x.data.invNo===o.invNo);if(existing>=0){a[existing]={id:a[existing].id,data:o,updated:new Date().toISOString()}}else a.unshift({id,data:o,updated:new Date().toISOString()});localStorage.setItem(STORE,JSON.stringify(a.slice(0,30)));renderDrafts();alert("Draft saved on this device.")}
function renderDrafts(){const el=$("bsDrafts");if(!el)return;const a=getDrafts();el.innerHTML=a.length?a.map(x=>'<div class="bs-draft"><div><b>'+esc(x.data.invNo||"Untitled")+'</b><small>'+esc(x.data.buyerName||"No buyer")+' · '+esc(x.updated?.slice(0,10)||"")+'</small></div><div class="bs-actions" style="margin:0"><button type="button" class="secondary btnsm" data-bs-load="'+x.id+'">Open</button><button type="button" class="danger btnsm" data-bs-delete="'+x.id+'">Delete</button></div></div>').join(""):'<div class="emptybox">No saved drafts on this device yet.</div>'}
function resetForm(){document.querySelectorAll("#bsForm input,#bsForm textarea").forEach(x=>{if(x.id in defaults)x.value=defaults[x.id];else if(x.type==="date")x.value=today();else if(x.id==="gstRate")x.value="5";else x.value=""});$("taxMode").value="intra";$("otherAmount").value="0";$("roundOff").value="0";$("bsLines").innerHTML="";lineSeq=0;addLine();calc()}
function status(s){$("bsUploadStatus").textContent=s}
async function uploadPdf(e){
 const file=e.target.files?.[0];if(!file)return;if(file.type!=="application/pdf"&&!file.name.toLowerCase().endsWith(".pdf")){status("Please choose a PDF file.");return}
 if(!window.pdfjsLib){status("PDF reader did not load. Refresh the page and try again.");return}
 status("Reading PDF locally…");
 try{
  pdfjsLib.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  const bytes=new Uint8Array(await file.arrayBuffer()),pdf=await pdfjsLib.getDocument({data:bytes}).promise;let raw="";
  let rawLines="";for(let n=1;n<=Math.min(pdf.numPages,2);n++){const page=await pdf.getPage(n),content=await page.getTextContent();let line="";for(const item of content.items){line+=(item.str||"")+" ";if(item.hasEOL){rawLines+=line.trim()+"\n";line=""}}if(line.trim())rawLines+=line.trim()+"\n";raw+=" "+content.items.map(x=>x.str).join(" ")}
  raw=raw.replace(/\s+/g," ").trim();if(raw.length<80){status("This looks like a scanned/image-only PDF. Automatic text extraction could not read it; please enter the details manually.");return}
  const match=(re)=>{const m=raw.match(re);return m?m[1].trim():""};
  const set=(id,v)=>{if(v)setVal(id,v)};
  set("coName",match(/(Sriyansh Solvent Solutions Pvt Ltd)/i));
  set("coAddress",match(/(At-Kamira,?\s*Po-Singhijuba,?\s*Via-Binka,?\s*Dist-Sonepur-?767045\s*\(Odisha\))/i));
  set("coCin",match(/CIN\s*:\s*([A-Z0-9]+)/i));set("coFssai",match(/FSSAI\s*:\s*([0-9]+)/i));set("coGst",match(/GSTIN\/UIN\s*:\s*([0-9A-Z]{15})/i));set("coEmail",match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i));
  set("invNo",match(/Invoice No\.?\s*(?:e-Way Bill No\.?\s*)?([A-Z0-9/-]+)\s+[0-9]{6,}/i)||match(/Invoice No\.?\s*([A-Z0-9/-]+)/i));
  set("invDate",(()=>{const d=match(/(?:Dated|Date)\s*([0-9]{1,2}-[A-Za-z]{3}-[0-9]{2,4})/i);if(!d)return"";const z=new Date(d.replace(/-/g," "));return isNaN(z)? "":z.toISOString().slice(0,10)})());
  set("ewayNo",match(/e-Way Bill No\.?\s*([0-9]{8,})/i));
  set("buyerName",match(/Buyer\s*\(Bill to\)\s+([A-Z][A-Z0-9 &.-]{2,})/i));
  set("buyerGst",match(/GSTIN\/UIN\s*:\s*([0-9A-Z]{15})/ig)?.[0]||"");
  const gstMatches=[...raw.matchAll(/GSTIN\/UIN\s*:?\s*([0-9A-Z]{15})/ig)].map(x=>x[1]);if(gstMatches[1])set("buyerGst",gstMatches[1]);if(gstMatches[2])set("shipGst",gstMatches[2]);
  const block=(start,end)=>{const re=new RegExp(start+"\\s*([\\s\\S]*?)\\s*"+end,"i"),m=rawLines.match(re);return m?m[1].split("\n").map(x=>x.trim()).filter(x=>x&&!/^(:|GSTIN|PIN Code|Contact person|Contact|State Name|E-Mail)/i.test(x)):[]};
  const buyerLines=block("Buyer\\s*\\(Bill to\\)","Despatch To"),shipLines=block("Despatch To","Invoice No");
  if(buyerLines[0])set("buyerName",buyerLines[0]);if(buyerLines.length>1)set("buyerAddress",buyerLines.slice(1).join(", "));
  if(shipLines[0])set("shipName",shipLines[0]);if(shipLines.length>1)set("shipAddress",shipLines.slice(1).join(", "));
  const pins=[...raw.matchAll(/PIN Code\s*:?\s*(\d{6})/ig)].map(x=>x[1]);if(pins[0])set("buyerPin",pins[0]);if(pins[1])set("shipPin",pins[1]);set("buyerState",match(/State Name\s*:\s*([A-Za-z ]+),\s*Code/i));set("buyerStateCode",match(/State Name\s*:\s*[A-Za-z ]+,\s*Code\s*:\s*(\d{1,2})/i));
  set("dispatchFrom",match(/Despatch From\s*\(Place\)\s+([A-Za-z -]+)/i));set("destination",match(/Destination\s+([A-Za-z -]+)/i));set("vehicleNo",match(/Vehicle No\.\s*([A-Z0-9]+)/i));set("remarks",match(/Remarks:\s*(.+?)\s+Amount Chargeable/i));set("broker",match(/Broker Name\s+([A-Z][A-Z ]+)/i));set("termsDelivery",match(/Terms of Delivery\s+([A-Za-z-]+)/i));
  set("bankAccount",match(/A\/c No\.\s*:\s*([0-9]+)/i));set("bankIfsc",match(/Branch & IFS Code\s*:\s*[^ ]+\s*&\s*([A-Z0-9]+)/i));
  const cg=match(/Output CGST\s+([\d,]+\.\d{2})/i),sg=match(/Output SGST\s+([\d,]+\.\d{2})/i);const taxable=match(/Tot\.Taxable Amt\s*:\s*([\d,]+\.\d{2})/i)||match(/Amount\s+([\d,]+\.\d{2})\s+Output CGST/i);
  const total=match(/Total Inv Amt\s*:\s*([\d,]+\.\d{2})/i)||match(/Total\s+\d+\s+\d+\s+[A-Za-z]+\s+₹?\s*([\d,]+\.\d{2})/i);
  const round=match(/RoundOff\s+\(?(-?[\d,]+\.\d{2})\)?/i);if(cg&&sg){set("taxMode","intra");set("gstRate","5")}
  if(round)set("roundOff",round.replace(/,/g,""));
  const hsn=match(/(\d{8})\s+\d+\s+(?:Tin|PCS|QTL|KG|MT)/i);
  if(hsn){const idx=raw.indexOf(hsn),before=raw.slice(Math.max(0,idx-90),idx),descLine=(rawLines.match(/(?:^|\n)\s*1\s+([^\n]+)/)||[])[1]||"",desc=(descLine.replace(/\s+[\d,]+\.\d{2}.*$/,"").trim()||(before.match(/([A-Za-z][A-Za-z0-9 ()/&.-]{4,70})\s+\d+\s*$/)||[])[1]||"");
    const tail=raw.slice(idx),q=tail.match(/^\d{8}\s+(\d+)\s+(Tin|PCS|QTL|KG|MT)\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s+(Tin|PCS|QTL|KG|MT)\s+([\d,]+\.\d{2})/i);
    if(q){$("bsLines").innerHTML="";lineSeq=0;addLine({description:desc||"Imported item",bags:Number(q[1]),hsn,qty:Number(q[1]),unit:q[2],inclRate:num(q[3].replace(/,/g,"")),rate:num(q[4].replace(/,/g,"")),per:q[5],gst:5})}
  }
  if(taxable&&$("bsLines").rows.length){const target=num(taxable.replace(/,/g,"")),l=lines()[0];if(l?.qty>0&&Math.abs(l.qty*l.rate-target)>0.02)$("bsLines").rows[0].querySelector(".bs-rate").value=(target/l.qty).toFixed(2)}
  if(total&&taxable){const calculated=totals().total,expected=num(total.replace(/,/g,""));if(Math.abs(calculated-expected)>.02)$("roundOff").value=(num($("roundOff").value)+(expected-calculated)).toFixed(2)}
  calc();status("Text extracted from "+pdf.numPages+" page(s). Please verify all values and edit anything incorrect before printing.");
 }catch(err){console.error("Bill Studio PDF import:",err);status("Could not read this PDF. Try a text-based PDF or enter the details manually.")}
 finally{e.target.value=""}
}
document.addEventListener("click",e=>{
 const load=e.target.closest("[data-bs-load]");if(load){const x=getDrafts().find(d=>String(d.id)===load.dataset.bsLoad);if(x)fillBill(x.data)}
 const del=e.target.closest("[data-bs-delete]");if(del){const a=getDrafts().filter(d=>String(d.id)!==del.dataset.bsDelete);localStorage.setItem(STORE,JSON.stringify(a));renderDrafts()}
});
document.addEventListener("DOMContentLoaded",render);
})();
