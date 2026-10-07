// SalesDesk AUTHENTICATION MODULE — isolated from application features.
// Do not modify this file when changing SalesDesk business features.
(function(){
  "use strict";
  const CFG=window.SALESDESK_CONFIG;
  const client=window.supabase.createClient(CFG.SUPABASE_URL,CFG.SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  window.supabaseClient=client;
  async function boot(){
    const {data,error}=await client.auth.getSession();
    if(error){console.error("SalesDesk session check:",error);return;}
    if(data?.session && window.SalesDeskStartApp) await window.SalesDeskStartApp();
  }
  async function login(e){
    e.preventDefault();
    const msg=document.getElementById("loginMsg"),email=document.getElementById("loginEmail").value.trim().toLowerCase(),password=document.getElementById("loginPass").value;
    msg.textContent="";
    if(!email||!password){msg.textContent="Enter your email and password.";return;}
    const {error}=await client.auth.signInWithPassword({email,password});
    if(error){console.error("SalesDesk login:",error);msg.textContent=error.message;return;}
    if(window.SalesDeskStartApp) await window.SalesDeskStartApp();
  }
  async function google(){
    const msg=document.getElementById("loginMsg");msg.textContent="Opening Google sign-in…";
    const {error}=await client.auth.signInWithOAuth({provider:"google",options:{redirectTo:location.origin+location.pathname}});
    if(error)msg.textContent=error.message;
  }
  async function logout(){await client.auth.signOut();location.reload();}
  document.getElementById("loginForm").addEventListener("submit",login);
  document.getElementById("googleBtn").addEventListener("click",google);
  window.logout=logout;
  boot();
})();