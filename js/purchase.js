// SalesDesk Purchase WhatsApp module
// Separate supplier master. Supports saved suppliers OR manual supplier name/number.
(function(){
  "use strict";

  const $ = id => document.getElementById(id);
  const S = { suppliers: [], messages: [], loaded:false, view:"entry", err:"" };
  const SUP = "purchase_suppliers";
  const MSG = "purchase_messages";

  const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));

  const nums = v => String(v || "").split(/[\n,;]+/).map(x=>x.trim()).filter(Boolean);
  const firstNum = v => nums(v)[0] || "";
  const money = v => "₹" + Number(v || 0).toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2});
  const today = () => new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,10);

  function supplierByInput(){
    const value = ($( "puSupplier" )?.value || "").trim().toLowerCase();
    if(!value) return null;
    return S.suppliers.find(x => String(x.name || "").trim().toLowerCase() === value) || null;
  }

  function supplierList(){
    return S.suppliers
      .filter(x=>x.active!==false)
      .sort((a,b)=>String(a.name).localeCompare(String(b.name)))
      .map(x=>'<option value="'+esc(x.name)+'"></option>')
      .join("");
  }

  function numberOptions(supplier){
    const list = nums(supplier?.mobile);
    return '<option value="">Select saved number</option>' +
      list.map((n,i)=>'<option value="'+esc(n)+'">'+esc(n)+(i===0?' · Primary':'')+'</option>').join("");
  }

  function messageText(){
    const supplier = ($( "puSupplier" )?.value || "").trim();
    const savedNumber = $( "puNumber" )?.value || "";
    const manualNumber = ($( "puManualNumber" )?.value || "").trim();
    const master = supplierByInput();
    const number = manualNumber || savedNumber || firstNum(master?.mobile);
    const company = ($( "puCompany" )?.value || "").trim();
    const date = $( "puDate" )?.value || "";
    const gr = ($( "puGR" )?.value || "").trim();
    const truck = ($( "puTruck" )?.value || "").trim();
    const bags = $( "puBags" )?.value || "";
    const weight = $( "puWeight" )?.value || "";
    const rate = $( "puRate" )?.value || "";
    const oil = $( "puOil" )?.value || "";
    const ffa = ($( "puFFA" )?.value || "").trim();
    const remarks = ($( "puRemarks" )?.value || "").trim();

    return "*PURCHASE DETAILS*\n\n" +
      "Supplier Name: " + supplier + "\n" +
      "Supplier No.: " + number + "\n" +
      "Date: " + date + "\n" +
      "G.R. No.: " + gr + "\n" +
      "Truck No.: " + truck + "\n" +
      "Bags: " + bags + "\n" +
      "Weight: " + weight + " QTL\n" +
      "Rate: " + (rate ? money(rate) + " / QTL" : "") + "\n" +
      "Oil: " + (oil ? oil + "%" : "") + "\n" +
      "FFA: " + ffa + "\n" +
      (remarks ? "Remarks: " + remarks + "\n" : "") +
      (company ? "\n*" + company + "*" : "");
  }

  function updatePreview(){
    const preview = $( "puPreview" );
    if(preview) preview.value = messageText();
    const company = $( "puCompany" );
    if(company) localStorage.setItem("sd_purchase_company", company.value);
  }

  function syncSupplier(){
    const master = supplierByInput();
    const number = $( "puNumber" );
    if(!number) return;

    number.innerHTML = numberOptions(master);

    const manual = $( "puManualNumber" );
    if(master && manual && !manual.value) manual.value = firstNum(master.mobile);
    if(master && nums(master.mobile).length===1) number.value = firstNum(master.mobile);

    updatePreview();
  }

  function clearEntry(){
    ["puSupplier","puManualNumber","puGR","puTruck","puBags","puWeight","puRate","puOil","puFFA","puRemarks"].forEach(id=>{
      if($(id)) $(id).value="";
    });
    if($( "puNumber" )) $( "puNumber" ).innerHTML='<option value="">Select saved number</option>';
    if($( "puCompany" )) $( "puCompany" ).value=localStorage.getItem("sd_purchase_company") || "";
    if($( "puDate" )) $( "puDate" ).value=today();
    updatePreview();
  }

  function table(headers, rows){
    return '<div class="tablewrap"><table><thead><tr>' +
      headers.map(h=>'<th>'+h+'</th>').join("") +
      '</tr></thead><tbody>' +
      (rows.length ? rows.join("") : '<tr><td class="empty" colspan="'+headers.length+'">No records</td></tr>') +
      '</tbody></table></div>';
  }

  async function load(){
    try{
      const [a,b] = await Promise.all([
        supabaseClient.from(SUP).select("*").order("name"),
        supabaseClient.from(MSG).select("*").order("created_at",{ascending:false}).limit(100)
      ]);
      S.err = a.error?.message || b.error?.message || "";
      if(!S.err){
        S.suppliers = a.data || [];
        S.messages = b.data || [];
        S.loaded = true;
      }
    }catch(e){
      S.err = e?.message || String(e);
    }
    draw();
  }

  function supplierModal(id){
    const existing = S.suppliers.find(x=>x.id===id) || {};
    openModal(
      id ? "Edit purchase supplier" : "Add purchase supplier",
      fld("psName","Supplier name *",existing.name) +
      '<div class="field"><label>WhatsApp numbers</label>' +
        '<textarea id="psMobile" rows="3" placeholder="9876543210\n9123456789">'+
          esc(nums(existing.mobile).join("\n"))+
        '</textarea><div class="small muted">Enter multiple numbers on separate lines. First number is primary.</div></div>' +
      fld("psContact","Contact person",existing.contact) +
      fld("psGST","GSTIN",existing.gstin) +
      fld("psAddress","Address",existing.address) +
      '<div class="field"><label>Status</label><select id="psActive">' +
        '<option value="1" '+(existing.active===false?"":"selected")+'>Active</option>' +
        '<option value="0" '+(existing.active===false?"selected":"")+'>Inactive</option>' +
      '</select></div>',
      async()=>{
        const name = ($( "psName" )?.value || "").trim();
        const mobile = nums($( "psMobile" )?.value || "").join(",");
        if(!name){ alert("Supplier name is required."); return false; }

        const row = {
          name, mobile,
          contact:($( "psContact" )?.value || "").trim(),
          gstin:( $( "psGST" )?.value || "" ).trim().toUpperCase(),
          address:( $( "psAddress" )?.value || "" ).trim(),
          active:$( "psActive" )?.value === "1"
        };

        const r = id
          ? await supabaseClient.from(SUP).update(row).eq("id",id)
          : await supabaseClient.from(SUP).insert(row);

        if(r.error){ alert(r.error.message); return false; }
        await load();
      }
    );
  }

  async function savePurchase(){
    const supplierName = ($( "puSupplier" )?.value || "").trim();
    const master = supplierByInput();
    const manualNumber = ($( "puManualNumber" )?.value || "").trim();
    const savedNumber = $( "puNumber" )?.value || "";
    const number = manualNumber || savedNumber || firstNum(master?.mobile);

    if(!supplierName){ alert("Enter a supplier name."); return; }
    if(!number){ alert("Enter or select a supplier WhatsApp number."); return; }

    const row = {
      supplier_id:master?.id || null,
      supplier_name:supplierName,
      mobile:number,
      date:$( "puDate" )?.value || today(),
      gr_no:($( "puGR" )?.value || "").trim(),
      truck_no:($( "puTruck" )?.value || "").trim(),
      bags:Number($( "puBags" )?.value || 0),
      weight:Number($( "puWeight" )?.value || 0),
      rate:Number($( "puRate" )?.value || 0),
      oil:Number($( "puOil" )?.value || 0),
      ffa:($( "puFFA" )?.value || "").trim(),
      remarks:($( "puRemarks" )?.value || "").trim(),
      message:messageText()
    };

    const r = await supabaseClient.from(MSG).insert(row).select().single();
    if(r.error){ alert(r.error.message); return; }

    S.messages.unshift(r.data);
    alert("Purchase message saved.");
  }

  function cleanPhone(value){
    let p=String(value||"").replace(/\D/g,"");
    if(p.length===10) p="91"+p;
    return p;
  }

  function openWhatsApp(){
    const supplierName = ($( "puSupplier" )?.value || "").trim();
    const master = supplierByInput();
    const number = ($( "puManualNumber" )?.value || "").trim() ||
      $( "puNumber" )?.value || firstNum(master?.mobile);

    if(!supplierName){ alert("Enter a supplier name."); return; }
    if(!number){ alert("Enter or select a WhatsApp number."); return; }

    const phone=cleanPhone(number);
    if(phone.length<12){ alert("Please enter a valid WhatsApp number."); return; }

    window.open(
      "https://wa.me/"+phone+"?text="+encodeURIComponent(messageText()),
      "_blank",
      "noopener"
    );
  }

  function viewMessage(id){
    const x=S.messages.find(m=>m.id===id);
    if(!x) return;

    openModal(
      "Purchase WhatsApp · "+esc(x.supplier_name),
      '<textarea readonly style="min-height:320px;resize:vertical">'+esc(x.message||"")+'</textarea>'+
      '<div class="small muted" style="margin-top:8px">Number: '+esc(x.mobile||"")+'</div>',
      ()=>true
    );
  }

  async function deleteRow(tableName,id,prompt){
    if(!confirm(prompt)) return;
    const r=await supabaseClient.from(tableName).delete().eq("id",id);
    if(r.error){ alert(r.error.message); return; }
    await load();
  }

  function draw(){
    const root=$( "purchase" );
    if(!root) return;

    if(S.err){
      root.innerHTML='<div class="panel"><div class="emptybox">Purchase module could not load.<br>'+esc(S.err)+'</div></div>';
      return;
    }

    const nav =
      '<div class="purchaseNav">' +
      '<button class="'+(S.view==="entry"?"primary":"secondary")+'" data-pview="entry">✚ New Message</button>' +
      '<button class="'+(S.view==="suppliers"?"primary":"secondary")+'" data-pview="suppliers">👥 Suppliers</button>' +
      '<button class="'+(S.view==="history"?"primary":"secondary")+'" data-pview="history">🕘 History</button>' +
      '</div>';

    let body=nav;

    if(S.view==="entry"){
      body += `
      <div class="purchaseHero">
        <div><div class="eyebrow">PURCHASE COMMUNICATION</div><h2>Send purchase details to supplier</h2><p>Enter the details once. The WhatsApp message updates live.</p></div>
        <div class="heroBadge">WhatsApp Ready</div>
      </div>

      <div class="purchaseLayout">
        <div class="panel purchaseForm">
          <div class="sectionHead"><div><h2>1. Purchase details</h2><span>Supplier, truck and quality information</span></div><span class="stepNo">01</span></div>

          <div class="formSection">
            <div class="sectionTitle">Supplier</div>
            <div class="grid two">
              <div class="field">
                <label>Supplier *</label>
                <input id="puSupplier" list="purchaseSupplierList" autocomplete="off" placeholder="Select or type supplier name">
                <datalist id="purchaseSupplierList">${supplierList()}</datalist>
                <div class="small muted">Choose a saved supplier or type/paste any supplier name.</div>
              </div>

              <div class="field">
                <label>Saved supplier number</label>
                <select id="puNumber"><option value="">Select saved number</option></select>
                <div class="small muted">If the supplier has multiple numbers, choose one here.</div>
              </div>

              <div class="field">
                <label>WhatsApp number for this message</label>
                <input id="puManualNumber" inputmode="tel" placeholder="9876543210">
                <div class="small muted">Leave blank to use the selected supplier number.</div>
              </div>

              <div class="field">
                <label>Company name</label>
                <input id="puCompany" value="${esc(localStorage.getItem("sd_purchase_company")||"")}" placeholder="Your company name">
              </div>
            </div>
          </div>

          <div class="formSection">
            <div class="sectionTitle">Truck / receipt</div>
            <div class="grid three">
              <div class="field"><label>Date *</label><input id="puDate" type="date" value="${today()}"></div>
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

          <div class="actions purchaseActions">
            <button class="primary" data-savepurchase>💾 Save message</button>
            <button class="secondary" data-clearpurchase>Clear form</button>
          </div>
        </div>

        <div class="panel purchasePreview">
          <div class="sectionHead"><div><h2>2. WhatsApp preview</h2><span>What the supplier will receive</span></div><span class="liveDot">● LIVE</span></div>
          <div class="waCard">
            <div class="waTop"><span>WhatsApp message</span><span>Preview</span></div>
            <textarea id="puPreview" readonly></textarea>
          </div>
          <div class="previewActions">
            <button class="primary" data-wa>📱 Open WhatsApp</button>
            <button class="secondary" data-copy>Copy</button>
          </div>
          <div class="tipBox"><b>How it works</b><br>Enter the supplier and purchase details. The preview changes automatically. Then copy the message or open WhatsApp.</div>
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
      body += '<div class="panel"><div class="sectionHead"><div><h2>Purchase suppliers</h2><span>Separate from Sales customers and parties</span></div><button class="primary" data-newsupplier>+ Add supplier</button></div>' +
        table(["Supplier","WhatsApp / Mobile","Contact","GSTIN","Status",""],
          S.suppliers.map(x=>'<tr><td><b>'+esc(x.name)+'</b></td><td>'+esc(x.mobile||"")+'</td><td>'+esc(x.contact||"")+'</td><td>'+esc(x.gstin||"")+'</td><td><span class="pill '+(x.active===false?"cancel":"")+'">'+(x.active===false?"Inactive":"Active")+'</span></td><td><button class="secondary btnsm" data-editsupplier="'+esc(x.id)+'">Edit</button> <button class="danger btnsm" data-delsupplier="'+esc(x.id)+'">Delete</button></td></tr>')
        ) + '</div>';
    }else{
      body += '<div class="panel"><div class="sectionHead"><div><h2>Purchase WhatsApp history</h2><span>Last 100 saved purchase messages</span></div></div>' +
        table(["Date","Supplier","GR No.","Truck","Weight (QTL)","Rate / QTL","Message",""],
          S.messages.map(x=>'<tr><td>'+esc(x.date)+'</td><td><b>'+esc(x.supplier_name||"")+'</b></td><td>'+esc(x.gr_no||"")+'</td><td>'+esc(x.truck_no||"")+'</td><td>'+esc(x.weight||"")+'</td><td>'+money(x.rate)+'</td><td><button class="secondary btnsm" data-viewmsg="'+esc(x.id)+'">View</button></td><td><button class="danger btnsm" data-delmsg="'+esc(x.id)+'">Delete</button></td></tr>')
        ) + '</div>';
    }

    root.innerHTML=body;

    if(S.view==="entry"){
      ["puSupplier","puNumber","puManualNumber","puCompany","puDate","puGR","puTruck","puBags","puWeight","puRate","puOil","puFFA","puRemarks"]
        .forEach(id=>$(id)?.addEventListener("input",updatePreview));

      $( "puSupplier" )?.addEventListener("input",syncSupplier);
      $( "puSupplier" )?.addEventListener("change",syncSupplier);
      $( "puNumber" )?.addEventListener("change",updatePreview);

      syncSupplier();
      updatePreview();
    }
  }

  const baseShow=window.showTab;
  window.showTab=function(tab){
    if(typeof baseShow==="function") baseShow(tab);
    const root=$( "purchase" );
    if(root) root.classList.toggle("hidden",tab!=="purchase");
    if(tab==="purchase"){
      if(!S.loaded) load();
      else draw();
    }
  };

  document.addEventListener("click",async e=>{
    const pv=e.target.closest("[data-pview]");
    if(pv){ S.view=pv.dataset.pview; draw(); return; }

    if(e.target.closest("[data-newsupplier]")){ supplierModal(); return; }

    const edit=e.target.closest("[data-editsupplier]");
    if(edit){ supplierModal(edit.dataset.editsupplier); return; }

    const delS=e.target.closest("[data-delsupplier]");
    if(delS){ await deleteRow(SUP,delS.dataset.delsupplier,"Delete this supplier?"); return; }

    const delM=e.target.closest("[data-delmsg]");
    if(delM){ await deleteRow(MSG,delM.dataset.delmsg,"Delete this purchase message?"); return; }

    const view=e.target.closest("[data-viewmsg]");
    if(view){ viewMessage(view.dataset.viewmsg); return; }

    if(e.target.closest("[data-savepurchase]")){ await savePurchase(); return; }
    if(e.target.closest("[data-clearpurchase]")){ clearEntry(); return; }
    if(e.target.closest("[data-wa]")){ openWhatsApp(); return; }

    if(e.target.closest("[data-copy]")){
      const text=$( "puPreview" )?.value || messageText();
      if(navigator.clipboard){
        navigator.clipboard.writeText(text).then(()=>alert("Message copied."),()=>alert("Copy failed. Select the preview and copy manually."));
      }else{
        alert("Select the preview text and copy it manually.");
      }
    }
  });

  load();
})();