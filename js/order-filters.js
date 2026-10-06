(function(){
"use strict";
function initSOFilters(){
  const section=document.getElementById("orders");
  if(!section || document.getElementById("soAdvancedFilters")) return;
  const base=section.querySelector(".panel:nth-of-type(2) .filters");
  if(!base) return;
  const box=document.createElement("div");
  box.id="soAdvancedFilters";
  box.className="filters";
  box.style.cssText="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin-top:10px";
  box.innerHTML=
    '<select id="soFilterParty"><option value="">All parties</option></select>'+
    '<select id="soFilterProduct"><option value="">All products</option></select>'+
    '<input id="soFilterFrom" type="date" title="Order date from">'+
    '<input id="soFilterTo" type="date" title="Order date to">'+
    '<select id="soFilterBalance"><option value="">All balances</option><option value="pending">Pending only</option><option value="zero">Fully dispatched</option></select>'+
    '<button type="button" class="secondary" id="soClearFilters">Clear filters</button>';
  base.insertAdjacentElement("afterend",box);

  function fill(){
    const p=document.getElementById("soFilterParty"), pr=document.getElementById("soFilterProduct");
    if(!p||!pr||!window.db)return;
    const pv=p.value, prv=pr.value;
    p.innerHTML='<option value="">All parties</option>'+db.parties.map(x=>'<option value="'+String(x.code).replace(/"/g,'&quot;')+'">'+esc(x.name)+'</option>').join("");
    pr.innerHTML='<option value="">All products</option>'+db.products.map(x=>'<option value="'+String(x.code).replace(/"/g,'&quot;')+'">'+esc(x.name)+'</option>').join("");
    p.value=pv;pr.value=prv;
  }
  function apply(){
    const p=document.getElementById("soFilterParty")?.value||"";
    const pr=document.getElementById("soFilterProduct")?.value||"";
    const from=document.getElementById("soFilterFrom")?.value||"";
    const to=document.getElementById("soFilterTo")?.value||"";
    const bal=document.getElementById("soFilterBalance")?.value||"";
    const search=(document.getElementById("orderSearch")?.value||"").toLowerCase();
    const status=document.getElementById("orderStatus")?.value||"";
    const rows=[...document.querySelectorAll("#orderRows tr")];
    rows.forEach(row=>{
      const c=row.children;
      if(!c||c.length<10){return}
      const so=(c[0]?.textContent||"").toLowerCase();
      const date=(c[1]?.textContent||"").trim();
      const party=(c[2]?.textContent||"").trim().toLowerCase();
      const productMatch=pr?(function(){
        const o=db.orders.find(x=>x.no===(c[0]?.textContent||"").trim());
        return !!o?.lines?.some(l=>l.productCode===pr);
      })():true;
      const partyMatch=p?(function(){
        const o=db.orders.find(x=>x.no===(c[0]?.textContent||"").trim());
        return o?.partyCode===p;
      })():true;
      const balance=Number((c[6]?.textContent||"").replace(/,/g,""))||0;
      const visible=(!search||so.includes(search)||party.includes(search)||(c[3]?.textContent||"").toLowerCase().includes(search))
        &&(!status||((c[8]?.textContent||"").trim()===status))
        &&partyMatch&&productMatch&&(!from||date>=from)&&(!to||date<=to)
        &&(!bal||(bal==="pending"?balance>0:balance<=0));
      row.style.display=visible?"":"none";
    });
    const visible=[...document.querySelectorAll("#orderRows tr")].filter(r=>r.style.display!=="none");
    const empty=document.getElementById("soFilterEmpty");
    if(empty) empty.remove();
    if(rows.length && !visible.length && !rows.some(r=>r.querySelector(".empty"))){
      const tr=document.createElement("tr");tr.id="soFilterEmpty";tr.innerHTML='<td colspan="10" class="empty">No sales orders match the selected filters.</td>';
      document.getElementById("orderRows").appendChild(tr);
    }
  }
  fill();
  ["soFilterParty","soFilterProduct","soFilterFrom","soFilterTo","soFilterBalance"].forEach(id=>{
    document.getElementById(id)?.addEventListener("input",apply);
    document.getElementById(id)?.addEventListener("change",apply);
  });
  document.getElementById("soClearFilters")?.addEventListener("click",()=>{
    ["soFilterParty","soFilterProduct","soFilterFrom","soFilterTo","soFilterBalance"].forEach(id=>{const e=document.getElementById(id);if(e)e.value=""});
    document.getElementById("orderSearch").value="";
    document.getElementById("orderStatus").value="";
    render(); setTimeout(apply,0);
  });
  const oldRender=window.render;
  window.render=function(){oldRender();fill();setTimeout(apply,0)};
  apply();
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",initSOFilters);else initSOFilters();
})();