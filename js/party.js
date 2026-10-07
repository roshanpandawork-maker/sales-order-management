// SalesDesk public customer live-balance page.
"use strict";

const SUPABASE_URL = window.SALESDESK_CONFIG?.SUPABASE_URL;
const SUPABASE_KEY = window.SALESDESK_CONFIG?.SUPABASE_PUBLISHABLE_KEY;
const qs = new URLSearchParams(location.search);
const token = qs.get("token") || new URLSearchParams((location.hash || "").replace(/^#/, "")).get("token");

const esc = window.esc;
  "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
}[c]));

const fmt = n => Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 3 });

async function load() {
  const status = document.getElementById("status");
  const err = document.getElementById("error");

  if (!token) {
    status.textContent = "Invalid link";
    err.style.display = "block";
    err.textContent = "This party link is missing its access token.";
    return;
  }

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    status.textContent = "Configuration error";
    err.style.display = "block";
    err.textContent = "Unable to connect to SalesDesk.";
    return;
  }

  try {
    const res = await fetch(SUPABASE_URL + "/rest/v1/rpc/get_party_live_balance", {
      method: "POST",
      headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ p_token: token })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Unable to load balance");

    err.style.display = "none";
    status.textContent = "● Live";
    const party = data[0]?.party_name || "Party";
    document.getElementById("partyName").textContent = party;
    document.getElementById("productCount").textContent = data.length;
    document.getElementById("orderedTotal").textContent =
      data.reduce((a, x) => a + Number(x.ordered || 0), 0).toLocaleString("en-IN", { maximumFractionDigits: 3 });
    document.getElementById("balanceTotal").textContent =
      data.reduce((a, x) => a + Number(x.balance || 0), 0).toLocaleString("en-IN", { maximumFractionDigits: 3 });
    document.getElementById("updated").textContent = "Last updated: " + new Date().toLocaleString("en-IN");
    document.getElementById("rows").innerHTML = data.length
      ? data.map(x =>
          "<tr><td><b>" + esc(x.product_name || x.product_code) + "</b></td>" +
          "<td>" + esc(x.unit) + "</td><td class=\"rate\">₹" + fmt(x.rate) + "</td>" +
          "<td>" + fmt(x.ordered) + "</td><td>" + fmt(x.dispatched) + "</td>" +
          "<td class=\"balance\">" + fmt(x.balance) + "</td></tr>"
        ).join("")
      : '<tr><td colspan="6" class="empty">No open quantity is currently available.</td></tr>';
  } catch (e) {
    status.textContent = "Connection error";
    err.style.display = "block";
    err.textContent = e.message || "Unable to load live balance.";
  }
}

load();
setInterval(load, 15000);
