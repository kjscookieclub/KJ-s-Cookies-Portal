import { useState, useEffect, useCallback } from "react";

const SUPABASE_URL = "https://eijmcdurznanrmhkzogk.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVpam1jZHVyem5hbnJtaGt6b2drIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwNTE4MjQsImV4cCI6MjA4ODYyNzgyNH0.dK8nHFABWdQG8YjYwp3-QzbXNPjFcsDfpua3qPqHzWc";

const FLAVORS = [
  { id: "chocolate_chip",        name: "Chocolate Chip",                     gluten: false, vegan: false },
  { id: "salted_caramel",        name: "Salted Caramel Chocolate Chip",      gluten: false, vegan: false },
  { id: "high_five",             name: "High Five Chocolate",                gluten: false, vegan: false },
  { id: "kram_ruble",            name: "Kräm Rublé",                         gluten: false, vegan: false },
  { id: "triple_choc_raspberry", name: "Triple Chocolate Raspberry",         gluten: false, vegan: false },
  { id: "bad_guy",               name: "Bad Guy",                            gluten: false, vegan: true  },
  { id: "gf_pistachio",          name: "Glutenfri Chocolate Chip Pistachio", gluten: true,  vegan: false },
  { id: "lemon_white",           name: "Lemon White Chocolate",              gluten: false, vegan: false },
  { id: "kardemumma",            name: "Karamelliserad Kardemumma",          gluten: false, vegan: false },
];

const LOW_STOCK_THRESHOLD = 24;

const STATUS_CONFIG = {
  ny:        { label: "Ny",        color: "#e8b86d", bg: "#fdf6e7" },
  bekraftad: { label: "Bekräftad", color: "#6d9ee8", bg: "#e7f0fd" },
  bakas:     { label: "Bakas",     color: "#e8806d", bg: "#fdeee7" },
  klar:      { label: "Klar",      color: "#6dc87e", bg: "#e7fded" },
  levererad: { label: "Levererad", color: "#a0a0a0", bg: "#f0f0f0" },
};

async function dbFetch(path, opts = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...opts,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) throw new Error(await res.text());
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

const fmtDate = str => { if (!str) return "—"; const [y,m,d] = str.split("-"); return d&&m&&y ? `${d}/${m}/${y}` : str; };
const getStatus  = o => o.data?.status       || o.status       || "ny";
const getType    = o => o.data?.orderType    || o.orderType    || "order";
const getCompany = o => o.data?.company      || o.company      || "—";
const getContact = o => o.data?.contact      || o.contact      || "—";
const getDate    = o => o.data?.deliveryDate || o.deliveryDate || "";
const getSource  = o => o.data?.source       || "internal";

