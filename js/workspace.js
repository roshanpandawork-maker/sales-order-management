/* SalesDesk Workspace UX — global search, quick actions, keyboard navigation. */
(function(){
"use strict";
const $=id=>document.getElementById(id);
const esc=window.esc||((s)=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c])));
function go(tab){
  if(typeof window.showTab==="function") window.showTab(tab);
  const b=document.querySelector('.tab[data-tab="'+tab+'"]');
  if(b){b.classList.add('active');b.scrollIntoView({block:'nearest',behavior:'smooth'})}
}
function ensurePalette(){
  if($("sdCommand"))return;
  const d=document.createElement("div");
  d.id="sdCommand";d.className="sd-command hidden";d.innerHTML=
    '<div class="sd-command-box" role="dialog" aria-modal="true" aria-label="SalesDesk search">'+
    '<div class="sd-command-head"><input id="sdCommandInput" autocomplete="off" placeholder="Search parties, orders, products…"></div>'+
    '<div id="sdCommandList" class="sd-command-list"></div></div>';
  document.body.appendChild(d);
  d.addEventListener("click",e=>{if(e.target===d)closePalette()});
  $("sdCommandInput").addEventListener("input",renderResults);
  $("sdCommandInput").addEventListener("keydown",e=>{
    const rows=[...document.querySelectorAll(".sd-command-item")],i=rows.findIndex(x=>x.classList.contains("active"));
    if(e.key==="ArrowDown"){e.preventDefault();rows[(i+1+rows.length)%rows.length]?.classList.add("active");if(rows[i])rows[i].classList.remove("active")}
    if(e.key==="ArrowUp"){e.preventDefault();rows[(i-1+rows.length)%rows.length]?.classList.add("active");if(rows[i])rows[i].classList.remove("active")}
    if(e.key==="Enter"){e.preventDefault();rows.find(x=>x.classList.contains("active"))?.click()}
    if(e.key==="Escape")closePalette();
  });
}
function openPalette(seed=""){
  ensurePalette();$("sdCommand").classList.remove("hidden");$("sdCommandInput").value=seed;renderResults();setTimeout(()=>$("sdCommandInput").focus(),20)
}
function closePalette(){$("sdCommand")?.classList.add("hidden")}
function item(label,type,detail,tab){
  return '<button class="sd-command-item" type="button" data-tab="'+esc(tab)+'"><span><b>'+esc(label)+'</b><br><small>'+esc(type)+(detail?' · '+detail:'')+'</small></span><small>Open ›</small></button>'
}
function renderResults(){
  const q=($("sdCommandInput")?.value||"").trim().toLowerCase(),list=$("sdCommandList");if(!list)return;
  const actions=[
    ["New Sales Order","Quick action","Alt+N","orders"],
    ["New Dispatch","Quick action","Alt+D","sales"],
    ["Create Invoice","Quick action","Billing","invoices"],
    ["Record Payment","Quick action","Finance","payments"],
    ["Party Master","Workspace","Customers","parties"],
    ["Products & Prices","Workspace","Masters","products"],
    ["Party Balances","Workspace","Receivables","balances"],
    ["Overview","Workspace","Dashboard","dashboard"]
  ];
  let html=actions.filter(a=>!q||a.join(" ").toLowerCase().includes(q)).map(a=>item(a[0],a[1],a[2],a[3])).join("");
  const results=[];
  if(window.db){
    (db.parties||[]).forEach(p=>{if(!q||(p.name+" "+p.code+" "+(p.phone||"")).toLowerCase().includes(q))results.push(item(p.name,"Party",p.code,"parties"))});
    (db.orders||[]).forEach(o=>{if(!q||(o.no+" "+o.party).toLowerCase().includes(q))results.push(item(o.no,"Sales Order",o.party,"orders"))});
    (db.products||[]).forEach(p=>{if(!q||(p.name+" "+p.code).toLowerCase().includes(q))results.push(item(p.name,"Product",p.code,"products"))});
  }
  html+=results.slice(0,18).join("");
  list.innerHTML=html||'<div class="empty">No matching records.</div>';
  list.querySelector(".sd-command-item")?.classList.add("active");
  list.querySelectorAll(".sd-command-item").forEach(b=>b.addEventListener("click",()=>{go(b.dataset.tab);closePalette()}));
}
document.addEventListener("click",e=>{
  const q=e.target.closest("#globalSearch");if(q){e.preventDefault();openPalette(q.value)}
  const g=e.target.closest("[data-go]");if(g){go(g.dataset.go)}
});
document.addEventListener("keydown",e=>{
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="k"){e.preventDefault();openPalette();return}
  if(e.key==="Escape"){closePalette();return}
  if(e.altKey&&e.key.toLowerCase()==="n"){e.preventDefault();go("orders");return}
  if(e.altKey&&e.key.toLowerCase()==="d"){e.preventDefault();go("sales");return}
  if(e.altKey&&e.key.toLowerCase()==="p"){e.preventDefault();go("parties");return}
  if(e.altKey&&e.key.toLowerCase()==="i"){e.preventDefault();go("invoices");return}
});
document.addEventListener("DOMContentLoaded",()=>{
  ensurePalette();
  const gs=$("globalSearch");
  gs?.addEventListener("focus",()=>openPalette(gs.value));
  document.querySelectorAll(".tab kbd").forEach(k=>k.setAttribute("aria-hidden","true"));
});
})();