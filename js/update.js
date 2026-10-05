(function(){
"use strict";
const CURRENT_VERSION="1.0.0";
const VERSION_URL="https://raw.githubusercontent.com/roshanpandawork-maker/sales-order-management/main/version.json";
const ACTIONS_URL="https://github.com/roshanpandawork-maker/sales-order-management/actions/workflows/android.yml";

function nativeVersion(){
  try{return window.AndroidVoice&&window.AndroidVoice.getAppVersion?window.AndroidVoice.getAppVersion():"";}
  catch(_){return "";}
}
function compare(a,b){
  const A=String(a||"0").split(".").map(Number),B=String(b||"0").split(".").map(Number);
  for(let i=0;i<Math.max(A.length,B.length);i++){const x=A[i]||0,y=B[i]||0;if(x!==y)return x-y}
  return 0;
}
async function checkUpdate(){
  const btn=document.getElementById("appUpdateBtn");
  if(btn)btn.disabled=true;
  try{
    const r=await fetch(VERSION_URL+"?t="+Date.now(),{cache:"no-store"});
    if(!r.ok)throw new Error("Update server unavailable");
    const info=await r.json();
    const installed=nativeVersion()||CURRENT_VERSION;
    if(compare(info.version,installed)>0){
      const ok=confirm("SalesDesk update "+info.version+" is available. Open the update page?");
      if(ok)window.open(info.url||ACTIONS_URL,"_blank","noopener");
    }else{
      alert("SalesDesk is up to date. Version "+installed+".");
    }
  }catch(e){
    alert("Could not check for updates. You can open the Android update page manually.");
  }finally{
    if(btn)btn.disabled=false;
  }
}
window.salesDeskCheckUpdate=checkUpdate;
function bind(){
  document.addEventListener("click",e=>{
    const b=e.target.closest?.("#appUpdateBtn,[data-app-update]");
    if(!b)return;
    e.preventDefault();checkUpdate();
  });
  const toolbar=document.querySelector(".toolbar");
  if(toolbar&&!document.getElementById("appUpdateBtn")){
    const b=document.createElement("button");
    b.id="appUpdateBtn";b.type="button";b.className="secondary";b.textContent="↻ Update";
    toolbar.appendChild(b);
  }
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",bind,{once:true});else bind();
})();