// ── Generate default confirmation email HTML ──────────────────────────────────
function generateConfirmationHtml(order) {
  const d = order.data || order;
  const flavors = d.flavorBreakdown
    ? Object.entries(d.flavorBreakdown).filter(([,q]) => parseInt(q) > 0)
    : [];

  const flavorRows = flavors.map(([name, qty]) => `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #f0e8d8;font-size:14px;color:#3d2b1a;">${name}</td>
      <td style="padding:8px 0;border-bottom:1px solid #f0e8d8;text-align:right;font-size:14px;color:#9b7048;font-weight:bold;">${qty} st</td>
    </tr>`).join("");

  return `<!DOCTYPE html>
<html lang="sv">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#fdf8f0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#fdf8f0;padding:48px 24px;">
  <tr><td align="center">
  <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
    <tr>
      <td style="background:#3d2b1a;border-radius:16px 16px 0 0;padding:36px 40px;text-align:center;">
        <p style="margin:0 0 4px;font-family:Georgia,serif;font-size:28px;font-weight:700;color:#fff;letter-spacing:1px;">KJ's Cookies</p>
        <p style="margin:0;font-size:11px;color:#c9a87a;letter-spacing:3px;text-transform:uppercase;">Orderbekräftelse</p>
      </td>
    </tr>
    <tr>
      <td style="background:#fff;padding:40px;border-left:1px solid #f0e8d8;border-right:1px solid #f0e8d8;">
        <p style="margin:0 0 8px;font-family:Georgia,serif;font-size:22px;font-weight:700;color:#3d2b1a;">Hej ${d.contact || ""}!</p>
        <p style="margin:0 0 32px;font-size:15px;color:#9b7048;line-height:1.6;">Vi bekräftar härmed din beställning från <strong style="color:#3d2b1a;">${d.company || ""}</strong>. Din order är nu bekräftad och under förberedelse.</p>
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#fdf8f0;border-radius:10px;padding:20px;margin-bottom:32px;">
          <tr>
            <td style="font-size:11px;color:#9b7048;text-transform:uppercase;letter-spacing:1px;padding-bottom:4px;">Leveransdatum</td>
            <td style="font-size:11px;color:#9b7048;text-transform:uppercase;letter-spacing:1px;padding-bottom:4px;text-align:right;">Order #${order.id}</td>
          </tr>
          <tr>
            <td style="font-family:Georgia,serif;font-size:20px;font-weight:700;color:#3d2b1a;">${fmtDate(d.deliveryDate)}</td>
            <td style="font-family:Georgia,serif;font-size:20px;font-weight:700;color:#3d2b1a;text-align:right;">${d.productName || ""}</td>
          </tr>
          ${d.price ? `<tr>
            <td colspan="2" style="padding-top:16px;border-top:1px solid #f0e8d8;">
              <span style="font-size:11px;color:#9b7048;text-transform:uppercase;letter-spacing:1px;">Totalt (exkl. moms)</span>
              <span style="font-family:Georgia,serif;font-size:22px;font-weight:700;color:#c97c3a;margin-left:16px;">${Number(d.price).toLocaleString("sv-SE")} kr</span>
            </td>
          </tr>` : ""}
        </table>
        ${flavors.length > 0 ? `
        <p style="margin:0 0 10px;font-size:11px;color:#9b7048;text-transform:uppercase;letter-spacing:1px;font-weight:700;">Smaker</p>
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">${flavorRows}</table>` : ""}
        ${d.notes ? `
        <div style="background:#fdf6ec;border-left:3px solid #c97c3a;border-radius:0 8px 8px 0;padding:14px 18px;margin-bottom:28px;">
          <p style="margin:0 0 4px;font-size:11px;color:#9b7048;text-transform:uppercase;letter-spacing:1px;">Anteckningar</p>
          <p style="margin:0;font-size:14px;color:#3d2b1a;">${d.notes}</p>
        </div>` : ""}
        <p style="margin:0;font-size:14px;color:#9b7048;line-height:1.6;">Frågor? Hör gärna av dig till oss på <a href="mailto:hello@kjscookies.se" style="color:#c97c3a;font-weight:600;text-decoration:none;">hello@kjscookies.se</a></p>
      </td>
    </tr>
    <tr>
      <td style="background:#f5ede0;border-radius:0 0 16px 16px;border:1px solid #f0e8d8;padding:24px 40px;text-align:center;">
        <p style="margin:0 0 4px;font-size:12px;color:#9b7048;">KJ's Cookies · Ninni Kronbergs Gata 8 · Hagastaden, Stockholm</p>
        <p style="margin:0;font-size:11px;color:#c9a87a;letter-spacing:1px;">@kjscookieclub</p>
      </td>
    </tr>
  </table>
  </td></tr>
</table>
</body>
</html>`;
}

// ── Confirmation email modal ───────────────────────────────────────────────────
function ConfirmEmailModal({ order, onClose, onSent }) {
  const d = order.data || order;
  const [subject, setSubject] = useState(`Orderbekräftelse – KJ's Cookies (#${order.id})`);
  const [htmlBody, setHtmlBody] = useState(generateConfirmationHtml(order));
  const [sending, setSending] = useState(false);
  const [preview, setPreview] = useState(false);
  const [error, setError] = useState(null);

  async function handleSend() {
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: d.email, subject, html: htmlBody }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      onSent();
      onClose();
    } catch(e) {
      setError(e.message);
    }
    setSending(false);
  }

  const inp = { fontFamily:"'Lato',sans-serif", fontSize:14, padding:"10px 14px", border:"2px solid #eadfc8", borderRadius:10, width:"100%", boxSizing:"border-box", color:"#3d2b1a", background:"white", outline:"none" };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(61,43,26,0.55)", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
      <div style={{ background:"white", borderRadius:20, width:"100%", maxWidth:680, maxHeight:"92vh", overflowY:"auto", boxShadow:"0 24px 80px rgba(61,43,26,0.3)" }}>
        {/* Header */}
        <div style={{ background:"#3d2b1a", borderRadius:"20px 20px 0 0", padding:"24px 28px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div>
            <div style={{ fontFamily:"'Playfair Display',serif", fontSize:18, fontWeight:700, color:"white" }}>Skicka bekräftelse</div>
            <div style={{ fontSize:12, color:"#c9a87a", marginTop:2 }}>Till: {d.email || "—"} · {d.contact}</div>
          </div>
          <button onClick={onClose} style={{ background:"none", border:"none", color:"#c9a87a", fontSize:24, cursor:"pointer" }}>×</button>
        </div>

        <div style={{ padding:28 }}>
          {/* Subject */}
          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:11, color:"#9b7048", textTransform:"uppercase", letterSpacing:1, marginBottom:6, fontFamily:"'Lato',sans-serif" }}>Ämnesrad</div>
            <input value={subject} onChange={e => setSubject(e.target.value)} style={inp} />
          </div>

          {/* Toggle preview/edit */}
          <div style={{ display:"flex", gap:8, marginBottom:16 }}>
            <button onClick={() => setPreview(false)}
              style={{ padding:"7px 16px", borderRadius:20, border:`2px solid ${!preview?"#3d2b1a":"#eadfc8"}`, background:!preview?"#3d2b1a":"white", color:!preview?"white":"#9b7048", fontFamily:"'Lato',sans-serif", fontWeight:700, fontSize:12, cursor:"pointer" }}>
              ✏️ Redigera HTML
            </button>
            <button onClick={() => setPreview(true)}
              style={{ padding:"7px 16px", borderRadius:20, border:`2px solid ${preview?"#3d2b1a":"#eadfc8"}`, background:preview?"#3d2b1a":"white", color:preview?"white":"#9b7048", fontFamily:"'Lato',sans-serif", fontWeight:700, fontSize:12, cursor:"pointer" }}>
              👁 Förhandsgranska
            </button>
          </div>

          {/* Edit or preview */}
          {!preview ? (
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:11, color:"#9b7048", textTransform:"uppercase", letterSpacing:1, marginBottom:6, fontFamily:"'Lato',sans-serif" }}>E-postinnehåll (HTML)</div>
              <textarea value={htmlBody} onChange={e => setHtmlBody(e.target.value)}
                rows={14} style={{ ...inp, resize:"vertical", fontFamily:"monospace", fontSize:12, lineHeight:1.5 }} />
            </div>
          ) : (
            <div style={{ marginBottom:20, border:"2px solid #eadfc8", borderRadius:12, overflow:"hidden" }}>
              <iframe srcDoc={htmlBody} style={{ width:"100%", height:480, border:"none" }} title="Email preview" />
            </div>
          )}

          {error && <div style={{ background:"#ffe7e7", color:"#c0392b", borderRadius:10, padding:"10px 16px", marginBottom:16, fontSize:13, fontFamily:"'Lato',sans-serif" }}>⚠️ {error}</div>}

          <div style={{ display:"flex", gap:10 }}>
            <button onClick={onClose} style={{ flex:1, padding:"12px 0", background:"white", border:"2px solid #eadfc8", borderRadius:10, color:"#9b7048", fontFamily:"'Lato',sans-serif", fontWeight:700, cursor:"pointer" }}>Avbryt</button>
            <button onClick={handleSend} disabled={sending||!d.email}
              style={{ flex:2, padding:"12px 0", background:"#3d2b1a", border:"none", borderRadius:10, color:"white", fontFamily:"'Lato',sans-serif", fontWeight:700, cursor:"pointer", opacity:sending?0.6:1 }}>
              {sending ? "Skickar..." : `📧 Skicka till ${d.email||"—"}`}
            </button>
          </div>
          {!d.email && <div style={{ fontSize:12, color:"#e8806d", marginTop:8, fontFamily:"'Lato',sans-serif" }}>⚠️ Den här ordern har ingen e-postadress registrerad.</div>}
        </div>
      </div>
    </div>
  );
}

