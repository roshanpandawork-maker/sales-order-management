(function(){
  "use strict";
  const $=id=>document.getElementById(id);
  const trigger=$("notificationTrigger"),account=$("accountTrigger"),bellPanel=$("notificationPopover"),accountPanel=$("accountPopover");
  if(!trigger||!account||!bellPanel||!accountPanel)return;
  let items=[],loadError=false;
  const setOpen=(button,panel,open)=>{panel.classList.toggle("hidden",!open);button.setAttribute("aria-expanded",String(open));};
  const closeAll=()=>{setOpen(trigger,bellPanel,false);setOpen(account,accountPanel,false)};
  const ago=value=>{
    if(!value)return "Recently";
    const mins=Math.max(0,Math.floor((Date.now()-new Date(value).getTime())/60000));
    if(mins<1)return "Just now";
    if(mins<60)return mins+"m ago";
    const hours=Math.floor(mins/60);if(hours<24)return hours+"h ago";
    const days=Math.floor(hours/24);return days<7?days+"d ago":new Date(value).toLocaleDateString(undefined,{month:"short",day:"numeric"});
  };
  function render(){
    const list=$("notificationList"),count=$("notificationCount"),unread=items.filter(n=>!n.read_at).length;
    count.textContent=unread>99?"99+":String(unread);count.classList.toggle("hidden",unread===0);
    count.setAttribute("aria-label",unread+" unread notifications");
    $("notificationSummary").textContent=unread?unread+" unread update"+(unread===1?"":"s"):"You’re all caught up";
    $("markAllNotifications").disabled=!unread;
    if(loadError){list.innerHTML='<div class="popover-empty"><strong>Could not load updates</strong><span>Check your connection and open the notification center to retry.</span></div>';return}
    if(!items.length){list.innerHTML='<div class="popover-empty"><span class="empty-bell">✓</span><strong>All clear</strong><span>New updates will appear here.</span></div>';return}
    list.replaceChildren();
    items.slice(0,7).forEach(n=>{
      const row=document.createElement("button");row.type="button";row.className="notification-row"+(n.read_at?" is-read":"");row.setAttribute("aria-label",(n.read_at?"Read: ":"Unread: ")+(n.title||"Notification"));
      const dot=document.createElement("span");dot.className="notification-dot";
      const body=document.createElement("span");body.className="notification-body";
      const title=document.createElement("strong");title.textContent=n.title||"Update";
      const message=document.createElement("span");message.textContent=n.message||"You have a new update.";
      const meta=document.createElement("small");meta.textContent=(n.type?String(n.type).replaceAll("_"," ")+" · ":"")+ago(n.created_at);
      body.append(title,message,meta);row.append(dot,body);row.addEventListener("click",async()=>{
        if(!n.read_at&&window.SD_STAGE3?.markRead)await window.SD_STAGE3.markRead(n.id);
        closeAll();window.showTab?.("notifications");
      });list.appendChild(row);
    });
  }
  trigger.addEventListener("click",()=>{const open=bellPanel.classList.contains("hidden");closeAll();setOpen(trigger,bellPanel,open)});
  account.addEventListener("click",()=>{const open=accountPanel.classList.contains("hidden");closeAll();setOpen(account,accountPanel,open)});
  $("markAllNotifications").addEventListener("click",()=>window.SD_STAGE3?.markAllNotificationsRead?.());
  $("openNotifications").addEventListener("click",()=>{closeAll();window.showTab?.("notifications")});
  document.addEventListener("click",e=>{if(!e.target.closest(".header-popover-wrap"))closeAll()});
  document.addEventListener("keydown",e=>{if(e.key==="Escape"){const active=document.activeElement;closeAll();if(active===trigger||active===account)active.focus()}});
  window.addEventListener("sd:notifications",e=>{items=Array.isArray(e.detail?.items)?e.detail.items:[];loadError=!!e.detail?.error;render()});
  window.addEventListener("sd:session",e=>{if(!e.detail?.signedIn){items=[];render()}});
  const client=window.supabaseClient;
  if(client?.auth){
    client.auth.getUser().then(({data})=>{
      const user=data?.user;if(!user)return;
      const email=user.email||"Workspace";$("accountEmail").textContent=email;
      const label=(user.user_metadata?.full_name||user.user_metadata?.name||email.split("@")[0]||"Workspace");
      $("accountName").textContent=label.length>17?label.slice(0,16)+"…":label;
      $("accountAvatar").textContent=label.split(/[\s._-]+/).filter(Boolean).slice(0,2).map(x=>x[0].toUpperCase()).join("")||"SD";
    }).catch(()=>{});
  }
  render();
  window.SD_NOTIFICATION_CENTER={refresh:()=>window.SD_STAGE3?.reload?.()};
})();
