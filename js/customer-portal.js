"use strict";

const cfg = window.SALESDESK_CONFIG || {};
const base = String(cfg.SUPABASE_URL || "").replace(/\/$/, "");
const key = cfg.SUPABASE_PUBLISHABLE_KEY || "";
const slug = new URLSearchParams(location.search).get("c") || "";
const esc = window.esc;
const fmt = n => Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 3 });
const money = n => "₹" + Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const form = document.getElementById("quoteForm");
const productSelect = document.getElementById("product");
const quoteButton = document.getElementById("quoteSubmit");
let portal = null;
let loading = false;

async function rpc(name, args) {
  if (!base || !key) throw new Error("Customer portal is not configured. Please contact SalesDesk.");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`${base}/rest/v1/rpc/${encodeURIComponent(name)}`, {
      method: "POST",
      headers: { apikey: key, "Content-Type": "application/json" },
      body: JSON.stringify(args),
      signal: controller.signal
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error("The service could not complete your request. Please try again.");
    if (!data || typeof data !== "object") throw new Error("The service returned an unexpected response. Please try again.");
    return data;
  } catch (error) {
    if (error.name === "AbortError") throw new Error("The request timed out. Check your connection and try again.");
    if (error instanceof TypeError) throw new Error("Unable to connect. Check your internet connection and try again.");
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function tabSetup() {
  document.querySelectorAll(".tabs button").forEach(button => {
    button.onclick = () => {
      document.querySelectorAll(".tabs button").forEach(tab => {
        tab.classList.remove("active");
        tab.setAttribute("aria-selected", "false");
      });
      document.querySelectorAll(".panels > .panel").forEach(panel => panel.classList.remove("active"));
      button.classList.add("active");
      button.setAttribute("aria-selected", "true");
      document.getElementById(button.dataset.p)?.classList.add("active");
    };
  });
}

function render() {
  const data = portal;
  document.getElementById("party").textContent = data.party_name || "Customer";
  const orders = Array.isArray(data.orders) ? data.orders : [];
  const prices = Array.isArray(data.prices) ? data.prices : [];
  const quotes = Array.isArray(data.quotations) ? data.quotations : [];
  const balances = Array.isArray(data.balances) ? data.balances : [];
  const ordered = orders.reduce((sum, order) => sum + (Array.isArray(order.items)
    ? order.items.reduce((subtotal, item) => subtotal + Number(item.qty || 0), 0) : 0), 0);
  const balance = balances.reduce((sum, row) => sum + Number(row.balance || 0), 0);

  document.getElementById("orders").textContent = orders.filter(order => String(order.status || "").toLowerCase() !== "closed").length;
  document.getElementById("ordered").textContent = fmt(ordered);
  document.getElementById("balance").textContent = fmt(balance);
  document.getElementById("quotes").textContent = quotes.length;
  const now = new Date();
  const updated = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  document.getElementById("updated").textContent = updated;
  document.getElementById("updated").dateTime = now.toISOString();
  document.getElementById("priceUpdated").textContent = `Updated ${updated}`;

  document.getElementById("priceRows").innerHTML = prices.length
    ? prices.map(item => `<tr><td><b>${esc(item.product_name)}</b></td><td>${esc(item.unit)}</td><td class="price">${money(item.rate)}</td><td>${fmt(item.gst_rate)}%</td></tr>`).join("")
    : '<tr><td colspan="4" class="empty">No prices have been published for your account today.</td></tr>';
  document.getElementById("orderRows").innerHTML = orders.length
    ? orders.map(order => `<tr><td><b>${esc(order.so)}</b></td><td>${esc(order.date)}</td><td>${esc(order.due || "-")}</td><td>${esc(order.status || "Ongoing")}</td><td>${fmt((order.items || []).length)} item(s)</td></tr>`).join("")
    : '<tr><td colspan="5" class="empty">No orders found.</td></tr>';
  const balanceRows = document.getElementById("balanceRows");
  if (balanceRows) balanceRows.innerHTML = balances.length
    ? balances.map(row => `<tr><td><b>${esc(row.product_name || row.product_code || "-")}</b><div class="muted">${esc(row.product_code || "")}</div></td><td>${esc(row.unit || "")}</td><td>${fmt(row.ordered)}</td><td>${fmt(row.dispatched)}</td><td><b>${fmt(row.balance)}</b></td></tr>`).join("")
    : '<tr><td colspan="5" class="empty">No open Sales Order balance.</td></tr>';
  document.getElementById("quoteRows").innerHTML = quotes.length
    ? quotes.map(quote => {
      const lines = Array.isArray(quote.lines) ? quote.lines : [];
      return `<article class="quote-card"><div class="quote-title"><b>${esc(quote.quotation_no)}</b><span class="status">${esc(quote.status || "Shared")}</span></div><p class="muted">Created ${esc(quote.date)} · Valid until ${esc(quote.valid_until || "-")}</p><div class="table"><table><thead><tr><th>Product</th><th>Qty</th><th>Rate</th><th>GST</th></tr></thead><tbody>${lines.map(line => `<tr><td>${esc(line.product_code)}</td><td>${fmt(line.quantity)} ${esc(line.unit)}</td><td>${money(line.rate)}</td><td>${fmt(line.gst_rate)}%</td></tr>`).join("")}</tbody></table></div></article>`;
    }).join("")
    : '<div class="empty">No quotations have been shared yet.</div>';

  productSelect.innerHTML = '<option value="">Select a product</option>' + prices.map(item =>
    `<option value="${esc(item.product_code)}">${esc(item.product_name)} · ${money(item.rate)} / ${esc(item.unit)}</option>`).join("");
  productSelect.disabled = prices.length === 0;
  quoteButton.disabled = prices.length === 0;
  quoteButton.title = prices.length ? "" : "No products are currently available for quotation requests.";
}

async function load() {
  if (loading) return;
  loading = true;
  const retry = document.getElementById("retry");
  retry.disabled = true;
  try {
    if (!slug) throw new Error("This customer link is missing its access code. Please ask SalesDesk for a new link.");
    const data = await rpc("get_party_portal_by_slug", { p_slug: slug });
    if (data.ok !== true) throw new Error("This customer link is invalid or has expired. Please ask SalesDesk for a new link.");
    portal = data;
    render();
    document.getElementById("error").hidden = true;
  } catch (error) {
    portal = null;
    productSelect.disabled = true;
    quoteButton.disabled = true;
    document.getElementById("error").hidden = false;
    document.getElementById("errorText").textContent = error.message || "We couldn't load your account. Please try again.";
  } finally {
    loading = false;
    retry.disabled = false;
  }
}

document.getElementById("retry").onclick = load;
form.onsubmit = async event => {
  event.preventDefault();
  if (!portal || !slug || !form.reportValidity()) return;
  const feedback = document.getElementById("sent");
  quoteButton.disabled = true;
  quoteButton.textContent = "Sending…";
  feedback.classList.remove("error-text");
  feedback.textContent = "";
  try {
    const result = await rpc("create_customer_quote_request_by_slug", {
      p_slug: slug,
      p_product_code: productSelect.value,
      p_quantity: Number(document.getElementById("qty").value),
      p_message: document.getElementById("remarks").value.trim() || null
    });
    if (result.ok !== true) throw new Error("Your request could not be sent. Please try again or contact SalesDesk.");
    feedback.textContent = "Request sent. Our team will prepare your quotation.";
    form.reset();
    await load();
  } catch (error) {
    feedback.classList.add("error-text");
    feedback.textContent = error.message || "Your request could not be sent. Please try again.";
  } finally {
    quoteButton.textContent = "Send quotation request";
    quoteButton.disabled = !portal || !portal.prices?.length;
  }
};

tabSetup();
load();
setInterval(load, 30000);