// ── Print följesedel ──────────────────────────────────────────────────────────
function printFolljesedel(order) {
  const d = order.data || order;
  const flavors = d.flavorBreakdown
    ? Object.entries(d.flavorBreakdown).filter(([,q]) => parseInt(q) > 0)
    : [];

  const flavorRows = flavors.map(([name, qty]) => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #f0e8d8;font-size:14px;color:#3d2b1a;font-family:Georgia,serif;">${name}</td>
      <td style="padding:10px 0;border-bottom:1px solid #f0e8d8;text-align:right;font-size:14px;color:#9b7048;font-weight:bold;">${qty} st</td>
    </tr>`).join("");

  const html = `<!DOCTYPE html>
<html lang="sv">
<head>
  <meta charset="UTF-8">
  <title>Följesedel – ${d.company||""} – #${order.id}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;900&family=Lato:wght@400;700&display=swap');
    *{box-sizing:border-box;margin:0;padding:0;}
    body{background:#fdf8f0;font-family:'Lato',sans-serif;padding:48px;color:#3d2b1a;}
    @media print{body{padding:0;background:white;}.no-print{display:none!important;}@page{margin:20mm;}}
    .page{max-width:680px;margin:0 auto;}
    .header{background:#3d2b1a;border-radius:16px 16px 0 0;padding:36px 40px;display:flex;justify-content:space-between;align-items:flex-end;}
    .header h1{font-family:'Playfair Display',serif;font-size:28px;font-weight:900;color:white;letter-spacing:1px;}
    .header p{font-size:11px;color:#c9a87a;letter-spacing:3px;text-transform:uppercase;margin-top:4px;}
    .header .order-num{font-family:'Playfair Display',serif;font-size:22px;font-weight:700;color:white;}
    .header .order-date{font-size:12px;color:#c9a87a;margin-top:4px;}
    .body{background:white;padding:40px;border-left:1px solid #f0e8d8;border-right:1px solid #f0e8d8;}
    .label{font-size:11px;color:#9b7048;text-transform:uppercase;letter-spacing:1.5px;font-weight:700;margin-bottom:6px;}
    .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:32px;}
    .info-box{background:#fdf8f0;border-radius:10px;padding:14px 18px;}
    .info-box .val{font-size:16px;font-weight:700;color:#3d2b1a;margin-top:4px;}
    hr{border:none;border-top:2px solid #f0e8d8;margin:24px 0;}
    table{width:100%;border-collapse:collapse;}
    .total-row{display:flex;justify-content:space-between;align-items:center;background:#fdf8f0;border-radius:10px;padding:16px 20px;margin-top:24px;}
    .notes-box{background:#fdf6ec;border-left:3px solid #c97c3a;border-radius:0 8px 8px 0;padding:14px 18px;margin-top:24px;}
    .footer{background:#f5ede0;border-radius:0 0 16px 16px;border:1px solid #f0e8d8;padding:24px 40px;display:flex;justify-content:space-between;align-items:center;}
    .footer p{font-size:12px;color:#9b7048;}
    .print-btn{display:block;margin:24px auto 0;padding:14px 32px;background:#3d2b1a;color:white;border:none;border-radius:12px;font-family:'Lato',sans-serif;font-weight:700;font-size:15px;cursor:pointer;}
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div><h1>KJ's Cookies</h1><p>Följesedel</p></div>
      <div style="text-align:right"><div class="order-num">Order #${order.id}</div><div class="order-date">Utskriven: ${new Date().toLocaleDateString("sv-SE")}</div></div>
    </div>
    <div class="body">
      <div class="info-grid">
        <div class="info-box"><div class="label">Företag</div><div class="val">${d.company||"—"}</div></div>
        <div class="info-box"><div class="label">Kontakt</div><div class="val">${d.contact||"—"}</div></div>
        <div class="info-box"><div class="label">Leveransdatum</div><div class="val">${fmtDate(d.deliveryDate)}</div></div>
        <div class="info-box"><div class="label">Typ</div><div class="val">${d.orderType==="subscription"?"Abonnemang":"Engångsbeställning"}</div></div>
      </div>
      ${flavors.length>0?`<hr><div style="font-family:'Playfair Display',serif;font-size:18px;font-weight:700;color:#3d2b1a;margin-bottom:12px;">Innehåll</div><table><tbody>${flavorRows}</tbody></table>`:""}
      ${d.productName?`<hr><div class="label">Produkt</div><div style="font-size:16px;font-weight:700;color:#3d2b1a;margin-top:6px;">${d.productName}</div>`:""}
      ${d.price?`<div class="total-row"><div><div class="label">Totalt (exkl. moms)</div></div><div style="font-family:'Playfair Display',serif;font-size:26px;font-weight:900;color:#c97c3a;">${Number(d.price).toLocaleString("sv-SE")} kr</div></div>`:""}
      ${d.notes?`<div class="notes-box"><div class="label">Anteckningar</div><div style="font-size:14px;color:#3d2b1a;margin-top:6px;">${d.notes}</div></div>`:""}
    </div>
    <div class="footer">
      <div><p>KJ's Cookies · Ninni Kronbergs Gata 8 · Hagastaden, Stockholm</p><p style="margin-top:4px;">hello@kjscookies.se · @kjscookieclub</p></div>
      <div style="font-size:13px;color:#c97c3a;font-weight:700;">Värm i ugn 175° i 4–5 min 🍪</div>
    </div>
    <button class="print-btn no-print" onclick="window.print()">🖨️ Skriv ut</button>
  </div>
</body>
</html>`;

  const win = window.open("", "_blank");
  win.document.write(html);
  win.document.close();
}

function DbStatus({ connected }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:6, fontFamily:"'Lato',sans-serif", fontSize:12, color: connected?"#6dc87e":"#e8806d" }}>
      <div style={{ width:8, height:8, borderRadius:"50%", background: connected?"#6dc87e":"#e8806d", boxShadow: connected?"0 0 6px #6dc87e":"none" }} />
      {connected ? "Ansluten" : "Ej ansluten"}
    </div>
  );
}

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || { label:status, color:"#999", bg:"#f0f0f0" };
  return <span style={{ background:cfg.bg, color:cfg.color, border:`1px solid ${cfg.color}30`, borderRadius:20, padding:"3px 10px", fontSize:12, fontWeight:700, fontFamily:"'Lato',sans-serif", whiteSpace:"nowrap" }}>{cfg.label}</span>;
}

// ── Order detail ──────────────────────────────────────────────────────────────
function OrderDetail({ order, onClose, onUpdate, inventory, setInventory, notify }) {
  const d = order.data || order;
  const [status, setStatus] = useState(getStatus(order));
  const [saving, setSaving] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [pendingStatus, setPendingStatus] = useState(null);

  async function saveStatus(newStatus) {
    if (newStatus === status) return;

    // If moving to bekräftad, show email modal first
    if (newStatus === "bekraftad" && status !== "bekraftad") {
      setPendingStatus(newStatus);
      setShowEmailModal(true);
      return;
    }

    await doSaveStatus(newStatus);
  }

  async function doSaveStatus(newStatus) {
    setSaving(true);
    try {
      const updatedData = { ...(order.data || order), status: newStatus };
      await dbFetch(`/orders?id=eq.${order.id}`, { method:"PATCH", body: JSON.stringify({ data: updatedData }) });

      const flavors = d.flavorBreakdown ? Object.entries(d.flavorBreakdown).filter(([,q]) => parseInt(q) > 0) : [];

      if (newStatus === "bekraftad" && status !== "bekraftad") {
        for (const [flavorName, qty] of flavors) {
          const flavorId = FLAVORS.find(f => f.name === flavorName)?.id;
          if (!flavorId) continue;
          const newStock = Math.max(0, (inventory[flavorId] ?? 0) - parseInt(qty));
          await dbFetch(`/inventory?flavor_id=eq.${flavorId}`, { method:"PATCH", body: JSON.stringify({ stock: newStock }) });
          setInventory(prev => ({ ...prev, [flavorId]: newStock }));
        }
      }
      if (status === "bekraftad" && newStatus !== "bekraftad") {
        for (const [flavorName, qty] of flavors) {
          const flavorId = FLAVORS.find(f => f.name === flavorName)?.id;
          if (!flavorId) continue;
          const newStock = (inventory[flavorId] ?? 0) + parseInt(qty);
          await dbFetch(`/inventory?flavor_id=eq.${flavorId}`, { method:"PATCH", body: JSON.stringify({ stock: newStock }) });
          setInventory(prev => ({ ...prev, [flavorId]: newStock }));
        }
      }

      setStatus(newStatus);
      onUpdate(order.id, newStatus);
    } catch(e) { console.error(e); }
    setSaving(false);
  }

  const flavors = d.flavorBreakdown ? Object.entries(d.flavorBreakdown).filter(([,q]) => parseInt(q) > 0) : [];

  return (
    <>
      <div style={{ position:"fixed", inset:0, background:"rgba(61,43,26,0.45)", zIndex:100, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
        <div style={{ background:"white", borderRadius:20, width:"100%", maxWidth:560, maxHeight:"90vh", overflowY:"auto", boxShadow:"0 24px 80px rgba(61,43,26,0.25)" }}>
          <div style={{ background:"#3d2b1a", borderRadius:"20px 20px 0 0", padding:"24px 28px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <div>
              <div style={{ fontFamily:"'Playfair Display',serif", fontSize:20, fontWeight:700, color:"white" }}>{d.company||"—"}</div>
              <div style={{ fontSize:12, color:"#c9a87a", marginTop:2 }}>Order #{order.id} · {fmtDate(d.createdAt||d.created_at)}</div>
            </div>
            <div style={{ display:"flex", gap:8, alignItems:"center" }}>
              <button onClick={() => setShowEmailModal(true)}
                style={{ background:"#6d9ee8", border:"none", borderRadius:10, color:"white", padding:"8px 12px", fontFamily:"'Lato',sans-serif", fontWeight:700, fontSize:12, cursor:"pointer" }}>
                📧 Skicka mail
              </button>
              <button onClick={() => printFolljesedel(order)}
                style={{ background:"#c97c3a", border:"none", borderRadius:10, color:"white", padding:"8px 12px", fontFamily:"'Lato',sans-serif", fontWeight:700, fontSize:12, cursor:"pointer" }}>
                🖨️ Följesedel
              </button>
              <button onClick={onClose} style={{ background:"none", border:"none", color:"#c9a87a", fontSize:24, cursor:"pointer" }}>×</button>
            </div>
          </div>
          <div style={{ padding:28 }}>
            <div style={{ marginBottom:24 }}>
              <div style={{ fontSize:11, color:"#9b7048", textTransform:"uppercase", letterSpacing:1, marginBottom:10, fontFamily:"'Lato',sans-serif" }}>
                Status
                {status === "ny" && flavors.length > 0 && <span style={{ color:"#6d9ee8", marginLeft:8, fontSize:11 }}>→ Bekräfta för att skicka mail + dra av frysbollar</span>}
              </div>
              <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                  <button key={key} onClick={() => saveStatus(key)} disabled={saving}
                    style={{ padding:"6px 14px", borderRadius:20, border:`2px solid ${key===status ? cfg.color : "#eadfc8"}`, background: key===status ? cfg.bg : "white", color: key===status ? cfg.color : "#9b7048", fontFamily:"'Lato',sans-serif", fontWeight:700, fontSize:12, cursor:"pointer" }}>
                    {cfg.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:20 }}>
              {[["Kontakt",d.contact],["E-post",d.email],["Leveransdatum",fmtDate(d.deliveryDate)],["Typ",d.orderType==="subscription"?"Abonnemang":"Engång"]].map(([label,val]) => (
                <div key={label} style={{ background:"#fdf8f0", borderRadius:10, padding:"12px 16px" }}>
                  <div style={{ fontSize:11, color:"#9b7048", textTransform:"uppercase", letterSpacing:1, marginBottom:4, fontFamily:"'Lato',sans-serif" }}>{label}</div>
                  <div style={{ fontSize:14, color:"#3d2b1a", fontWeight:600 }}>{val||"—"}</div>
                </div>
              ))}
            </div>

            {d.productName && <div style={{ background:"#fdf8f0", borderRadius:10, padding:"12px 16px", marginBottom:16 }}>
              <div style={{ fontSize:11, color:"#9b7048", textTransform:"uppercase", letterSpacing:1, marginBottom:4, fontFamily:"'Lato',sans-serif" }}>Produkt</div>
              <div style={{ fontSize:14, color:"#3d2b1a", fontWeight:600 }}>{d.productName}</div>
            </div>}

            {flavors.length > 0 && (
              <div style={{ marginBottom:16 }}>
                <div style={{ fontSize:11, color:"#9b7048", textTransform:"uppercase", letterSpacing:1, marginBottom:8, fontFamily:"'Lato',sans-serif" }}>Smaker / Frysbollar</div>
                {flavors.map(([flavor, qty]) => {
                  const flavorId = FLAVORS.find(f => f.name === flavor)?.id;
                  const inStock = flavorId !== undefined ? (inventory[flavorId] ?? 0) : null;
                  const willBeShort = inStock !== null && inStock < parseInt(qty);
                  return (
                    <div key={flavor} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom:"1px solid #f0e8d8" }}>
                      <span style={{ fontSize:14, color:"#3d2b1a" }}>{flavor}</span>
                      <div style={{ display:"flex", gap:16, alignItems:"center" }}>
                        {inStock !== null && <span style={{ fontSize:12, color: willBeShort?"#e8806d":"#9b7048" }}>i frys: {inStock} st{willBeShort?" ⚠️":""}</span>}
                        <span style={{ fontSize:14, color:"#9b7048", fontWeight:700 }}>−{qty} st</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {d.price && <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", background:"#fdf8f0", borderRadius:10, padding:"14px 16px", marginBottom:16 }}>
              <span style={{ fontSize:13, color:"#9b7048" }}>Totalt (exkl. moms)</span>
              <span style={{ fontFamily:"'Playfair Display',serif", fontSize:22, fontWeight:700, color:"#c97c3a" }}>{Number(d.price).toLocaleString("sv-SE")} kr</span>
            </div>}

            {d.notes && <div style={{ background:"#fdf6ec", borderLeft:"3px solid #c97c3a", borderRadius:"0 8px 8px 0", padding:"12px 16px" }}>
              <div style={{ fontSize:11, color:"#9b7048", textTransform:"uppercase", letterSpacing:1, marginBottom:4, fontFamily:"'Lato',sans-serif" }}>Anteckningar</div>
              <div style={{ fontSize:14, color:"#3d2b1a" }}>{d.notes}</div>
            </div>}
          </div>
        </div>
      </div>

      {showEmailModal && (
        <ConfirmEmailModal
          order={order}
          onClose={() => { setShowEmailModal(false); setPendingStatus(null); }}
          onSent={() => {
            notify("Bekräftelsemail skickat! 📧");
            if (pendingStatus) doSaveStatus(pendingStatus);
          }}
        />
      )}
    </>
  );
}

// ── New order form ────────────────────────────────────────────────────────────
function NewOrderForm({ onClose, onSave, type }) {
  const [form, setForm] = useState({ company:"", contact:"", email:"", deliveryDate:"", notes:"", orderType:type });
  const [saving, setSaving] = useState(false);
  const minDate = (() => { const d = new Date(); d.setDate(d.getDate()+3); return d.toISOString().slice(0,10); })();
  const inp = { fontFamily:"'Lato',sans-serif", fontSize:15, padding:"10px 14px", border:"2px solid #eadfc8", borderRadius:10, width:"100%", boxSizing:"border-box", color:"#3d2b1a", background:"white", outline:"none" };

  async function handleSave() {
    if (!form.company||!form.contact||!form.email) return;
    setSaving(true);
    const id = Math.floor(Math.random()*900000)+100000;
    const record = { ...form, id, source:"internal", status:"ny", createdAt:new Date().toISOString().slice(0,10) };
    try {
      await dbFetch("/orders", { method:"POST", body: JSON.stringify({ id, data:record }) });
      onSave({ id, data:record });
      onClose();
    } catch(e) { console.error(e); }
    setSaving(false);
  }

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(61,43,26,0.45)", zIndex:100, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
      <div style={{ background:"white", borderRadius:20, width:"100%", maxWidth:480, boxShadow:"0 24px 80px rgba(61,43,26,0.25)" }}>
        <div style={{ background:"#3d2b1a", borderRadius:"20px 20px 0 0", padding:"24px 28px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div style={{ fontFamily:"'Playfair Display',serif", fontSize:18, fontWeight:700, color:"white" }}>{type==="subscription"?"Nytt abonnemang":"Ny beställning"}</div>
          <button onClick={onClose} style={{ background:"none", border:"none", color:"#c9a87a", fontSize:24, cursor:"pointer" }}>×</button>
        </div>
        <div style={{ padding:28, display:"flex", flexDirection:"column", gap:14 }}>
          {[["Företag *","company","text"],["Kontakt *","contact","text"],["E-post *","email","email"],["Leveransdatum","deliveryDate","date"]].map(([label,key,t]) => (
            <div key={key}>
              <div style={{ fontSize:12, color:"#9b7048", marginBottom:6, fontFamily:"'Lato',sans-serif", textTransform:"uppercase", letterSpacing:1 }}>{label}</div>
              <input type={t} style={inp} min={key==="deliveryDate"?minDate:undefined} value={form[key]} onChange={e => setForm(f=>({...f,[key]:e.target.value}))} />
            </div>
          ))}
          <div>
            <div style={{ fontSize:12, color:"#9b7048", marginBottom:6, fontFamily:"'Lato',sans-serif", textTransform:"uppercase", letterSpacing:1 }}>Anteckningar</div>
            <textarea rows={3} style={{...inp,resize:"vertical"}} value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} />
          </div>
          <div style={{ display:"flex", gap:10, marginTop:8 }}>
            <button onClick={onClose} style={{ flex:1, padding:"12px 0", background:"white", border:"2px solid #eadfc8", borderRadius:10, color:"#9b7048", fontFamily:"'Lato',sans-serif", fontWeight:700, cursor:"pointer" }}>Avbryt</button>
            <button onClick={handleSave} disabled={saving||!form.company||!form.contact||!form.email}
              style={{ flex:2, padding:"12px 0", background:"#3d2b1a", border:"none", borderRadius:10, color:"white", fontFamily:"'Lato',sans-serif", fontWeight:700, cursor:"pointer", opacity:saving?0.6:1 }}>
              {saving?"Sparar...":"Spara"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Frysbollar tab ────────────────────────────────────────────────────────────
function FrysbollarTab({ inventory, setInventory }) {
  const [adjusting, setAdjusting] = useState(null);
  const [addQty, setAddQty] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleAdd(flavorId) {
    const qty = parseInt(addQty);
    if (!qty || qty <= 0) return;
    setSaving(true);
    const newStock = (inventory[flavorId] ?? 0) + qty;
    try {
      await dbFetch(`/inventory?flavor_id=eq.${flavorId}`, { method:"PATCH", body: JSON.stringify({ stock:newStock }) });
      setInventory(prev => ({ ...prev, [flavorId]:newStock }));
      setAdjusting(null); setAddQty("");
    } catch(e) { console.error(e); }
    setSaving(false);
  }

  async function handleSet(flavorId, newStock) {
    const s = Math.max(0, newStock);
    setSaving(true);
    try {
      await dbFetch(`/inventory?flavor_id=eq.${flavorId}`, { method:"PATCH", body: JSON.stringify({ stock:s }) });
      setInventory(prev => ({ ...prev, [flavorId]:s }));
    } catch(e) { console.error(e); }
    setSaving(false);
  }

  const total = Object.values(inventory).reduce((a,b) => a+(b||0), 0);
  const lowStock = FLAVORS.filter(f => (inventory[f.id]??0) < LOW_STOCK_THRESHOLD);

  return (
    <div className="fade-in">
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:16, marginBottom:28 }}>
        {[
          { label:"Totalt i frys", val:`${total} st`, color:"#c97c3a" },
          { label:"Smaker", val:FLAVORS.length, color:"#6d9ee8" },
          { label:`Lågt lager (<${LOW_STOCK_THRESHOLD})`, val:lowStock.length, color: lowStock.length>0?"#e8806d":"#6dc87e" },
        ].map(s => (
          <div key={s.label} style={{ background:"white", borderRadius:16, padding:"20px 24px", boxShadow:"0 2px 16px rgba(180,120,60,0.08)", border:`1px solid ${s.color}30` }}>
            <div style={{ fontSize:11, color:"#9b7048", textTransform:"uppercase", letterSpacing:1, marginBottom:8 }}>{s.label}</div>
            <div style={{ fontFamily:"'Playfair Display',serif", fontSize:36, fontWeight:900, color:s.color }}>{s.val}</div>
          </div>
        ))}
      </div>

      {lowStock.length > 0 && (
        <div style={{ background:"#fff8f0", border:"1px solid #e8b86d", borderRadius:12, padding:"14px 20px", marginBottom:24, display:"flex", alignItems:"center", gap:12 }}>
          <span style={{ fontSize:20 }}>⚠️</span>
          <div>
            <div style={{ fontFamily:"'Lato',sans-serif", fontWeight:700, fontSize:14, color:"#c97c3a", marginBottom:2 }}>Lågt lager — fyll på snart</div>
            <div style={{ fontSize:13, color:"#9b7048" }}>{lowStock.map(f=>f.name).join(", ")}</div>
          </div>
        </div>
      )}

      <div style={{ background:"white", borderRadius:16, boxShadow:"0 2px 16px rgba(180,120,60,0.08)", border:"1px solid #f0e8d8", overflow:"hidden" }}>
        <div style={{ padding:"16px 24px", borderBottom:"2px solid #f5ede0" }}>
          <span style={{ fontFamily:"'Playfair Display',serif", fontSize:18, fontWeight:700, color:"#3d2b1a" }}>Frysbollar per smak</span>
        </div>
        {FLAVORS.map((flavor, i) => {
          const stock = inventory[flavor.id] ?? 0;
          const isLow = stock < LOW_STOCK_THRESHOLD;
          const isAdjusting = adjusting === flavor.id;
          return (
            <div key={flavor.id} style={{ display:"flex", alignItems:"center", padding:"16px 24px", borderBottom: i<FLAVORS.length-1?"1px solid #f5ede0":"none", background: i%2===0?"white":"#fdfaf6", gap:16 }}>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:15, fontWeight:700, color:"#3d2b1a", fontFamily:"'Lato',sans-serif", display:"flex", alignItems:"center", gap:8 }}>
                  {flavor.name}
                  {flavor.gluten && <span style={{ fontSize:10, background:"#e7f0fd", color:"#6d9ee8", borderRadius:10, padding:"2px 7px", fontWeight:700 }}>GF</span>}
                  {flavor.vegan && <span style={{ fontSize:10, background:"#e7fded", color:"#6dc87e", borderRadius:10, padding:"2px 7px", fontWeight:700 }}>Vegansk</span>}
                </div>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                {!isAdjusting ? (
                  <>
                    <button onClick={() => handleSet(flavor.id, stock-1)} disabled={saving||stock===0}
                      style={{ width:30, height:30, borderRadius:"50%", border:"2px solid #eadfc8", background:"white", color:"#9b7048", fontWeight:700, cursor:"pointer", fontSize:18, display:"flex", alignItems:"center", justifyContent:"center" }}>−</button>
                    <div style={{ minWidth:70, textAlign:"center" }}>
                      <span style={{ fontFamily:"'Playfair Display',serif", fontSize:26, fontWeight:900, color: isLow?"#e8806d":"#3d2b1a" }}>{stock}</span>
                      <span style={{ fontSize:12, color:"#9b7048", marginLeft:3 }}>st</span>
                    </div>
                    <button onClick={() => handleSet(flavor.id, stock+1)} disabled={saving}
                      style={{ width:30, height:30, borderRadius:"50%", border:"2px solid #eadfc8", background:"white", color:"#9b7048", fontWeight:700, cursor:"pointer", fontSize:18, display:"flex", alignItems:"center", justifyContent:"center" }}>+</button>
                    <button onClick={() => { setAdjusting(flavor.id); setAddQty(""); }}
                      style={{ padding:"6px 14px", background:"#c97c3a", border:"none", borderRadius:8, color:"white", fontFamily:"'Lato',sans-serif", fontWeight:700, fontSize:12, cursor:"pointer", marginLeft:8 }}>
                      + Batch
                    </button>
                  </>
                ) : (
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <input type="number" min="1" placeholder="Antal" value={addQty} onChange={e=>setAddQty(e.target.value)}
                      style={{ width:80, padding:"6px 10px", border:"2px solid #c97c3a", borderRadius:8, fontFamily:"'Lato',sans-serif", fontSize:14, color:"#3d2b1a", outline:"none" }} />
                    <button onClick={() => handleAdd(flavor.id)} disabled={saving||!addQty}
                      style={{ padding:"6px 14px", background:"#3d2b1a", border:"none", borderRadius:8, color:"white", fontFamily:"'Lato',sans-serif", fontWeight:700, fontSize:12, cursor:"pointer" }}>Lägg till</button>
                    <button onClick={() => setAdjusting(null)}
                      style={{ padding:"6px 10px", background:"white", border:"2px solid #eadfc8", borderRadius:8, color:"#9b7048", fontFamily:"'Lato',sans-serif", fontWeight:700, fontSize:12, cursor:"pointer" }}>Avbryt</button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState("orders");
  const [orders, setOrders] = useState([]);
  const [inventory, setInventory] = useState({});
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [selected, setSelected] = useState(null);
  const [newForm, setNewForm] = useState(null);
  const [filterStatus, setFilterStatus] = useState("alla");
  const [filterType, setFilterType] = useState("alla");
  const [searchQuery, setSearchQuery] = useState("");
  const [notif, setNotif] = useState(null);

  const notify = (msg, type="success") => { setNotif({msg,type}); setTimeout(()=>setNotif(null),3500); };

  const loadData = useCallback(async () => {
    try {
      const [rows, inv] = await Promise.all([
        dbFetch("/orders?order=id.desc&limit=200"),
        dbFetch("/inventory?select=flavor_id,stock"),
      ]);
      setOrders(rows||[]);
      const invMap = {};
      (inv||[]).forEach(r => { invMap[r.flavor_id] = r.stock; });
      FLAVORS.forEach(f => { if (invMap[f.id]===undefined) invMap[f.id]=0; });
      setInventory(invMap);
      setConnected(true);
    } catch(e) { console.error(e); setConnected(false); }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  function handleStatusUpdate(id, newStatus) {
    setOrders(prev => prev.map(o => o.id===id ? {...o, data:{...(o.data||{}), status:newStatus}} : o));
    if (selected?.id===id) setSelected(prev => ({...prev, data:{...(prev.data||{}), status:newStatus}}));
    notify(`Status → ${STATUS_CONFIG[newStatus]?.label}`);
  }

  function handleNewOrder(order) { setOrders(prev=>[order,...prev]); notify("Beställning skapad!"); }

  const filtered = orders.filter(o => {
    if (filterStatus!=="alla" && getStatus(o)!==filterStatus) return false;
    if (filterType!=="alla" && getType(o)!==filterType) return false;
    if (searchQuery) { const q=searchQuery.toLowerCase(); if (!getCompany(o).toLowerCase().includes(q) && !getContact(o).toLowerCase().includes(q)) return false; }
    return true;
  });

  const stats = {
    total: orders.length,
    active: orders.filter(o=>getStatus(o)!=="levererad").length,
    bakas: orders.filter(o=>getStatus(o)==="bakas").length,
    klar: orders.filter(o=>getStatus(o)==="klar").length,
    customer: orders.filter(o=>getSource(o)==="customer").length,
  };

  const lowFrysbollar = FLAVORS.filter(f=>(inventory[f.id]??0)<LOW_STOCK_THRESHOLD).length;

  return (
    <div style={{ minHeight:"100vh", background:"#fdf8f0", fontFamily:"'Lato',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;900&family=Lato:wght@400;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        .fade-in{animation:fadeIn 0.3s ease;}
        @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
        .order-row:hover{background:#fdf3e7!important;cursor:pointer;}
        input:focus,textarea:focus{border-color:#c97c3a!important;}
        ::-webkit-scrollbar{width:6px;}::-webkit-scrollbar-track{background:#fdf8f0;}::-webkit-scrollbar-thumb{background:#eadfc8;border-radius:3px;}
      `}</style>

      {notif && <div style={{ position:"fixed", top:20, right:20, zIndex:300, background:notif.type==="error"?"#ffe7e7":"#e7fded", color:notif.type==="error"?"#c0392b":"#1e7e34", border:`1px solid ${notif.type==="error"?"#f5c6c6":"#b8e6c4"}`, borderRadius:12, padding:"12px 20px", fontFamily:"'Lato',sans-serif", fontSize:14, fontWeight:700, boxShadow:"0 4px 24px rgba(0,0,0,0.1)" }}>{notif.msg}</div>}

      <div style={{ background:"#3d2b1a", padding:"0 32px", position:"sticky", top:0, zIndex:50 }}>
        <div style={{ maxWidth:1200, margin:"0 auto", display:"flex", alignItems:"center", justifyContent:"space-between", height:72 }}>
          <div style={{ display:"flex", alignItems:"center", gap:32 }}>
            <div>
              <div style={{ fontFamily:"'Playfair Display',serif", fontSize:22, fontWeight:900, letterSpacing:1, color:"white" }}>KJ's Cookies</div>
              <div style={{ fontSize:11, color:"#c9a87a", letterSpacing:3, textTransform:"uppercase" }}>Beställningssystem</div>
            </div>
            <div style={{ display:"flex", gap:4 }}>
              {[["orders","📋 Beställningar"],["frysbollar",`🧊 Frysbollar${lowFrysbollar>0?` ⚠️ ${lowFrysbollar}`:""}`]].map(([key,label]) => (
                <button key={key} onClick={()=>setTab(key)}
                  style={{ padding:"8px 16px", borderRadius:8, border:"none", background:tab===key?"rgba(255,255,255,0.15)":"transparent", color:tab===key?"white":"#c9a87a", fontFamily:"'Lato',sans-serif", fontWeight:700, fontSize:13, cursor:"pointer" }}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <DbStatus connected={connected} />
            {tab==="orders" && <>
              <button onClick={()=>setNewForm("subscription")} style={{ background:"transparent", border:"2px solid #c9a87a", borderRadius:10, color:"#c9a87a", padding:"8px 16px", fontFamily:"'Lato',sans-serif", fontWeight:700, fontSize:13, cursor:"pointer" }}>+ Abonnemang</button>
              <button onClick={()=>setNewForm("order")} style={{ background:"#c97c3a", border:"none", borderRadius:10, color:"white", padding:"8px 18px", fontFamily:"'Lato',sans-serif", fontWeight:700, fontSize:13, cursor:"pointer" }}>+ Ny beställning</button>
            </>}
            <button onClick={loadData} style={{ background:"transparent", border:"2px solid #c9a87a", borderRadius:10, color:"#c9a87a", padding:"8px 12px", fontFamily:"'Lato',sans-serif", fontWeight:700, fontSize:13, cursor:"pointer" }}>↻</button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth:1200, margin:"0 auto", padding:"32px 24px" }}>
        {tab==="orders" && <div className="fade-in">
          <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:16, marginBottom:32 }}>
            {[{label:"Totalt",val:stats.total,color:"#c97c3a"},{label:"Aktiva",val:stats.active,color:"#6d9ee8"},{label:"Bakas nu",val:stats.bakas,color:"#e8806d"},{label:"Klara",val:stats.klar,color:"#6dc87e"},{label:"Från kunder",val:stats.customer,color:"#9b7048"}].map(s=>(
              <div key={s.label} style={{ background:"white", borderRadius:16, padding:"20px 24px", boxShadow:"0 2px 16px rgba(180,120,60,0.08)", border:"1px solid #f0e8d8" }}>
                <div style={{ fontSize:11, color:"#9b7048", textTransform:"uppercase", letterSpacing:1, marginBottom:8 }}>{s.label}</div>
                <div style={{ fontFamily:"'Playfair Display',serif", fontSize:36, fontWeight:900, color:s.color }}>{s.val}</div>
              </div>
            ))}
          </div>

          <div style={{ display:"flex", gap:12, marginBottom:20, flexWrap:"wrap", alignItems:"center" }}>
            <input type="text" placeholder="🔍 Sök företag eller kontakt..." value={searchQuery} onChange={e=>setSearchQuery(e.target.value)}
              style={{ padding:"10px 16px", border:"2px solid #eadfc8", borderRadius:10, fontSize:14, color:"#3d2b1a", background:"white", outline:"none", minWidth:260 }} />
            <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
              {["alla",...Object.keys(STATUS_CONFIG)].map(s=>(
                <button key={s} onClick={()=>setFilterStatus(s)}
                  style={{ padding:"8px 14px", borderRadius:20, border:`2px solid ${filterStatus===s?"#3d2b1a":"#eadfc8"}`, background:filterStatus===s?"#3d2b1a":"white", color:filterStatus===s?"white":"#9b7048", fontFamily:"'Lato',sans-serif", fontWeight:700, fontSize:12, cursor:"pointer" }}>
                  {s==="alla"?"Alla":STATUS_CONFIG[s].label}
                  {s!=="alla"&&<span style={{ marginLeft:5, opacity:0.6 }}>{orders.filter(o=>getStatus(o)===s).length}</span>}
                </button>
              ))}
            </div>
            <div style={{ display:"flex", gap:6 }}>
              {[["alla","Alla typer"],["order","Beställning"],["subscription","Abonnemang"]].map(([val,label])=>(
                <button key={val} onClick={()=>setFilterType(val)}
                  style={{ padding:"8px 14px", borderRadius:20, border:`2px solid ${filterType===val?"#c97c3a":"#eadfc8"}`, background:filterType===val?"#c97c3a":"white", color:filterType===val?"white":"#9b7048", fontFamily:"'Lato',sans-serif", fontWeight:700, fontSize:12, cursor:"pointer" }}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ background:"white", borderRadius:16, boxShadow:"0 2px 16px rgba(180,120,60,0.08)", border:"1px solid #f0e8d8", overflow:"hidden" }}>
            <div style={{ padding:"16px 24px", borderBottom:"2px solid #f5ede0" }}>
              <span style={{ fontFamily:"'Playfair Display',serif", fontSize:18, fontWeight:700, color:"#3d2b1a" }}>Beställningar {filtered.length>0&&`(${filtered.length})`}</span>
            </div>
            {loading ? <div style={{ padding:48, textAlign:"center", color:"#9b7048" }}>Laddar...</div>
            : filtered.length===0 ? <div style={{ padding:48, textAlign:"center", color:"#9b7048" }}>Inga beställningar hittades</div>
            : <table style={{ width:"100%", borderCollapse:"collapse" }}>
                <thead><tr style={{ background:"#fdf8f0" }}>
                  {["#","Företag","Kontakt","Leverans","Typ","Källa","Status"].map(h=>(
                    <th key={h} style={{ padding:"12px 16px", textAlign:"left", fontSize:11, color:"#9b7048", textTransform:"uppercase", letterSpacing:1, fontWeight:700, borderBottom:"1px solid #f0e8d8" }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {filtered.map((order,i)=>(
                    <tr key={order.id} className="order-row" onClick={()=>setSelected(order)}
                      style={{ borderBottom:"1px solid #f5ede0", background:i%2===0?"white":"#fdfaf6", transition:"background 0.15s" }}>
                      <td style={{ padding:"14px 16px", fontSize:12, color:"#9b7048", fontWeight:700 }}>{order.id}</td>
                      <td style={{ padding:"14px 16px", fontSize:14, color:"#3d2b1a", fontWeight:700 }}>{getCompany(order)}</td>
                      <td style={{ padding:"14px 16px", fontSize:14, color:"#3d2b1a" }}>{getContact(order)}</td>
                      <td style={{ padding:"14px 16px", fontSize:14, color:"#9b7048" }}>{fmtDate(getDate(order))}</td>
                      <td style={{ padding:"14px 16px" }}><span style={{ fontSize:12, color:getType(order)==="subscription"?"#6d9ee8":"#c97c3a", fontWeight:700 }}>{getType(order)==="subscription"?"Abonnemang":"Beställning"}</span></td>
                      <td style={{ padding:"14px 16px" }}>{getSource(order)==="customer"?<span style={{ background:"#fdf3e7", color:"#c97c3a", border:"1px solid #c97c3a30", borderRadius:20, padding:"2px 8px", fontSize:11, fontWeight:700 }}>Kund</span>:<span style={{ background:"#f0f0f0", color:"#999", borderRadius:20, padding:"2px 8px", fontSize:11, fontWeight:700 }}>Internt</span>}</td>
                      <td style={{ padding:"14px 16px" }}><StatusBadge status={getStatus(order)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>}
          </div>
        </div>}

        {tab==="frysbollar" && <FrysbollarTab inventory={inventory} setInventory={setInventory} />}
      </div>

      {selected && <OrderDetail order={selected} onClose={()=>setSelected(null)} onUpdate={handleStatusUpdate} inventory={inventory} setInventory={setInventory} notify={notify} />}
      {newForm && <NewOrderForm type={newForm} onClose={()=>setNewForm(null)} onSave={handleNewOrder} />}
    </div>
  );
}
