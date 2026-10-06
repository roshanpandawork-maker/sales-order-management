/* Management layer: role-aware workspace, audit and notifications. */
(function(){
"use strict";
const $=id=>document.getElementById(id), sb=()=>window.supabaseClient;
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function ensure(){
 if(!$("auditCenter")){const s=document.createElement("section");s.id="auditCenter";s.className="hidden";$("purchase").after(s)}
 const ng=document.querySelector('.nav-group[data-group="finance"] .nav-items');
 if(ng&&!document.querySelector('[data-tab="auditCenter"]')){const b=document.createElement("button");b.className="tab";b.dataset.tab="auditCenter";b.innerHTML='<span class="navIcon">◌</span><span>Audit Center</span>';ng.appendChild(b)}
}
async function drawAudit(){
 const s=$("auditCenter");if(!s)return;
 const r=await sb().from("audit_log").select("*").order("at",{ascending:false}).limit(200);
 const rows=(r.data||[]).map(x=>'<tr><td>'+esc(x.at)+'</td><td>'+esc(x.table_name)+'</td><td><span class="pill">'+esc(x.action)+'</span></td><td>'+esc(x.user_id||"")+'</td><td><code>'+esc(JSON.stringify(x.row_data||{}).slice(0,180))+'</code></td></tr>');
 s.innerHTML='<div class="panel"><div class="sd-section-title"><div><h2>Audit Center</h2><p>Immutable business-change history for review and troubleshooting.</p></div><span class="tag">Last 200 events</span></div><div class="filters"><input id="auditSearch" placeholder="Filter table / action / user"></div><div class="tablewrap"><table><thead><tr><th>Time</th><th>Table</th><th>Action</th><th>User</th><th>Changed data</th></tr></thead><tbody id="auditRows">'+(rows.join("")||'<tr><td colspan="5" class="empty">No audit events.</td></tr>')+'</tbody></table></div></div>';
}
async function drawRole(){
 try{
  const r=await sb().rpc("get_dashboard_role"); if(r.error||!r.data)return;
  const tag=$(".sd-section-title .tag"); if(tag)tag.textContent="Role: "+(r.data.role||"viewer");
 }catch(e){}
}
document.addEventListener("DOMContentLoaded",()=>setTimeout(()=>{ensure();drawRole()},1000));
const old=window.showTab;window.showTab=function(t){old(t);if(t==="auditCenter")drawAudit()};
})();