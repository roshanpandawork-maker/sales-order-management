
const SUPABASE_URL='https://noldgjtoqhwefqdzdpzs.supabase.co';
const SUPABASE_KEY='sb_publishable_ZnaKalL6dJvrQjWE4k5zAw_h2A62Obq';
const pathParts=location.pathname.split('/').filter(Boolean);
const qs=new URLSearchParams(location.search);
const querySlug=qs.get('c')||'';
const pathSlug=pathParts[pathParts.length-1] && pathParts[pathParts.length-1]!=='p' ? decodeURIComponent(pathParts[pathParts.length-1]) : '';
const slug=querySlug||pathSlug;
const token=qs.get('token')||new URLSearchParams((location.hash||'').replace(/^#/,'')).get('token');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>Number(n||0).toLocaleString('en-IN',{maximumFractionDigits:3});
async function load(){
 const status=document.getElementById('status'),err=document.getElementById('error');
 if(!slug&&!token){status.textContent='Invalid link';err.style.display='block';err.textContent='This party link is missing its access code.';return}
 try{
  const rpc=slug?'get_party_live_balance_by_slug':'get_party_live_balance';
  const body=slug?{p_slug:slug}:{p_token:token};
  const res=await fetch(SUPABASE_URL+'/rest/v1/rpc/'+rpc,{method:'POST',headers:{apikey:SUPABASE_KEY,'Content-Type':'application/json'},body:JSON.stringify(body)});
  const data=await res.json(); if(!res.ok)throw new Error(data.message||'Unable to load balance');
  err.style.display='none';status.textContent='● Live';
  const party=data[0]?.party_name||'Party';
  document.getElementById('partyName').textContent=party;
  document.getElementById('productCount').textContent=data.length;
  document.getElementById('orderedTotal').textContent=data.reduce((a,x)=>a+Number(x.ordered||0),0).toLocaleString('en-IN',{maximumFractionDigits:3});
  document.getElementById('balanceTotal').textContent=data.reduce((a,x)=>a+Number(x.balance||0),0).toLocaleString('en-IN',{maximumFractionDigits:3});
  document.getElementById('updated').textContent='Last updated: '+new Date().toLocaleString('en-IN');
  document.getElementById('rows').innerHTML=data.length?data.map(x=>'<tr><td><b>'+esc(x.product_name||x.product_code)+'</b></td><td>'+esc(x.unit)+'</td><td class="rate">₹'+fmt(x.rate)+'</td><td>'+fmt(x.ordered)+'</td><td>'+fmt(x.dispatched)+'</td><td class="balance">'+fmt(x.balance)+'</td></tr>').join(''):'<tr><td colspan="6" class="empty">No open quantity is currently available.</td></tr>';
 }catch(e){status.textContent='Connection error';err.style.display='block';err.textContent=e.message||'Unable to load live balance.'}
}
function updateClock(){var e=document.getElementById("liveClock");if(e)e.textContent=new Date().toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:true})}updateClock();setInterval(updateClock,1000);load();setInterval(load,15000);

