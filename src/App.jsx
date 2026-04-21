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
const FLAVOR_NAMES = FLAVORS.map(f => f.name);

const PRODUCTS = [
  { id: "stora_4",  cat: "stora", name: "4 st stora cookies",                 qty: 4,   price: 160  },
  { id: "stora_6",  cat: "stora", name: "6 st stora cookies",                 qty: 6,   price: 230  },
  { id: "stora_12", cat: "stora", name: "12 st stora cookies",                qty: 12,  price: 450  },
  { id: "stora_24", cat: "stora", name: "24 st stora cookies",                qty: 24,  price: 900  },
  { id: "mini_40",  cat: "mini",  name: "Mini Cookies",                       qty: 40,  price: 800, unitPrice: 20, minQty: 40 },
  { id: "fika_25",  cat: "fika",  name: "Teamfika — 25 st stora cookies",     qty: 25,  price: 950  },
  { id: "fika_50",  cat: "fika",  name: "Kontorsfika — 50 st stora cookies",  qty: 50,  price: 1900 },
  { id: "fika_100", cat: "fika",  name: "Stora mötet — 100 st stora cookies", qty: 100, price: 3600 },
  { id: "custom",   cat: "custom",name: "Anpassad mängd stora cookies",        qty: null, price: 0, unitPrice: 43 },
];

const LOW_STOCK = 24;

const STATUS_CONFIG = {
  ny:        { label: "Ny",        color: "#e8b86d", bg: "#fdf6e7" },
  bekraftad: { label: "Bekräftad", color: "#6d9ee8", bg: "#e7f0fd" },
  bakas:     { label: "Bakas",     color: "#e8806d", bg: "#fdeee7" },
  klar:      { label: "Klar",      color: "#6dc87e", bg: "#e7fded" },
  levererad: { label: "Levererad", color: "#a0a0a0", bg: "#f0f0f0" },
};

