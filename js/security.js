// Security helpers: CSP-safe click delegation + idle auto-logout.
(function(){
  "use strict";
  // Only these functions can be triggered from data-act attributes (no inline JS needed).
  const ALLOWED=new Set(["addOrderLine", "backup", "clearSaleLines", "closeModal", "deleteParty", "deleteProduct", "editOrder", "editParty", "editProduct", "editSale", "exportCSV", "logout", "partyLiveLink", "partyLiveWhatsApp","openBilling", "removeLine", "removeSale", "renderBalances", "resetOrder", "setPartyCode", "setProductCode", "toggleCancel"]);
  document.addEventListener('click',function(ev){
    const el=ev.target.closest('[data-act]');
    if(!el)return;
    const name=el.dataset.act;
    if(!ALLOWED.has(name)||typeof window[name]!=='function')return;
    ev.preventDefault();
    name==='removeLine'?window[name](el):window[name](el.dataset.arg);
  });
  // Log out after 30 minutes without interaction.
  const IDLE_MS=30*60*1000;
  let last=Date.now(),timer=null;
  ['click','keydown','touchstart','mousemove'].forEach(e=>document.addEventListener(e,()=>{last=Date.now()},{passive:true}));
  window.SD_SECURITY={armIdleLogout(fn){clearInterval(timer);last=Date.now();timer=setInterval(()=>{if(Date.now()-last>IDLE_MS){clearInterval(timer);fn()}},30000)}};
})();
