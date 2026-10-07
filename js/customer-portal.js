"use strict";
const cfg=window.SALESDESK_CONFIG||{};
const base=cfg.SUPABASE_URL;
const key=cfg.SUPABASE_PUBLISHABLE_KEY;
const slug=new URLSearchParams(location.search).get("c")||"";
const esc=window.esc;
const fmt=n=>Number(n||0).toLocaleString("en-IN",{maximumFractionDigits:3});
const money=n=>"₹"+Number(n||0).toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2});
let portal=null;
async function rpc(name,args){
 const r=await fetch(base+"/rest/v1/rpc/"+name,{method:"POST",headers:{apikey:key,"Content-Type":"application/json"},body:JSON.stringify(args)});
 const d=await r.json(); if(!r.ok)throw new Error(d.message||d.error||"Unable to connect"); return d;
}
function tabSetup(){document.querySelectorAll(".tabs button").forEach(b=>b.onclick=()=>{document.querySelectorAll(".tabs button").forEach(x=>x.classList.remove("active"));document.querySelectorAll(".panel").forEach(x=>x.classList.remove("active"));b.classList.add("active");document.getElementById(b.dataset.p).classList.add("active")})}
function render(){
 const p=portal;document.getElementById("party").textContent=p.party_name||"Customer";
 const orders=p.orders||[],prices=p.prices||[],quotes=p.quotations||[];
 let ordered=0; orders.forEach(o=>(o.items||[]).forEach(l=>{ordered+=Number(l.qty||0)})); const balances=p.balances||[]; const balance=balances.reduce((a,x)=>a+Number(x.balance||0),0);
 document.getElementById("orders").textContent=orders.filter(o=>String(o.status||"").toLowerCase()!=="closed").length;
 document.getElementById("ordered").textContent=fmt(ordered);
 document.getElementById("balance").textContent=fmt(balance);
 document.getElementById("quotes").textContent=quotes.length;
 document.getElementById("updated").textContent="Prices and order data updated "+new Date().toLocaleString("en-IN");
 document.getElementById("priceRows").innerHTML=prices.length?prices.map(x=>"<tr><td><b>"+esc(x.product_name)+"</b></td><td>"+esc(x.unit)+"</td><td><b>"+money(x.rate)+"</b></td><td>"+fmt(x.gst_rate)+"%</td></tr>").join(""):'<tr><td colspan="4" class="empty">No prices published today.</td></tr>';
 document.getElementById("orderRows").innerHTML=orders.length?orders.map(o=>"<tr><td><b>"+esc(o.so)+"</b></td><td>"+esc(o.date)+"</td><td>"+esc(o.due||"-")+"</td><td>"+esc(o.status||"Ongoing")+"</td><td>"+esc((o.items||[]).length)+" item(s)</td></tr>").join(""):'<tr><td colspan="5" class="empty">No orders found.</td></tr>'; const balanceRows=document.getElementById("balanceRows");if(balanceRows)balanceRows.innerHTML=balances.length?balances.map(x=>"<tr><td><b>"+esc(x.product_name||x.product_code||"-")+"</b><div class=\"muted\">"+esc(x.product_code||"")+"</div></td><td>"+esc(x.unit||"")+"</td><td>"+fmt(x.ordered)+"</td><td>"+fmt(x.dispatched)+"</td><td><b>"+fmt(x.balance)+"</b></td></tr>").join(""):'<tr><td colspan="5" class="empty">No open Sales Order balance.</td></tr>';
 document.getElementById("quoteRows").innerHTML=quotes.length?quotes.map(q=>{const lines=q.lines||[];return '<div class="card" style="border:1px solid #e5e9f0;margin-bottom:10px"><b>'+esc(q.quotation_no)+'</b><span class="muted"> · '+esc(q.date)+' · Valid until '+esc(q.valid_until||"-")+'</span><div class="table" style="margin-top:10px"><table><thead><tr><th>Product</th><th>Qty</th><th>Rate</th><th>GST</th></tr></thead><tbody>'+lines.map(l=>'<tr><td>'+esc(l.product_code)+'</td><td>'+fmt(l.quantity)+' '+esc(l.unit)+'</td><td>'+money(l.rate)+'</td><td>'+fmt(l.gst_rate)+'%</td></tr>').join("")+'</tbody></table></div></div>'}).join(""):'<div class="empty">No quotations yet.</div>';
 const sel=document.getElementById("product");sel.innerHTML='<option value="">Select product</option>'+prices.map(x=>'<option value="'+esc(x.product_code)+'">'+esc(x.product_name)+' · '+money(x.rate)+' / '+esc(x.unit)+'</option>').join("");
}
async function load(){
 try{if(!slug)throw new Error("Customer link is missing.");portal=await rpc("get_party_portal_by_slug",{p_slug:slug});if(!portal.ok)throw new Error(portal.error||"Invalid customer link");document.getElementById("error").style.display="none";render()}
 catch(e){document.getElementById("error").style.display="block";document.getElementById("error").textContent=e.message}
}
document.getElementById("quoteForm").onsubmit=async e=>{e.preventDefault();const sent=document.getElementById("sent");try{const d=await rpc("create_customer_quote_request_by_slug",{p_slug:slug,p_product_code:document.getElementById("product").value,p_quantity:Number(document.getElementById("qty").value),p_message:document.getElementById("remarks").value||null});if(!d.ok)throw new Error(d.error);sent.textContent="Quotation request sent successfully. Our team will prepare the quotation.";e.target.reset()}catch(err){sent.textContent=err.message}};
tabSetup();load();setInterval(load,30000);