// ── Hooks ─────────────────────────────────────────────────────────────────────
function useMobile() {
  const [mobile, setMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setMobile(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return mobile;
}

// ── DB ────────────────────────────────────────────────────────────────────────
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

const fmtDate = str => { if (!str) return "—"; const [y,m,d] = str.split("-"); return d&&m&&y?`${d}/${m}/${y}`:str; };
const getStatus  = o => o.data?.status       || o.status       || "ny";
const getType    = o => o.data?.orderType    || o.orderType    || "order";
const getCompany = o => o.data?.company      || o.company      || "—";
const getContact = o => o.data?.contact      || o.contact      || "—";
const getDate    = o => o.data?.deliveryDate || o.deliveryDate || "";
const getSource  = o => o.data?.source       || "internal";

// ── Confirmation email HTML ───────────────────────────────────────────────────
function genEmailHtml(order) {
  const d = order.data||order;
  const flavors = d.flavorBreakdown ? Object.entries(d.flavorBreakdown).filter(([,q])=>parseInt(q)>0) : [];
  const rows = flavors.map(([n,q])=>`<tr><td style="padding:8px 0;border-bottom:1px solid #f0e8d8;font-size:14px;color:#3d2b1a;">${n}</td><td style="padding:8px 0;border-bottom:1px solid #f0e8d8;text-align:right;font-size:14px;color:#9b7048;font-weight:bold;">${q} st</td></tr>`).join("");
  return `<!DOCTYPE html><html lang="sv"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#fdf8f0;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#fdf8f0;padding:48px 24px;"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
<tr><td style="background:#3d2b1a;border-radius:16px 16px 0 0;padding:36px 40px;text-align:center;">
<p style="margin:0 0 4px;font-family:Georgia,serif;font-size:28px;font-weight:700;color:#fff;">KJ's Cookies</p>
<p style="margin:0;font-size:11px;color:#c9a87a;letter-spacing:3px;text-transform:uppercase;">Orderbekräftelse</p></td></tr>
<tr><td style="background:#fff;padding:40px;border-left:1px solid #f0e8d8;border-right:1px solid #f0e8d8;">
<p style="margin:0 0 8px;font-family:Georgia,serif;font-size:22px;font-weight:700;color:#3d2b1a;">Hej ${d.contact||""}!</p>
<p style="margin:0 0 32px;font-size:15px;color:#9b7048;line-height:1.6;">Vi bekräftar härmed din beställning från <strong style="color:#3d2b1a;">${d.company||""}</strong>.</p>
<table width="100%" cellpadding="0" cellspacing="0" style="background:#fdf8f0;border-radius:10px;padding:20px;margin-bottom:32px;">
<tr><td style="font-size:11px;color:#9b7048;text-transform:uppercase;padding-bottom:4px;">Leveransdatum</td><td style="font-size:11px;color:#9b7048;text-transform:uppercase;padding-bottom:4px;text-align:right;">Order #${order.id}</td></tr>
<tr><td style="font-family:Georgia,serif;font-size:20px;font-weight:700;color:#3d2b1a;">${fmtDate(d.deliveryDate)}</td><td style="font-family:Georgia,serif;font-size:20px;font-weight:700;color:#3d2b1a;text-align:right;">${d.productName||""}</td></tr>
${d.price?`<tr><td colspan="2" style="padding-top:16px;border-top:1px solid #f0e8d8;"><span style="font-size:11px;color:#9b7048;text-transform:uppercase;">Totalt (exkl. moms)</span><span style="font-family:Georgia,serif;font-size:22px;font-weight:700;color:#c97c3a;margin-left:16px;">${Number(d.price).toLocaleString("sv-SE")} kr</span></td></tr>`:""}
</table>
${rows?`<p style="margin:0 0 10px;font-size:11px;color:#9b7048;text-transform:uppercase;font-weight:700;">Smaker</p><table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">${rows}</table>`:""}
${d.notes?`<div style="background:#fdf6ec;border-left:3px solid #c97c3a;border-radius:0 8px 8px 0;padding:14px 18px;margin-bottom:28px;"><p style="margin:0 0 4px;font-size:11px;color:#9b7048;text-transform:uppercase;">Anteckningar</p><p style="margin:0;font-size:14px;color:#3d2b1a;">${d.notes}</p></div>`:""}
<p style="margin:0;font-size:14px;color:#9b7048;">Frågor? <a href="mailto:hello@kjscookies.se" style="color:#c97c3a;font-weight:600;text-decoration:none;">hello@kjscookies.se</a></p>
</td></tr>
<tr><td style="background:#f5ede0;border-radius:0 0 16px 16px;border:1px solid #f0e8d8;padding:24px 40px;text-align:center;">
<p style="margin:0 0 4px;font-size:12px;color:#9b7048;">KJ's Cookies · Ninni Kronbergs Gata 8 · Hagastaden, Stockholm</p>
<p style="margin:0;font-size:11px;color:#c9a87a;">@kjscookieclub</p></td></tr>
</table></td></tr></table></body></html>`;
}

// ── Print följesedel ──────────────────────────────────────────────────────────
function printFolljesedel(order) {
  const d = order.data||order;
  const flavors = d.flavorBreakdown ? Object.entries(d.flavorBreakdown).filter(([,q])=>parseInt(q)>0) : [];
  const rows = flavors.map(([n,q])=>`<tr><td style="padding:10px 0;border-bottom:1px solid #f0e8d8;font-size:14px;color:#3d2b1a;">${n}</td><td style="padding:10px 0;border-bottom:1px solid #f0e8d8;text-align:right;font-size:14px;color:#9b7048;font-weight:bold;">${q} st</td></tr>`).join("");
  const html = `<!DOCTYPE html><html lang="sv"><head><meta charset="UTF-8"><title>Följesedel #${order.id}</title>
<style>@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;900&family=Lato:wght@400;700&display=swap');
*{box-sizing:border-box;margin:0;padding:0;}body{background:#fdf8f0;font-family:'Lato',sans-serif;padding:48px;color:#3d2b1a;}
@media print{body{padding:0;background:white;}.no-print{display:none!important;}@page{margin:20mm;}}
.page{max-width:680px;margin:0 auto;}.hdr{background:#3d2b1a;border-radius:16px 16px 0 0;padding:36px 40px;display:flex;justify-content:space-between;align-items:flex-end;}
.body{background:white;padding:40px;border-left:1px solid #f0e8d8;border-right:1px solid #f0e8d8;}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:32px;}.box{background:#fdf8f0;border-radius:10px;padding:14px 18px;}
.lbl{font-size:11px;color:#9b7048;text-transform:uppercase;letter-spacing:1.5px;font-weight:700;margin-bottom:6px;}
table{width:100%;border-collapse:collapse;}.ftr{background:#f5ede0;border-radius:0 0 16px 16px;border:1px solid #f0e8d8;padding:24px 40px;display:flex;justify-content:space-between;align-items:center;}
.btn{display:block;margin:24px auto 0;padding:14px 32px;background:#3d2b1a;color:white;border:none;border-radius:12px;font-family:'Lato',sans-serif;font-weight:700;font-size:15px;cursor:pointer;}
</style></head><body><div class="page">
<div class="hdr"><div><div style="font-family:'Playfair Display',serif;font-size:28px;font-weight:900;color:white;">KJ's Cookies</div><div style="font-size:11px;color:#c9a87a;letter-spacing:3px;text-transform:uppercase;margin-top:4px;">Följesedel</div></div>
<div style="text-align:right"><div style="font-family:'Playfair Display',serif;font-size:22px;font-weight:700;color:white;">Order #${order.id}</div><div style="font-size:12px;color:#c9a87a;margin-top:4px;">Utskriven: ${new Date().toLocaleDateString("sv-SE")}</div></div></div>
<div class="body"><div class="grid">
<div class="box"><div class="lbl">Företag</div><div style="font-size:16px;font-weight:700;margin-top:4px;">${d.company||"—"}</div></div>
<div class="box"><div class="lbl">Kontakt</div><div style="font-size:16px;font-weight:700;margin-top:4px;">${d.contact||"—"}</div></div>
<div class="box"><div class="lbl">Leveransdatum</div><div style="font-size:16px;font-weight:700;margin-top:4px;">${fmtDate(d.deliveryDate)}</div></div>
<div class="box"><div class="lbl">Typ</div><div style="font-size:16px;font-weight:700;margin-top:4px;">${d.orderType==="subscription"?"Abonnemang":"Engångsbeställning"}</div></div>
</div>
${rows?`<hr style="border:none;border-top:2px solid #f0e8d8;margin:0 0 20px;"><div style="font-family:'Playfair Display',serif;font-size:18px;font-weight:700;margin-bottom:12px;">Innehåll</div><table><tbody>${rows}</tbody></table>`:""}
${d.productName?`<div style="margin-top:20px;"><div class="lbl">Produkt</div><div style="font-size:16px;font-weight:700;margin-top:6px;">${d.productName}</div></div>`:""}
${d.price?`<div style="display:flex;justify-content:space-between;align-items:center;background:#fdf8f0;border-radius:10px;padding:16px 20px;margin-top:24px;"><div class="lbl">Totalt (exkl. moms)</div><div style="font-family:'Playfair Display',serif;font-size:26px;font-weight:900;color:#c97c3a;">${Number(d.price).toLocaleString("sv-SE")} kr</div></div>`:""}
${d.notes?`<div style="background:#fdf6ec;border-left:3px solid #c97c3a;border-radius:0 8px 8px 0;padding:14px 18px;margin-top:24px;"><div class="lbl">Anteckningar</div><div style="font-size:14px;margin-top:6px;">${d.notes}</div></div>`:""}
</div>
<div class="ftr"><div><p style="font-size:12px;color:#9b7048;">KJ's Cookies · Ninni Kronbergs Gata 8 · Hagastaden, Stockholm</p><p style="font-size:12px;color:#9b7048;margin-top:4px;">hello@kjscookies.se · @kjscookieclub</p></div>
<div style="font-size:13px;color:#c97c3a;font-weight:700;">Värm i ugn 175° i 4–5 min 🍪</div></div>
<button class="btn no-print" onclick="window.print()">🖨️ Skriv ut</button>
</div></body></html>`;
  const win = window.open("","_blank"); win.document.write(html); win.document.close();
}

// ── Small components ──────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status]||{label:status,color:"#999",bg:"#f0f0f0"};
  return <span style={{ background:cfg.bg,color:cfg.color,border:`1px solid ${cfg.color}30`,borderRadius:20,padding:"3px 10px",fontSize:12,fontWeight:700,fontFamily:"'Lato',sans-serif",whiteSpace:"nowrap" }}>{cfg.label}</span>;
}

// ── Confirmation email modal ──────────────────────────────────────────────────
function ConfirmEmailModal({ order, onClose, onSent }) {
  const d = order.data||order;
  const [subject, setSubject] = useState(`Orderbekräftelse – KJ's Cookies (#${order.id})`);
  const [htmlBody, setHtmlBody] = useState(genEmailHtml(order));
  const [sending, setSending] = useState(false);
  const [preview, setPreview] = useState(false);
  const [error, setError] = useState(null);
  const mobile = useMobile();
  const inp = { fontFamily:"'Lato',sans-serif",fontSize:14,padding:"10px 14px",border:"2px solid #eadfc8",borderRadius:10,width:"100%",boxSizing:"border-box",color:"#3d2b1a",background:"white",outline:"none" };

  async function handleSend() {
    setSending(true); setError(null);
    try {
      const res = await fetch("/api/confirm",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({to:d.email,subject,html:htmlBody})});
      const data = await res.json();
      if (!res.ok) throw new Error(data.error||"Failed");
      onSent(); onClose();
    } catch(e) { setError(e.message); }
    setSending(false);
  }

  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(61,43,26,0.55)",zIndex:200,display:"flex",alignItems:mobile?"flex-end":"center",justifyContent:"center",padding:mobile?0:24 }}>
      <div style={{ background:"white",borderRadius:mobile?"20px 20px 0 0":"20px",width:"100%",maxWidth:mobile?"100%":680,maxHeight:mobile?"95vh":"92vh",overflowY:"auto",boxShadow:"0 -8px 40px rgba(61,43,26,0.2)" }}>
        <div style={{ background:"#3d2b1a",borderRadius:mobile?"20px 20px 0 0":"20px 20px 0 0",padding:"20px 24px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0 }}>
          <div>
            <div style={{ fontFamily:"'Playfair Display',serif",fontSize:17,fontWeight:700,color:"white" }}>Skicka bekräftelse</div>
            <div style={{ fontSize:12,color:"#c9a87a",marginTop:2 }}>Till: {d.email||"—"}</div>
          </div>
          <button onClick={onClose} style={{ background:"none",border:"none",color:"#c9a87a",fontSize:24,cursor:"pointer",padding:"4px 8px" }}>×</button>
        </div>
        <div style={{ padding:mobile?20:28 }}>
          <div style={{ marginBottom:14 }}>
            <div style={{ fontSize:11,color:"#9b7048",textTransform:"uppercase",letterSpacing:1,marginBottom:6,fontFamily:"'Lato',sans-serif" }}>Ämnesrad</div>
            <input value={subject} onChange={e=>setSubject(e.target.value)} style={inp} />
          </div>
          <div style={{ display:"flex",gap:8,marginBottom:14 }}>
            {[["✏️ Redigera",false],["👁 Förhandsgranska",true]].map(([label,val])=>(
              <button key={label} onClick={()=>setPreview(val)} style={{ flex:1,padding:"8px",borderRadius:20,border:`2px solid ${preview===val?"#3d2b1a":"#eadfc8"}`,background:preview===val?"#3d2b1a":"white",color:preview===val?"white":"#9b7048",fontFamily:"'Lato',sans-serif",fontWeight:700,fontSize:12,cursor:"pointer" }}>{label}</button>
            ))}
          </div>
          {!preview
            ? <textarea value={htmlBody} onChange={e=>setHtmlBody(e.target.value)} rows={mobile?8:14} style={{ ...inp,resize:"vertical",fontFamily:"monospace",fontSize:11,lineHeight:1.5,marginBottom:16 }} />
            : <div style={{ marginBottom:16,border:"2px solid #eadfc8",borderRadius:12,overflow:"hidden" }}><iframe srcDoc={htmlBody} style={{ width:"100%",height:mobile?300:460,border:"none" }} title="Förhandsvisning" /></div>
          }
          {error&&<div style={{ background:"#ffe7e7",color:"#c0392b",borderRadius:10,padding:"10px 14px",marginBottom:14,fontSize:13,fontFamily:"'Lato',sans-serif" }}>⚠️ {error}</div>}
          <div style={{ display:"flex",gap:10 }}>
            <button onClick={onClose} style={{ flex:1,padding:"13px 0",background:"white",border:"2px solid #eadfc8",borderRadius:10,color:"#9b7048",fontFamily:"'Lato',sans-serif",fontWeight:700,cursor:"pointer" }}>Avbryt</button>
            <button onClick={handleSend} disabled={sending||!d.email} style={{ flex:2,padding:"13px 0",background:"#3d2b1a",border:"none",borderRadius:10,color:"white",fontFamily:"'Lato',sans-serif",fontWeight:700,cursor:"pointer",opacity:sending?0.6:1 }}>
              {sending?"Skickar...":"📧 Skicka"}
            </button>
          </div>
          {!d.email&&<div style={{ fontSize:12,color:"#e8806d",marginTop:8,fontFamily:"'Lato',sans-serif" }}>⚠️ Ingen e-postadress registrerad.</div>}
        </div>
      </div>
    </div>
  );
}

// ── Order detail modal ────────────────────────────────────────────────────────
function OrderDetail({ order, onClose, onUpdate, inventory, setInventory, notify }) {
  const d = order.data||order;
  const [status, setStatus] = useState(getStatus(order));
  const [saving, setSaving] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const [pendingStatus, setPendingStatus] = useState(null);
  const mobile = useMobile();

  async function doSaveStatus(newStatus) {
    setSaving(true);
    try {
      await dbFetch(`/orders?id=eq.${order.id}`,{method:"PATCH",body:JSON.stringify({data:{...(order.data||order),status:newStatus}})});
      const flavors = d.flavorBreakdown ? Object.entries(d.flavorBreakdown).filter(([,q])=>parseInt(q)>0) : [];
      if (newStatus==="bekraftad"&&status!=="bekraftad") {
        for (const [fn,qty] of flavors) { const fid=FLAVORS.find(f=>f.name===fn)?.id; if(!fid) continue; const ns=Math.max(0,(inventory[fid]??0)-parseInt(qty)); await dbFetch(`/inventory?flavor_id=eq.${fid}`,{method:"PATCH",body:JSON.stringify({stock:ns})}); setInventory(p=>({...p,[fid]:ns})); }
      }
      if (status==="bekraftad"&&newStatus!=="bekraftad") {
        for (const [fn,qty] of flavors) { const fid=FLAVORS.find(f=>f.name===fn)?.id; if(!fid) continue; const ns=(inventory[fid]??0)+parseInt(qty); await dbFetch(`/inventory?flavor_id=eq.${fid}`,{method:"PATCH",body:JSON.stringify({stock:ns})}); setInventory(p=>({...p,[fid]:ns})); }
      }
      setStatus(newStatus); onUpdate(order.id,newStatus);
    } catch(e){console.error(e);}
    setSaving(false);
  }

  function saveStatus(newStatus) {
    if (newStatus===status) return;
    if (newStatus==="bekraftad"&&status!=="bekraftad") { setPendingStatus(newStatus); setShowEmail(true); return; }
    doSaveStatus(newStatus);
  }

  const flavors = d.flavorBreakdown ? Object.entries(d.flavorBreakdown).filter(([,q])=>parseInt(q)>0) : [];

  return (
    <>
      <div style={{ position:"fixed",inset:0,background:"rgba(61,43,26,0.45)",zIndex:100,display:"flex",alignItems:mobile?"flex-end":"center",justifyContent:"center",padding:mobile?0:24 }}>
        <div style={{ background:"white",borderRadius:mobile?"20px 20px 0 0":"20px",width:"100%",maxWidth:mobile?"100%":560,maxHeight:mobile?"95vh":"90vh",overflowY:"auto",boxShadow:"0 -8px 40px rgba(61,43,26,0.2)" }}>
          {/* Header */}
          <div style={{ background:"#3d2b1a",borderRadius:mobile?"20px 20px 0 0":"20px 20px 0 0",padding:"20px 24px",position:"sticky",top:0,zIndex:5 }}>
            <div style={{ display:"flex",alignItems:"flex-start",justifyContent:"space-between" }}>
              <div>
                <div style={{ fontFamily:"'Playfair Display',serif",fontSize:mobile?17:20,fontWeight:700,color:"white" }}>{d.company||"—"}</div>
                <div style={{ fontSize:12,color:"#c9a87a",marginTop:2 }}>Order #{order.id} · {fmtDate(d.createdAt||d.created_at)}</div>
              </div>
              <button onClick={onClose} style={{ background:"none",border:"none",color:"#c9a87a",fontSize:24,cursor:"pointer",padding:"0 0 0 12px",flexShrink:0 }}>×</button>
            </div>
            <div style={{ display:"flex",gap:8,marginTop:14 }}>
              <button onClick={()=>setShowEmail(true)} style={{ flex:1,background:"#6d9ee8",border:"none",borderRadius:10,color:"white",padding:"9px 0",fontFamily:"'Lato',sans-serif",fontWeight:700,fontSize:13,cursor:"pointer" }}>📧 Skicka mail</button>
              <button onClick={()=>printFolljesedel(order)} style={{ flex:1,background:"#c97c3a",border:"none",borderRadius:10,color:"white",padding:"9px 0",fontFamily:"'Lato',sans-serif",fontWeight:700,fontSize:13,cursor:"pointer" }}>🖨️ Följesedel</button>
            </div>
          </div>

          <div style={{ padding:mobile?16:28 }}>
            {/* Status */}
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:11,color:"#9b7048",textTransform:"uppercase",letterSpacing:1,marginBottom:10,fontFamily:"'Lato',sans-serif" }}>Status</div>
              <div style={{ display:"flex",gap:8,flexWrap:"wrap" }}>
                {Object.entries(STATUS_CONFIG).map(([key,cfg])=>(
                  <button key={key} onClick={()=>saveStatus(key)} disabled={saving}
                    style={{ padding:"7px 14px",borderRadius:20,border:`2px solid ${key===status?cfg.color:"#eadfc8"}`,background:key===status?cfg.bg:"white",color:key===status?cfg.color:"#9b7048",fontFamily:"'Lato',sans-serif",fontWeight:700,fontSize:mobile?12:12,cursor:"pointer",flex:mobile?"1 1 calc(50% - 4px)":"0 0 auto" }}>
                    {cfg.label}
                  </button>
                ))}
              </div>
              {status==="ny"&&flavors.length>0&&<div style={{ fontSize:11,color:"#6d9ee8",marginTop:8,fontFamily:"'Lato',sans-serif" }}>→ Bekräfta för att skicka mail + dra av frysbollar automatiskt</div>}
            </div>

            {/* Info */}
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16 }}>
              {[["Kontakt",d.contact],["E-post",d.email],["Leveransdatum",fmtDate(d.deliveryDate)],["Typ",d.orderType==="subscription"?"Abonnemang":"Engång"]].map(([label,val])=>(
                <div key={label} style={{ background:"#fdf8f0",borderRadius:10,padding:"10px 14px" }}>
                  <div style={{ fontSize:10,color:"#9b7048",textTransform:"uppercase",letterSpacing:1,marginBottom:3,fontFamily:"'Lato',sans-serif" }}>{label}</div>
                  <div style={{ fontSize:13,color:"#3d2b1a",fontWeight:600,wordBreak:"break-all" }}>{val||"—"}</div>
                </div>
              ))}
            </div>

            {d.productName&&<div style={{ background:"#fdf8f0",borderRadius:10,padding:"10px 14px",marginBottom:12 }}>
              <div style={{ fontSize:10,color:"#9b7048",textTransform:"uppercase",letterSpacing:1,marginBottom:3,fontFamily:"'Lato',sans-serif" }}>Produkt</div>
              <div style={{ fontSize:13,color:"#3d2b1a",fontWeight:600 }}>{d.productName}</div>
            </div>}

            {flavors.length>0&&<div style={{ marginBottom:12 }}>
              <div style={{ fontSize:10,color:"#9b7048",textTransform:"uppercase",letterSpacing:1,marginBottom:8,fontFamily:"'Lato',sans-serif" }}>Smaker / Frysbollar</div>
              {flavors.map(([flavor,qty])=>{
                const fid=FLAVORS.find(f=>f.name===flavor)?.id;
                const inStock=fid!==undefined?(inventory[fid]??0):null;
                const short=inStock!==null&&inStock<parseInt(qty);
                return (
                  <div key={flavor} style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:"1px solid #f0e8d8" }}>
                    <span style={{ fontSize:13,color:"#3d2b1a" }}>{flavor}</span>
                    <div style={{ display:"flex",gap:12,alignItems:"center",flexShrink:0 }}>
                      {inStock!==null&&<span style={{ fontSize:11,color:short?"#e8806d":"#9b7048" }}>{inStock} i frys{short?" ⚠️":""}</span>}
                      <span style={{ fontSize:13,color:"#9b7048",fontWeight:700 }}>−{qty} st</span>
                    </div>
                  </div>
                );
              })}
            </div>}

            {d.price&&<div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",background:"#fdf8f0",borderRadius:10,padding:"12px 14px",marginBottom:12 }}>
              <span style={{ fontSize:13,color:"#9b7048" }}>Totalt (exkl. moms)</span>
              <span style={{ fontFamily:"'Playfair Display',serif",fontSize:20,fontWeight:700,color:"#c97c3a" }}>{Number(d.price).toLocaleString("sv-SE")} kr</span>
            </div>}

            {d.notes&&<div style={{ background:"#fdf6ec",borderLeft:"3px solid #c97c3a",borderRadius:"0 8px 8px 0",padding:"10px 14px" }}>
              <div style={{ fontSize:10,color:"#9b7048",textTransform:"uppercase",letterSpacing:1,marginBottom:3,fontFamily:"'Lato',sans-serif" }}>Anteckningar</div>
              <div style={{ fontSize:13,color:"#3d2b1a" }}>{d.notes}</div>
            </div>}
          </div>
        </div>
      </div>
      {showEmail&&<ConfirmEmailModal order={order} onClose={()=>{setShowEmail(false);setPendingStatus(null);}} onSent={()=>{notify("Bekräftelsemail skickat! 📧"); if(pendingStatus) doSaveStatus(pendingStatus);}} />}
    </>
  );
}

// ── New order form ────────────────────────────────────────────────────────────
function NewOrderForm({ onClose, onSave, type }) {
  const minDate = (()=>{const d=new Date();d.setDate(d.getDate()+3);return d.toISOString().slice(0,10);})();
  const [form, setForm] = useState({ company:"",contact:"",email:"",phone:"",product:"stora_12",miniQty:40,customQty:12,flavorBreakdown:Object.fromEntries(FLAVOR_NAMES.map(f=>[f,0])),deliveryDate:"",notes:"",orderType:type,interval:"varannan",hagastaden:false });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const mobile = useMobile();

  const prod = PRODUCTS.find(p=>p.id===form.product);
  const isMini = form.product==="mini_40";
  const isCustom = form.product==="custom";
  const isSubscription = form.orderType==="subscription";
  const miniQty = parseInt(form.miniQty)||40;
  const customQty = parseInt(form.customQty)||0;
  const expectedQty = isMini?miniQty:isCustom?customQty:prod?.qty;
  const flavorTotal = Object.values(form.flavorBreakdown).reduce((s,v)=>s+(parseInt(v)||0),0);
  const DELIVERY_FEE = isSubscription||form.hagastaden?0:250;
  const basePrice = isMini?miniQty*20:isCustom?customQty*43:prod?.price||0;
  const price = basePrice+DELIVERY_FEE;

  const inp = { fontFamily:"'Lato',sans-serif",fontSize:15,padding:"11px 14px",border:"2px solid #eadfc8",borderRadius:10,width:"100%",boxSizing:"border-box",color:"#3d2b1a",background:"white",outline:"none" };

  async function handleSave() {
    setError("");
    if (!form.company||!form.contact||!form.email) { setError("Fyll i Företag, Kontakt och E-post"); return; }
    setSaving(true);
    const id = Math.floor(Math.random()*900000)+100000;
    const record = { company:form.company,contact:form.contact,email:form.email,phone:form.phone,product:form.product,productName:isMini?`Mini Cookies — ${miniQty} st`:isCustom?`${customQty} st stora cookies (anpassad)`:prod?.name,flavorBreakdown:flavorTotal===0?null:form.flavorBreakdown,...(isMini?{miniQty}:{}),...(isCustom?{customQty}:{}),price,basePrice,deliveryFee:DELIVERY_FEE,hagastaden:form.hagastaden,orderType:form.orderType,...(isSubscription?{interval:form.interval,nextDelivery:form.deliveryDate,active:true}:{}),deliveryDate:form.deliveryDate,notes:form.notes,id,source:"internal",status:"ny",createdAt:new Date().toISOString().slice(0,10) };
    try { await dbFetch("/orders",{method:"POST",body:JSON.stringify({id,data:record})}); onSave({id,data:record}); onClose(); }
    catch(e) { setError("Något gick fel, försök igen."); }
    setSaving(false);
  }

  const CATS = [{cat:"stora",label:"Stora Cookies (43 kr/st)"},{cat:"mini",label:"Mini Cookies (20 kr/st, min. 40 st)"},{cat:"fika",label:"Fikapaket för kontor"}];

  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(61,43,26,0.55)",zIndex:100,display:"flex",alignItems:mobile?"flex-end":"center",justifyContent:"center",padding:mobile?0:16 }}>
      <div style={{ background:"#fdf8f0",borderRadius:mobile?"20px 20px 0 0":"20px",width:"100%",maxWidth:mobile?"100%":620,maxHeight:mobile?"97vh":"95vh",overflowY:"auto",boxShadow:"0 -8px 40px rgba(61,43,26,0.3)" }}>
        {/* Header */}
        <div style={{ background:"#3d2b1a",borderRadius:mobile?"20px 20px 0 0":"20px 20px 0 0",padding:"20px 24px",display:"flex",justifyContent:"space-between",alignItems:"center",position:"sticky",top:0,zIndex:10 }}>
          <div style={{ fontFamily:"'Playfair Display',serif",fontSize:17,fontWeight:700,color:"white" }}>{type==="subscription"?"Nytt abonnemang":"Ny beställning"}</div>
          <button onClick={onClose} style={{ background:"none",border:"none",color:"#c9a87a",fontSize:24,cursor:"pointer" }}>×</button>
        </div>

        <div style={{ padding:mobile?16:24,display:"flex",flexDirection:"column",gap:14 }}>
          {/* Type toggle */}
          <div style={{ display:"flex",gap:10 }}>
            {[["order","Engångsbeställning"],["subscription","Abonnemang"]].map(([id,label])=>(
              <button key={id} onClick={()=>setForm(f=>({...f,orderType:id}))} style={{ flex:1,border:`2px solid ${form.orderType===id?"#c97c3a":"#eadfc8"}`,borderRadius:12,padding:"11px 8px",background:form.orderType===id?"#fdf3e7":"white",fontFamily:"'Lato',sans-serif",fontWeight:700,fontSize:14,color:form.orderType===id?"#c97c3a":"#9b7048",cursor:"pointer" }}>{label}</button>
            ))}
          </div>
          {isSubscription&&<div style={{ background:"#e7fded",border:"1px solid #a0d8b0",borderRadius:12,padding:"10px 14px",fontFamily:"'Lato',sans-serif",fontSize:13,color:"#1e7e34" }}>Abonnemang inkluderar fri leverans!</div>}

          {/* Contact */}
          <div style={{ background:"white",borderRadius:16,padding:mobile?16:20,boxShadow:"0 2px 12px rgba(180,120,60,0.07)" }}>
            <div style={{ fontFamily:"'Playfair Display',serif",fontSize:15,fontWeight:700,color:"#3d2b1a",marginBottom:12 }}>Kunduppgifter</div>
            <div style={{ display:"grid",gridTemplateColumns:mobile?"1fr":"1fr 1fr",gap:10 }}>
              {[["Företag *","company","text"],["Kontakt *","contact","text"],["E-post *","email","email"],["Telefon","phone","text"]].map(([label,key,t])=>(
                <div key={key}>
                  <div style={{ fontSize:11,color:"#9b7048",textTransform:"uppercase",letterSpacing:1,marginBottom:5,fontFamily:"'Lato',sans-serif" }}>{label}</div>
                  <input type={t} style={inp} value={form[key]} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))} />
                </div>
              ))}
            </div>
          </div>

          {/* Products */}
          <div style={{ background:"white",borderRadius:16,padding:mobile?16:20,boxShadow:"0 2px 12px rgba(180,120,60,0.07)" }}>
            <div style={{ fontFamily:"'Playfair Display',serif",fontSize:15,fontWeight:700,color:"#3d2b1a",marginBottom:12 }}>Välj produkt</div>
            {CATS.map(({cat,label})=>(
              <div key={cat} style={{ marginBottom:12 }}>
                <div style={{ fontSize:11,color:"#9b7048",textTransform:"uppercase",letterSpacing:1,marginBottom:6,fontFamily:"'Lato',sans-serif" }}>{label}</div>
                <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
                  {PRODUCTS.filter(p=>p.cat===cat).map(p=>{
                    const isSel=form.product===p.id, isMiniP=p.id==="mini_40";
                    const dispPrice=isMiniP?(parseInt(form.miniQty)||40)*20:p.price;
                    return (
                      <div key={p.id}>
                        <button onClick={()=>setForm(f=>({...f,product:p.id,flavorBreakdown:Object.fromEntries(FLAVOR_NAMES.map(fn=>[fn,0]))}))} style={{ width:"100%",border:`2px solid ${isSel?"#c97c3a":"#eadfc8"}`,borderRadius:10,padding:"11px 14px",background:isSel?"#fdf3e7":"white",display:"flex",justifyContent:"space-between",cursor:"pointer",fontFamily:"'Lato',sans-serif",fontWeight:isSel?700:400,color:"#3d2b1a",fontSize:14 }}>
                          <span style={{ textAlign:"left" }}>{isMiniP?`Mini Cookies — ${isSel?(parseInt(form.miniQty)||40):40} st`:p.name}</span>
                          <span style={{ color:"#c97c3a",fontWeight:700,flexShrink:0,marginLeft:8 }}>{dispPrice.toLocaleString("sv-SE")} kr</span>
                        </button>
                        {isMiniP&&isSel&&<div style={{ marginTop:8,display:"flex",alignItems:"center",gap:10 }}>
                          <div style={{ flex:1 }}><div style={{ fontSize:11,color:"#9b7048",textTransform:"uppercase",letterSpacing:1,marginBottom:4,fontFamily:"'Lato',sans-serif" }}>Antal (min. 40 st)</div><input type="number" min="40" style={inp} value={form.miniQty} onChange={e=>setForm(f=>({...f,miniQty:parseInt(e.target.value)||40,flavorBreakdown:Object.fromEntries(FLAVOR_NAMES.map(fn=>[fn,0]))}))} /></div>
                          <span style={{ fontFamily:"'Lato',sans-serif",fontSize:12,color:"#9b7048",paddingTop:18 }}>x 20 kr/st</span>
                        </div>}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            <div style={{ marginTop:10,paddingTop:10,borderTop:"1px solid #f0e8d8" }}>
              <button onClick={()=>setForm(f=>({...f,product:"custom",flavorBreakdown:Object.fromEntries(FLAVOR_NAMES.map(fn=>[fn,0]))}))} style={{ width:"100%",border:`2px solid ${isCustom?"#c97c3a":"#eadfc8"}`,borderRadius:10,padding:"11px 14px",background:isCustom?"#fdf3e7":"white",display:"flex",justifyContent:"space-between",cursor:"pointer",fontFamily:"'Lato',sans-serif",fontWeight:isCustom?700:400,color:"#3d2b1a",fontSize:14 }}>
                <span>✏️ Anpassad mängd (43 kr/st)</span>
                {isCustom&&<span style={{ color:"#c97c3a",fontWeight:700 }}>{(customQty*43).toLocaleString("sv-SE")} kr</span>}
              </button>
              {isCustom&&<div style={{ marginTop:8,display:"flex",alignItems:"center",gap:10 }}>
                <div style={{ flex:1 }}><div style={{ fontSize:11,color:"#9b7048",textTransform:"uppercase",letterSpacing:1,marginBottom:4,fontFamily:"'Lato',sans-serif" }}>Antal</div><input type="number" min="1" style={inp} value={form.customQty} onChange={e=>setForm(f=>({...f,customQty:parseInt(e.target.value)||0,flavorBreakdown:Object.fromEntries(FLAVOR_NAMES.map(fn=>[fn,0]))}))} /></div>
                <span style={{ fontFamily:"'Lato',sans-serif",fontSize:12,color:"#9b7048",paddingTop:18 }}>x 43 kr/st</span>
              </div>}
            </div>
          </div>

          {/* Flavors */}
          <div style={{ background:"white",borderRadius:16,padding:mobile?16:20,boxShadow:"0 2px 12px rgba(180,120,60,0.07)" }}>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:12 }}>
              <div style={{ fontFamily:"'Playfair Display',serif",fontSize:15,fontWeight:700,color:"#3d2b1a" }}>Smakval <span style={{ fontSize:12,fontWeight:400,fontFamily:"'Lato',sans-serif",color:"#9b7048" }}>(valfritt)</span></div>
              <span style={{ fontFamily:"'Lato',sans-serif",fontSize:12,color:flavorTotal===0?"#9b7048":flavorTotal===expectedQty?"#5aaa6a":"#e86d6d" }}>{flavorTotal}/{expectedQty||"?"} st</span>
            </div>
            {FLAVORS.map(flavor=>(
              <div key={flavor.id} style={{ display:"flex",alignItems:"center",gap:10,padding:"10px 0",borderBottom:"1px solid #f5ede0" }}>
                <div style={{ flex:1,minWidth:0 }}>
                  <div style={{ display:"flex",alignItems:"center",gap:6,flexWrap:"wrap" }}>
                    <span style={{ fontFamily:"'Lato',sans-serif",fontSize:mobile?13:14,fontWeight:700,color:"#3d2b1a" }}>{flavor.name}</span>
                    {flavor.gluten&&<span style={{ fontSize:10,fontWeight:700,color:"#6d9ee8",background:"#e7f0fd",borderRadius:6,padding:"1px 6px",flexShrink:0 }}>GF</span>}
                    {flavor.vegan&&<span style={{ fontSize:10,fontWeight:700,color:"#5aaa6a",background:"#e7fded",borderRadius:6,padding:"1px 6px",flexShrink:0 }}>Vegansk</span>}
                  </div>
                </div>
                <input type="number" min="0" value={form.flavorBreakdown[flavor.name]||0} onChange={e=>setForm(f=>({...f,flavorBreakdown:{...f.flavorBreakdown,[flavor.name]:parseInt(e.target.value)||0}}))} style={{ width:60,textAlign:"center",flexShrink:0,padding:"8px 4px",fontSize:15,fontFamily:"'Lato',sans-serif",border:"2px solid #eadfc8",borderRadius:8,outline:"none" }} />
                <span style={{ fontFamily:"'Lato',sans-serif",fontSize:12,color:"#9b7048",flexShrink:0 }}>st</span>
              </div>
            ))}
            {flavorTotal===0&&<div style={{ fontFamily:"'Lato',sans-serif",fontSize:12,color:"#9b7048",marginTop:10,fontStyle:"italic" }}>Lämna tomt för blandade smaker!</div>}
          </div>

          {/* Delivery */}
          <div style={{ background:"white",borderRadius:16,padding:mobile?16:20,boxShadow:"0 2px 12px rgba(180,120,60,0.07)" }}>
            <div style={{ fontFamily:"'Playfair Display',serif",fontSize:15,fontWeight:700,color:"#3d2b1a",marginBottom:12 }}>Leverans</div>
            <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
              <div onClick={()=>setForm(f=>({...f,hagastaden:!f.hagastaden}))} style={{ display:"flex",alignItems:"center",gap:12,background:form.hagastaden?"#e7fded":"#fdf8f0",border:`2px solid ${form.hagastaden?"#5aaa6a":"#eadfc8"}`,borderRadius:12,padding:"12px 14px",cursor:"pointer",userSelect:"none" }}>
                <div style={{ width:22,height:22,borderRadius:5,border:`2px solid ${form.hagastaden?"#5aaa6a":"#c9a87a"}`,background:form.hagastaden?"#5aaa6a":"white",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
                  {form.hagastaden&&<span style={{ color:"white",fontSize:13,fontWeight:700 }}>✓</span>}
                </div>
                <div>
                  <div style={{ fontFamily:"'Lato',sans-serif",fontSize:14,fontWeight:700,color:form.hagastaden?"#1e7e34":"#3d2b1a" }}>Levereras inom Hagastaden</div>
                  <div style={{ fontFamily:"'Lato',sans-serif",fontSize:12,color:form.hagastaden?"#1e7e34":"#9b7048",marginTop:2 }}>{form.hagastaden?"✅ Fri leverans tillämpad!":"Bocka i för fri leverans"}</div>
                </div>
              </div>
              {isSubscription&&<div>
                <div style={{ fontSize:11,color:"#9b7048",textTransform:"uppercase",letterSpacing:1,marginBottom:5,fontFamily:"'Lato',sans-serif" }}>Leveransfrekvens</div>
                <select value={form.interval} onChange={e=>setForm(f=>({...f,interval:e.target.value}))} style={inp}>
                  {[["vecka","Varje vecka"],["varannan","Varannan vecka"],["manad","En gång i månaden"]].map(([id,label])=><option key={id} value={id}>{label}</option>)}
                </select>
              </div>}
              <div>
                <div style={{ fontSize:11,color:"#9b7048",textTransform:"uppercase",letterSpacing:1,marginBottom:5,fontFamily:"'Lato',sans-serif" }}>Leveransdatum</div>
                <input type="date" min={minDate} style={inp} value={form.deliveryDate} onChange={e=>setForm(f=>({...f,deliveryDate:e.target.value}))} />
              </div>
              <div>
                <div style={{ fontSize:11,color:"#9b7048",textTransform:"uppercase",letterSpacing:1,marginBottom:5,fontFamily:"'Lato',sans-serif" }}>Anteckningar</div>
                <textarea rows={3} style={{ ...inp,resize:"vertical" }} value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} />
              </div>
            </div>
          </div>

          {/* Summary + submit */}
          <div style={{ background:"#3d2b1a",borderRadius:16,padding:mobile?20:24 }}>
            <div style={{ fontFamily:"'Lato',sans-serif",fontSize:11,color:"#c9a87a",textTransform:"uppercase",letterSpacing:1.2,marginBottom:10 }}>Ordersammanfattning</div>
            <div style={{ display:"flex",justifyContent:"space-between",marginBottom:4 }}>
              <span style={{ fontFamily:"'Lato',sans-serif",fontSize:13,color:"#c9a87a" }}>{isMini?`Mini Cookies — ${miniQty} st`:isCustom?`${customQty} st stora cookies`:prod?.name||"—"}</span>
              <span style={{ fontFamily:"'Lato',sans-serif",fontSize:13,color:"#c9a87a" }}>{basePrice.toLocaleString("sv-SE")} kr</span>
            </div>
            <div style={{ display:"flex",justifyContent:"space-between",marginBottom:10,paddingBottom:10,borderBottom:"1px solid rgba(255,255,255,0.15)" }}>
              <span style={{ fontFamily:"'Lato',sans-serif",fontSize:13,color:(isSubscription||form.hagastaden)?"#6dc87e":"#c9a87a" }}>Leverans{(isSubscription||form.hagastaden)?" — Gratis!":""}</span>
              <span style={{ fontFamily:"'Lato',sans-serif",fontSize:13,color:(isSubscription||form.hagastaden)?"#6dc87e":"#c9a87a",textDecoration:(isSubscription||form.hagastaden)?"line-through":"none" }}>250 kr</span>
            </div>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:14 }}>
              <span style={{ fontFamily:"'Lato',sans-serif",fontSize:11,color:"#c9a87a",textTransform:"uppercase",letterSpacing:1 }}>Totalt (exkl. moms)</span>
              <span style={{ fontFamily:"'Playfair Display',serif",fontSize:26,fontWeight:900,color:"#e8b86d" }}>{price.toLocaleString("sv-SE")} kr</span>
            </div>
            {error&&<div style={{ fontFamily:"'Lato',sans-serif",fontSize:13,color:"#ffb3b3",marginBottom:10,background:"rgba(255,100,100,0.15)",borderRadius:8,padding:"10px 14px" }}>{error}</div>}
            <div style={{ display:"flex",gap:10 }}>
              <button onClick={onClose} style={{ flex:1,padding:"13px 0",background:"transparent",border:"2px solid rgba(255,255,255,0.2)",borderRadius:10,color:"#c9a87a",fontFamily:"'Lato',sans-serif",fontWeight:700,cursor:"pointer" }}>Avbryt</button>
              <button onClick={handleSave} disabled={saving} style={{ flex:2,padding:"13px 0",background:"#c97c3a",border:"none",borderRadius:10,color:"white",fontFamily:"'Lato',sans-serif",fontWeight:700,fontSize:15,cursor:"pointer",opacity:saving?0.6:1 }}>
                {saving?"Sparar...":isSubscription?"Starta abonnemang":"Skapa beställning"}
              </button>
            </div>
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
  const mobile = useMobile();

  async function handleAdd(fid) {
    const qty=parseInt(addQty); if(!qty||qty<=0) return;
    setSaving(true);
    const ns=(inventory[fid]??0)+qty;
    try { await dbFetch(`/inventory?flavor_id=eq.${fid}`,{method:"PATCH",body:JSON.stringify({stock:ns})}); setInventory(p=>({...p,[fid]:ns})); setAdjusting(null); setAddQty(""); } catch(e){console.error(e);}
    setSaving(false);
  }
  async function handleSet(fid,ns) {
    const s=Math.max(0,ns); setSaving(true);
    try { await dbFetch(`/inventory?flavor_id=eq.${fid}`,{method:"PATCH",body:JSON.stringify({stock:s})}); setInventory(p=>({...p,[fid]:s})); } catch(e){console.error(e);}
    setSaving(false);
  }

  const total=Object.values(inventory).reduce((a,b)=>a+(b||0),0);
  const lowStock=FLAVORS.filter(f=>(inventory[f.id]??0)<LOW_STOCK);

  return (
    <div className="fade-in">
      <div style={{ display:"grid",gridTemplateColumns:mobile?"1fr 1fr":"repeat(3,1fr)",gap:12,marginBottom:20 }}>
        {[{label:"Totalt i frys",val:`${total} st`,color:"#c97c3a"},{label:"Smaker",val:FLAVORS.length,color:"#6d9ee8"},{label:`Lågt lager (<${LOW_STOCK})`,val:lowStock.length,color:lowStock.length>0?"#e8806d":"#6dc87e"}].map((s,i)=>(
          <div key={s.label} style={{ background:"white",borderRadius:14,padding:mobile?"14px 16px":"20px 24px",boxShadow:"0 2px 12px rgba(180,120,60,0.07)",border:`1px solid ${s.color}30`,gridColumn:mobile&&i===2?"1 / -1":"auto" }}>
            <div style={{ fontSize:10,color:"#9b7048",textTransform:"uppercase",letterSpacing:1,marginBottom:6 }}>{s.label}</div>
            <div style={{ fontFamily:"'Playfair Display',serif",fontSize:mobile?28:36,fontWeight:900,color:s.color }}>{s.val}</div>
          </div>
        ))}
      </div>
      {lowStock.length>0&&<div style={{ background:"#fff8f0",border:"1px solid #e8b86d",borderRadius:12,padding:"12px 16px",marginBottom:20,display:"flex",alignItems:"center",gap:10 }}>
        <span style={{ fontSize:18 }}>⚠️</span>
        <div><div style={{ fontFamily:"'Lato',sans-serif",fontWeight:700,fontSize:13,color:"#c97c3a",marginBottom:2 }}>Lågt lager — fyll på snart</div>
        <div style={{ fontSize:12,color:"#9b7048" }}>{lowStock.map(f=>f.name).join(", ")}</div></div>
      </div>}
      <div style={{ background:"white",borderRadius:16,boxShadow:"0 2px 16px rgba(180,120,60,0.08)",border:"1px solid #f0e8d8",overflow:"hidden" }}>
        <div style={{ padding:"14px 20px",borderBottom:"2px solid #f5ede0" }}>
          <span style={{ fontFamily:"'Playfair Display',serif",fontSize:17,fontWeight:700,color:"#3d2b1a" }}>Frysbollar per smak</span>
        </div>
        {FLAVORS.map((flavor,i)=>{
          const stock=inventory[flavor.id]??0, isLow=stock<LOW_STOCK, isAdj=adjusting===flavor.id;
          return (
            <div key={flavor.id} style={{ padding:mobile?"14px 16px":"14px 20px",borderBottom:i<FLAVORS.length-1?"1px solid #f5ede0":"none",background:i%2===0?"white":"#fdfaf6" }}>
              <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:isAdj?10:0 }}>
                <div style={{ flex:1,minWidth:0 }}>
                  <div style={{ fontSize:mobile?13:15,fontWeight:700,color:"#3d2b1a",fontFamily:"'Lato',sans-serif",display:"flex",alignItems:"center",gap:6,flexWrap:"wrap" }}>
                    {flavor.name}
                    {flavor.gluten&&<span style={{ fontSize:9,background:"#e7f0fd",color:"#6d9ee8",borderRadius:8,padding:"1px 5px",fontWeight:700 }}>GF</span>}
                    {flavor.vegan&&<span style={{ fontSize:9,background:"#e7fded",color:"#6dc87e",borderRadius:8,padding:"1px 5px",fontWeight:700 }}>Vegansk</span>}
                  </div>
                </div>
                {!isAdj&&<div style={{ display:"flex",alignItems:"center",gap:8,flexShrink:0 }}>
                  <button onClick={()=>handleSet(flavor.id,stock-1)} disabled={saving||stock===0} style={{ width:28,height:28,borderRadius:"50%",border:"2px solid #eadfc8",background:"white",color:"#9b7048",fontWeight:700,cursor:"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center" }}>−</button>
                  <div style={{ minWidth:mobile?52:64,textAlign:"center" }}>
                    <span style={{ fontFamily:"'Playfair Display',serif",fontSize:mobile?20:24,fontWeight:900,color:isLow?"#e8806d":"#3d2b1a" }}>{stock}</span>
                    <span style={{ fontSize:11,color:"#9b7048",marginLeft:2 }}>st</span>
                  </div>
                  <button onClick={()=>handleSet(flavor.id,stock+1)} disabled={saving} style={{ width:28,height:28,borderRadius:"50%",border:"2px solid #eadfc8",background:"white",color:"#9b7048",fontWeight:700,cursor:"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center" }}>+</button>
                  <button onClick={()=>{setAdjusting(flavor.id);setAddQty("");}} style={{ padding:"5px 10px",background:"#c97c3a",border:"none",borderRadius:8,color:"white",fontFamily:"'Lato',sans-serif",fontWeight:700,fontSize:11,cursor:"pointer" }}>+ Batch</button>
                </div>}
              </div>
              {isAdj&&<div style={{ display:"flex",alignItems:"center",gap:8 }}>
                <input type="number" min="1" placeholder="Antal" value={addQty} onChange={e=>setAddQty(e.target.value)} style={{ flex:1,padding:"9px 12px",border:"2px solid #c97c3a",borderRadius:8,fontFamily:"'Lato',sans-serif",fontSize:14,color:"#3d2b1a",outline:"none" }} />
                <button onClick={()=>handleAdd(flavor.id)} disabled={saving||!addQty} style={{ padding:"9px 14px",background:"#3d2b1a",border:"none",borderRadius:8,color:"white",fontFamily:"'Lato',sans-serif",fontWeight:700,fontSize:12,cursor:"pointer" }}>Lägg till</button>
                <button onClick={()=>setAdjusting(null)} style={{ padding:"9px 10px",background:"white",border:"2px solid #eadfc8",borderRadius:8,color:"#9b7048",fontFamily:"'Lato',sans-serif",fontWeight:700,fontSize:12,cursor:"pointer" }}>✕</button>
              </div>}
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
  const mobile = useMobile();

  const notify = (msg,type="success")=>{ setNotif({msg,type}); setTimeout(()=>setNotif(null),3500); };

  const loadData = useCallback(async()=>{
    try {
      const [rows,inv]=await Promise.all([dbFetch("/orders?order=id.desc&limit=200"),dbFetch("/inventory?select=flavor_id,stock")]);
      setOrders(rows||[]);
      const invMap={}; (inv||[]).forEach(r=>{invMap[r.flavor_id]=r.stock;}); FLAVORS.forEach(f=>{if(invMap[f.id]===undefined)invMap[f.id]=0;}); setInventory(invMap);
      setConnected(true);
    } catch(e){console.error(e);setConnected(false);}
    setLoading(false);
  },[]);

  useEffect(()=>{loadData();},[loadData]);

  function handleStatusUpdate(id,newStatus) {
    setOrders(prev=>prev.map(o=>o.id===id?{...o,data:{...(o.data||{}),status:newStatus}}:o));
    if(selected?.id===id) setSelected(prev=>({...prev,data:{...(prev.data||{}),status:newStatus}}));
    notify(`Status → ${STATUS_CONFIG[newStatus]?.label}`);
  }
  function handleNewOrder(order){setOrders(prev=>[order,...prev]);notify("Beställning skapad!");}

  const filtered=[...orders].sort((a,b)=>{ const da=getDate(a)||"9999"; const db=getDate(b)||"9999"; return da<db?-1:da>db?1:0; }).filter(o=>{
    if(filterStatus!=="alla"&&getStatus(o)!==filterStatus) return false;
    if(filterType!=="alla"&&getType(o)!==filterType) return false;
    if(searchQuery){const q=searchQuery.toLowerCase();if(!getCompany(o).toLowerCase().includes(q)&&!getContact(o).toLowerCase().includes(q))return false;}
    return true;
  });

  const stats={ total:orders.length,active:orders.filter(o=>getStatus(o)!=="levererad").length,bakas:orders.filter(o=>getStatus(o)==="bakas").length,klar:orders.filter(o=>getStatus(o)==="klar").length,customer:orders.filter(o=>getSource(o)==="customer").length };
  const lowFrysbollar=FLAVORS.filter(f=>(inventory[f.id]??0)<LOW_STOCK).length;

  return (
    <div style={{ minHeight:"100vh",background:"#fdf8f0",fontFamily:"'Lato',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;900&family=Lato:wght@400;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        .fade-in{animation:fadeIn 0.3s ease;}
        @keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
        .order-row:hover{background:#fdf3e7!important;cursor:pointer;}
        .order-card:active{background:#fdf3e7!important;}
        input:focus,textarea:focus,select:focus{border-color:#c97c3a!important;outline:none;}
        ::-webkit-scrollbar{width:4px;}::-webkit-scrollbar-thumb{background:#eadfc8;border-radius:2px;}
      `}</style>

      {notif&&<div style={{ position:"fixed",top:mobile?undefined:20,bottom:mobile?20:undefined,left:mobile?16:undefined,right:mobile?16:20,zIndex:300,background:notif.type==="error"?"#ffe7e7":"#e7fded",color:notif.type==="error"?"#c0392b":"#1e7e34",border:`1px solid ${notif.type==="error"?"#f5c6c6":"#b8e6c4"}`,borderRadius:12,padding:"12px 18px",fontFamily:"'Lato',sans-serif",fontSize:14,fontWeight:700,boxShadow:"0 4px 24px rgba(0,0,0,0.12)",textAlign:"center" }}>{notif.msg}</div>}

      {/* Header */}
      <div style={{ background:"#3d2b1a",padding:mobile?"0 16px":"0 32px",position:"sticky",top:0,zIndex:50 }}>
        <div style={{ maxWidth:1200,margin:"0 auto",height:mobile?60:72,display:"flex",alignItems:"center",justifyContent:"space-between",gap:12 }}>
          {/* Left: logo + tabs */}
          <div style={{ display:"flex",alignItems:"center",gap:mobile?12:24,minWidth:0 }}>
            {!mobile&&<div>
              <div style={{ fontFamily:"'Playfair Display',serif",fontSize:20,fontWeight:900,letterSpacing:1,color:"white" }}>KJ's Cookies</div>
              <div style={{ fontSize:10,color:"#c9a87a",letterSpacing:3,textTransform:"uppercase" }}>Beställningssystem</div>
            </div>}
            {mobile&&<div style={{ fontFamily:"'Playfair Display',serif",fontSize:16,fontWeight:900,color:"white",letterSpacing:0.5 }}>KJ's 🍪</div>}
            <div style={{ display:"flex",gap:mobile?2:4 }}>
              {[["orders","📋"+(mobile?"":" Beställningar")],["frysbollar","🧊"+(mobile?"":" Frysbollar")+(lowFrysbollar>0?` ⚠️${lowFrysbollar}`:"")]].map(([key,label])=>(
                <button key={key} onClick={()=>setTab(key)} style={{ padding:mobile?"8px 10px":"8px 14px",borderRadius:8,border:"none",background:tab===key?"rgba(255,255,255,0.18)":"transparent",color:tab===key?"white":"#c9a87a",fontFamily:"'Lato',sans-serif",fontWeight:700,fontSize:mobile?13:13,cursor:"pointer",whiteSpace:"nowrap" }}>{label}</button>
              ))}
            </div>
          </div>
          {/* Right: actions */}
          <div style={{ display:"flex",alignItems:"center",gap:mobile?6:10,flexShrink:0 }}>
            {!mobile&&<div style={{ display:"flex",alignItems:"center",gap:6,fontSize:12,color:connected?"#6dc87e":"#e8806d" }}>
              <div style={{ width:7,height:7,borderRadius:"50%",background:connected?"#6dc87e":"#e8806d",boxShadow:connected?"0 0 5px #6dc87e":"none" }} />
              {connected?"Ansluten":"Offline"}
            </div>}
            {tab==="orders"&&<>
              {!mobile&&<button onClick={()=>setNewForm("subscription")} style={{ background:"transparent",border:"2px solid #c9a87a",borderRadius:10,color:"#c9a87a",padding:"7px 12px",fontFamily:"'Lato',sans-serif",fontWeight:700,fontSize:12,cursor:"pointer" }}>+ Abonnemang</button>}
              <button onClick={()=>setNewForm("order")} style={{ background:"#c97c3a",border:"none",borderRadius:10,color:"white",padding:mobile?"8px 12px":"7px 14px",fontFamily:"'Lato',sans-serif",fontWeight:700,fontSize:mobile?13:12,cursor:"pointer",whiteSpace:"nowrap" }}>+ Beställning</button>
            </>}
            <button onClick={loadData} style={{ background:"transparent",border:"2px solid #c9a87a",borderRadius:10,color:"#c9a87a",padding:"7px 10px",fontFamily:"'Lato',sans-serif",fontWeight:700,fontSize:13,cursor:"pointer" }}>↻</button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth:1200,margin:"0 auto",padding:mobile?"16px 12px 32px":"28px 24px" }}>
        {tab==="orders"&&<div className="fade-in">
          {/* Stats */}
          <div style={{ display:"grid",gridTemplateColumns:mobile?"repeat(2,1fr)":"repeat(5,1fr)",gap:mobile?10:14,marginBottom:mobile?16:28 }}>
            {[{label:"Totalt",val:stats.total,color:"#c97c3a"},{label:"Aktiva",val:stats.active,color:"#6d9ee8"},{label:"Bakas",val:stats.bakas,color:"#e8806d"},{label:"Klara",val:stats.klar,color:"#6dc87e"},{label:"Från kunder",val:stats.customer,color:"#9b7048"}].map((s,i)=>(
              <div key={s.label} style={{ background:"white",borderRadius:14,padding:mobile?"12px 14px":"18px 20px",boxShadow:"0 2px 12px rgba(180,120,60,0.07)",border:"1px solid #f0e8d8",gridColumn:mobile&&i===4?"1 / -1":"auto" }}>
                <div style={{ fontSize:10,color:"#9b7048",textTransform:"uppercase",letterSpacing:1,marginBottom:6 }}>{s.label}</div>
                <div style={{ fontFamily:"'Playfair Display',serif",fontSize:mobile?28:32,fontWeight:900,color:s.color }}>{s.val}</div>
              </div>
            ))}
          </div>

          {/* Search */}
          <input type="text" placeholder="🔍 Sök företag eller kontakt..." value={searchQuery} onChange={e=>setSearchQuery(e.target.value)}
            style={{ width:"100%",padding:"11px 16px",border:"2px solid #eadfc8",borderRadius:12,fontSize:14,color:"#3d2b1a",background:"white",outline:"none",marginBottom:12,boxSizing:"border-box" }} />

          {/* Status filters — horizontal scroll on mobile */}
          <div style={{ overflowX:"auto",WebkitOverflowScrolling:"touch",marginBottom:12,paddingBottom:4 }}>
            <div style={{ display:"flex",gap:6,minWidth:"max-content" }}>
              {["alla",...Object.keys(STATUS_CONFIG)].map(s=>(
                <button key={s} onClick={()=>setFilterStatus(s)}
                  style={{ padding:"7px 13px",borderRadius:20,border:`2px solid ${filterStatus===s?"#3d2b1a":"#eadfc8"}`,background:filterStatus===s?"#3d2b1a":"white",color:filterStatus===s?"white":"#9b7048",fontFamily:"'Lato',sans-serif",fontWeight:700,fontSize:12,cursor:"pointer",whiteSpace:"nowrap" }}>
                  {s==="alla"?"Alla":STATUS_CONFIG[s].label}
                  {s!=="alla"&&<span style={{ marginLeft:4,opacity:0.6 }}>{orders.filter(o=>getStatus(o)===s).length}</span>}
                </button>
              ))}
              <div style={{ width:1,background:"rgba(0,0,0,0.1)",margin:"0 4px" }} />
              {[["alla","Alla typer"],["order","Beställning"],["subscription","Abonnemang"]].map(([val,label])=>(
                <button key={val} onClick={()=>setFilterType(val)}
                  style={{ padding:"7px 13px",borderRadius:20,border:`2px solid ${filterType===val?"#c97c3a":"#eadfc8"}`,background:filterType===val?"#c97c3a":"white",color:filterType===val?"white":"#9b7048",fontFamily:"'Lato',sans-serif",fontWeight:700,fontSize:12,cursor:"pointer",whiteSpace:"nowrap" }}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Orders — table on desktop, cards on mobile */}
          {loading ? <div style={{ padding:48,textAlign:"center",color:"#9b7048",fontFamily:"'Lato',sans-serif" }}>Laddar...</div>
          : filtered.length===0 ? <div style={{ padding:48,textAlign:"center",color:"#9b7048",fontFamily:"'Lato',sans-serif" }}>Inga beställningar hittades</div>
          : mobile ? (
            <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
              {filtered.map(order=>(
                <div key={order.id} className="order-card" onClick={()=>setSelected(order)}
                  style={{ background:"white",borderRadius:14,padding:"14px 16px",boxShadow:"0 2px 10px rgba(180,120,60,0.08)",border:"1px solid #f0e8d8",cursor:"pointer",transition:"background 0.15s" }}>
                  <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8 }}>
                    <div>
                      <div style={{ fontFamily:"'Lato',sans-serif",fontSize:15,fontWeight:700,color:"#3d2b1a" }}>{getCompany(order)}</div>
                      <div style={{ fontFamily:"'Lato',sans-serif",fontSize:12,color:"#9b7048",marginTop:2 }}>{getContact(order)}</div>
                    </div>
                    <StatusBadge status={getStatus(order)} />
                  </div>
                  <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center" }}>
                    <div style={{ display:"flex",gap:12,alignItems:"center" }}>
                      <span style={{ fontFamily:"'Lato',sans-serif",fontSize:12,color:"#9b7048" }}>{fmtDate(getDate(order))}</span>
                      <span style={{ fontSize:11,color:getType(order)==="subscription"?"#6d9ee8":"#c97c3a",fontWeight:700 }}>{getType(order)==="subscription"?"Abonnemang":"Beställning"}</span>
                    </div>
                    <div style={{ display:"flex",gap:6,alignItems:"center" }}>
                      {getSource(order)==="customer"&&<span style={{ background:"#fdf3e7",color:"#c97c3a",border:"1px solid #c97c3a30",borderRadius:20,padding:"2px 7px",fontSize:10,fontWeight:700 }}>Kund</span>}
                      <span style={{ fontFamily:"'Lato',sans-serif",fontSize:11,color:"#c9a87a" }}>#{order.id}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ background:"white",borderRadius:16,boxShadow:"0 2px 16px rgba(180,120,60,0.08)",border:"1px solid #f0e8d8",overflow:"hidden" }}>
              <div style={{ padding:"14px 20px",borderBottom:"2px solid #f5ede0" }}>
                <span style={{ fontFamily:"'Playfair Display',serif",fontSize:17,fontWeight:700,color:"#3d2b1a" }}>Beställningar {filtered.length>0&&`(${filtered.length})`}</span>
              </div>
              <table style={{ width:"100%",borderCollapse:"collapse" }}>
                <thead><tr style={{ background:"#fdf8f0" }}>
                  {["#","Företag","Kontakt","Leverans","Typ","Källa","Status"].map(h=>(
                    <th key={h} style={{ padding:"11px 14px",textAlign:"left",fontSize:11,color:"#9b7048",textTransform:"uppercase",letterSpacing:1,fontWeight:700,borderBottom:"1px solid #f0e8d8" }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {filtered.map((order,i)=>(
                    <tr key={order.id} className="order-row" onClick={()=>setSelected(order)} style={{ borderBottom:"1px solid #f5ede0",background:i%2===0?"white":"#fdfaf6",transition:"background 0.15s" }}>
                      <td style={{ padding:"13px 14px",fontSize:12,color:"#9b7048",fontWeight:700 }}>{order.id}</td>
                      <td style={{ padding:"13px 14px",fontSize:14,color:"#3d2b1a",fontWeight:700 }}>{getCompany(order)}</td>
                      <td style={{ padding:"13px 14px",fontSize:14,color:"#3d2b1a" }}>{getContact(order)}</td>
                      <td style={{ padding:"13px 14px",fontSize:14,color:"#9b7048" }}>{fmtDate(getDate(order))}</td>
                      <td style={{ padding:"13px 14px" }}><span style={{ fontSize:12,color:getType(order)==="subscription"?"#6d9ee8":"#c97c3a",fontWeight:700 }}>{getType(order)==="subscription"?"Abonnemang":"Beställning"}</span></td>
                      <td style={{ padding:"13px 14px" }}>{getSource(order)==="customer"?<span style={{ background:"#fdf3e7",color:"#c97c3a",border:"1px solid #c97c3a30",borderRadius:20,padding:"2px 8px",fontSize:11,fontWeight:700 }}>Kund</span>:<span style={{ background:"#f0f0f0",color:"#999",borderRadius:20,padding:"2px 8px",fontSize:11,fontWeight:700 }}>Internt</span>}</td>
                      <td style={{ padding:"13px 14px" }}><StatusBadge status={getStatus(order)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>}

        {tab==="frysbollar"&&<FrysbollarTab inventory={inventory} setInventory={setInventory} />}
      </div>

      {selected&&<OrderDetail order={selected} onClose={()=>setSelected(null)} onUpdate={handleStatusUpdate} inventory={inventory} setInventory={setInventory} notify={notify} />}
      {newForm&&<NewOrderForm type={newForm} onClose={()=>setNewForm(null)} onSave={handleNewOrder} />}
    </div>
  );
}
