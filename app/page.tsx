"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Activity, Bell, Check, CirclePause, CirclePlay, CreditCard, Disc3, ExternalLink, Music2, Plus, Pencil, Search, ShieldCheck, ShoppingBag, Ticket, Trash2, Zap } from "lucide-react";
import { DEMO_ACTIVITY, DEMO_PROFILES } from "@/lib/demo-data";
import type { ProfileKind, SearchProfile } from "@/lib/types";

const STORAGE_KEY = "droppilot.profiles.v1";

type DetectedProvider = "eventim" | "ticketmaster" | "generic";
function detectProvider(rawUrl: string): DetectedProvider | null {
  if (!rawUrl.trim()) return null;
  try {
    const host = new URL(rawUrl).hostname.toLowerCase().replace(/^www\./, "");
    if (host.includes("eventim")) return "eventim";
    if (host.includes("ticketmaster")) return "ticketmaster";
    return "generic";
  } catch { return null; }
}
function providerLabel(provider: DetectedProvider | null) {
  if (provider === "eventim") return "Eventim erkannt";
  if (provider === "ticketmaster") return "Ticketmaster erkannt";
  if (provider === "generic") return "Allgemeine Shop-/Eventseite";
  return "Anbieter wird anhand der URL erkannt";
}

export default function Home() {
  const [profiles, setProfiles] = useState<SearchProfile[]>([]);
  const [ready, setReady] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [kind, setKind] = useState<ProfileKind>("drop");
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [keywords, setKeywords] = useState("");
  const [quantity, setQuantity] = useState("2");
  const [maxPrice, setMaxPrice] = useState("65");
  const [instantBuy, setInstantBuy] = useState(false);
  const [payment, setPayment] = useState<"paypal" | "klarna">("paypal");
  const [filter, setFilter] = useState<"all" | ProfileKind>("all");
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function loadProfiles() {
      try {
        const response = await fetch("/api/profiles", { cache: "no-store" });
        if (!response.ok) throw new Error("Datenbank konnte nicht geladen werden.");
        const data = await response.json() as { profiles: SearchProfile[] };
        if (cancelled) return;

        if (data.profiles.length > 0) {
          setProfiles(data.profiles);
        } else {
          let initialProfiles = DEMO_PROFILES;
          try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) initialProfiles = JSON.parse(saved) as SearchProfile[];
          } catch {
            // Use demo profiles if old browser data is unreadable.
          }
          setProfiles(initialProfiles);
        }
        setReady(true);
      } catch (error) {
        console.error("DropPilot konnte die Datenbank nicht laden:", error);
      }
    }
    loadProfiles();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
    fetch("/api/profiles", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profiles }),
    }).catch((error) => console.error("Profil-Synchronisierung fehlgeschlagen:", error));
  }, [profiles, ready]);

  const visibleProfiles = useMemo(() => profiles.filter((profile) => {
    const matchesKind = filter === "all" || profile.kind === filter;
    const matchesQuery = (profile.name + " " + profile.keywords.join(" ")).toLowerCase().includes(query.toLowerCase());
    return matchesKind && matchesQuery;
  }), [profiles, filter, query]);

  const activeCount = profiles.filter((profile) => profile.status === "active").length;
  const instantCount = profiles.filter((profile) => profile.instantBuy).length;

  function openCreateForm() {
    setEditingId(null);
    setKind("drop"); setName(""); setUrl(""); setKeywords("");
    setQuantity("2"); setMaxPrice("65"); setInstantBuy(false); setPayment("paypal");
    setShowForm(true);
  }

  function openEditForm(profile: SearchProfile) {
    setEditingId(profile.id);
    setKind(profile.kind); setName(profile.name); setUrl(profile.url);
    setKeywords(profile.keywords.join(", ")); setQuantity(String(profile.quantity));
    setMaxPrice(profile.maxPrice === null ? "" : String(profile.maxPrice));
    setInstantBuy(profile.instantBuy); setPayment(profile.paymentPreference);
    setShowForm(true);
  }

  function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim() || !url.trim() || !detectProvider(url)) return;
    const values = {
      kind, name: name.trim(), url: url.trim(), provider: detectProvider(url) ?? "generic",
      keywords: keywords.split(",").map((word) => word.trim()).filter(Boolean),
      quantity: Math.max(1, Number(quantity) || 1),
      maxPrice: maxPrice.trim() ? Number(maxPrice) : null,
      instantBuy, paymentPreference: payment
    };
    if (editingId) {
      setProfiles((current) => current.map((profile) =>
        profile.id === editingId ? { ...profile, ...values } : profile
      ));
    } else {
      const profile: SearchProfile = {
        id: crypto.randomUUID(), ...values, status: "active", createdAt: new Date().toISOString()
      };
      setProfiles((current) => [profile, ...current]);
    }
    setEditingId(null);
    setShowForm(false);
  }

  function toggleStatus(id: string) {
    setProfiles((current) => current.map((profile) => profile.id === id
      ? { ...profile, status: profile.status === "active" ? "paused" : "active" } : profile));
  }

  function toggleInstantBuy(id: string) {
    setProfiles((current) => current.map((profile) => profile.id === id
      ? { ...profile, instantBuy: !profile.instantBuy } : profile));
  }

  return (
    <main className="shell">
      <aside className="sidebar">
        <a className="brand" href="#"><span className="brand-mark"><Zap size={18} /></span>drop<span>pilot</span><small>BETA</small></a>
        <div className="side-label">WORKSPACE</div>
        <nav>
          <a className="nav-link selected" href="#overview"><Activity size={17} /> Übersicht</a>
          <a className="nav-link" href="#profiles"><Search size={17} /> Suchprofile <b>{profiles.length}</b></a>
          <a className="nav-link" href="#activity"><CreditCard size={17} /> Aktivitäten</a>
        </nav>
        <div className="side-bottom">
          <div className="server-status"><i /> <div><strong>{ready ? "Turso verbunden" : "Verbinde …"}</strong><small>Persönliche Datenbank · kein Worker</small></div></div>
          <div className="account"><span>G</span><div><strong>Mein DropPilot</strong><small>Persönlicher Agent</small></div></div>
        </div>
      </aside>

      <section className="main" id="overview">
        <header className="topbar"><span>Workspace <b>/</b> Übersicht</span><div className="top-right"><em><i /> DEMO UMGEBUNG</em><button className="icon-button" aria-label="Benachrichtigungen"><Bell size={17} /></button></div></header>
        <div className="content">
          <section className="intro">
            <div><div className="overline">DEIN PERSÖNLICHER BOOKING-AGENT</div><h1>Alles im Blick. <span>Keinen Drop verpassen.</span></h1><p>Ticket- und Shopseiten per URL hinzufügen. DropPilot erkennt den Anbieter automatisch.</p></div>
            <button className="primary" onClick={openCreateForm}><Plus size={16} /> Suchprofil erstellen</button>
          </section>

          <section className="stats">
            <article><div>Aktive Suchprofile <Search /></div><strong>{ready ? activeCount : "–"}</strong><small>in Turso gespeichert</small></article>
            <article><div>Ticket-Monitor <Ticket /></div><strong>{profiles.filter(p => p.kind === "ticket").length}</strong><small>Event-URLs hinterlegt</small></article>
            <article><div>Drop-Monitor <Disc3 /></div><strong>{profiles.filter(p => p.kind === "drop").length}</strong><small>Produkt-Suchprofile</small></article>
            <article><div>Sofortkauf-Regeln <Zap /></div><strong>{instantCount}</strong><small>Checkout-Modus aktiviert</small></article>
          </section>

          <div className="section-title" id="profiles"><div><div className="overline">MONITORING</div><h2>Deine Suchprofile</h2></div><button className="text-button" onClick={openCreateForm}>Profil hinzufügen <Plus size={15} /></button></div>
          <section className="panel">
            <div className="toolbar"><div className="filters">
              <button className={filter === "all" ? "filter active" : "filter"} onClick={() => setFilter("all")}>Alle <b>{profiles.length}</b></button>
              <button className={filter === "ticket" ? "filter active" : "filter"} onClick={() => setFilter("ticket")}><Ticket size={14} /> Tickets</button>
              <button className={filter === "drop" ? "filter active" : "filter"} onClick={() => setFilter("drop")}><ShoppingBag size={14} /> Drops</button>
            </div><label className="search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Profile durchsuchen" /></label></div>

            <div className="profile-list">
              {visibleProfiles.map((profile) => <article className="profile" key={profile.id}>
                <div className={profile.kind === "ticket" ? "profile-icon ticket" : "profile-icon drop"}>{profile.kind === "ticket" ? <Music2 size={19} /> : <ShoppingBag size={19} />}</div>
                <div className="profile-info"><div className="profile-name"><strong>{profile.name}</strong><span className={profile.status === "active" ? "status live" : "status paused"}>{profile.status === "active" ? "Aktiv" : "Pausiert"}</span></div>
                  <div className="meta">{profile.kind === "ticket" ? "Ticket / Event" : "Shop-Produkt"} · {providerLabel(detectProvider(profile.url))} · {profile.quantity} {profile.kind === "ticket" ? "Tickets" : "Stück"}{profile.maxPrice !== null ? " · Limit " + profile.maxPrice.toLocaleString("de-DE", { style: "currency", currency: "EUR" }) : ""}</div>
                  <div className="keywords">{profile.keywords.map(word => <span key={word}>{word}</span>)}</div>
                  {profile.url && <a className="source" href={profile.url} target="_blank" rel="noreferrer"><ExternalLink size={12} /> Quelle öffnen</a>}
                </div>
                <div className="profile-controls"><small><CreditCard size={13} /> {profile.paymentPreference === "paypal" ? "PayPal bevorzugt" : "Klarna bevorzugt"}</small>
                  <button className={profile.instantBuy ? "toggle on" : "toggle"} onClick={() => toggleInstantBuy(profile.id)} aria-pressed={profile.instantBuy}><i /> Sofort kaufen</button></div>
                <div className="row-actions"><button className="icon-button" onClick={() => openEditForm(profile)} aria-label="Bearbeiten"><Pencil size={15} /></button><button className="icon-button" onClick={() => toggleStatus(profile.id)} aria-label={profile.status === "active" ? "Pausieren" : "Fortsetzen"}>{profile.status === "active" ? <CirclePause size={16} /> : <CirclePlay size={16} />}</button><button className="icon-button" onClick={() => setProfiles(current => current.filter(p => p.id !== profile.id))} aria-label="Löschen"><Trash2 size={15} /></button></div>
              </article>)}
              {visibleProfiles.length === 0 && <div className="empty"><Search /><strong>Keine Suchprofile gefunden</strong><span>Ändere den Filter oder erstelle ein neues Profil.</span></div>}
            </div>
            <div className="panel-foot"><ShieldCheck size={15} /> Profile werden in deiner Turso-Datenbank gespeichert. Anbietererkennung ist vorbereitet. Automatische Seitenabfragen und Bestellungen sind noch nicht aktiviert.</div>
          </section>

          <div className="bottom-grid">
            <section className="panel activity" id="activity"><div className="section-title compact"><div><div className="overline">LIVE-LOG</div><h2>Letzte Aktivitäten</h2></div><span className="demo-tag">DEMO</span></div>
              {DEMO_ACTIVITY.map(item => <div className="activity-row" key={item.id}><span className={"activity-mark " + item.tone}>{item.tone === "success" ? <Check size={13} /> : <ShieldCheck size={13} />}</span><div><strong>{item.title}</strong><small>{item.detail}</small></div><time>{item.time}</time></div>)}
            </section>
            <aside className="next-card"><div className="overline">NÄCHSTER AUSBAUSCHRITT</div><h3>Den Monitor verbinden</h3><p>Als Nächstes verbinden wir den Hausserver, sichere Datenhaltung und Push-Nachrichten mit diesem Dashboard.</p><div><Check size={14} /> UI-Grundgerüst steht</div><div><ShieldCheck size={14} /> Checkout-Schutz vorgesehen</div></aside>
          </div>
          <footer>DropPilot 0.1.0 <span>Keine Zahlung ohne erforderliche Autorisierung</span></footer>
        </div>
      </section>

      {showForm && <div className="backdrop" onMouseDown={event => { if (event.target === event.currentTarget) { setShowForm(false); setEditingId(null); } }}>
        <section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <div className="modal-head"><div><div className="overline">URL-BASIERTES MONITORING</div><h2 id="modal-title">{editingId ? "Suchprofil bearbeiten" : "Suchprofil erstellen"}</h2></div><button className="icon-button" onClick={() => { setShowForm(false); setEditingId(null); }} aria-label="Schließen">×</button></div>
          <form onSubmit={saveProfile}>
            <div className="kind-tabs"><button type="button" className={kind === "drop" ? "chosen" : ""} onClick={() => setKind("drop")}><ShoppingBag size={15} /> Produkt-Drop</button><button type="button" className={kind === "ticket" ? "chosen" : ""} onClick={() => setKind("ticket")}><Ticket size={15} /> Konzertticket</button></div>
            <label>Name des Suchprofils<input required value={name} onChange={e => setName(e.target.value)} placeholder={kind === "drop" ? "z. B. Pokémon Booster-Display" : "z. B. Lieblingsband – Tour 2027"} /></label>
            <label>Website-URL<input type="url" required value={url} onChange={e => setUrl(e.target.value)} placeholder={kind === "ticket" ? "https://www.eventim.de/ oder Ticket-Link" : "https://www.pokemoncenter.com/"} />
            <small className="url-detection">{providerLabel(detectProvider(url))}</small></label>
            <label>Suchbegriffe <small>Kommagetrennt</small><input value={keywords} onChange={e => setKeywords(e.target.value)} placeholder="Pokémon, Booster, Display, neue Edition" /></label>
            <div className="two-fields"><label>Menge<input type="number" min="1" max="20" value={quantity} onChange={e => setQuantity(e.target.value)} /></label><label>Maximalpreis / Stück (€)<input type="number" min="0" step="0.01" value={maxPrice} onChange={e => setMaxPrice(e.target.value)} placeholder="Kein Limit" /></label></div>
            <label>Zahlungspräferenz<select value={payment} onChange={e => setPayment(e.target.value as "paypal" | "klarna")}><option value="paypal">PayPal bevorzugt</option><option value="klarna">Klarna bevorzugt</option></select></label>
            <label className="check-row"><input type="checkbox" checked={instantBuy} onChange={e => setInstantBuy(e.target.checked)} /><span><strong>Sofort kaufen</strong><small>Checkout automatisch vorbereiten, sofern vom Shop zugelassen. Zahlungsfreigaben bleiben erforderlich.</small></span></label>
            <div className="modal-actions"><button type="button" className="secondary" onClick={() => { setShowForm(false); setEditingId(null); }}>Abbrechen</button><button type="submit" className="primary">{editingId ? <Check size={15} /> : <Plus size={15} />} {editingId ? "Änderungen speichern" : "Profil speichern"}</button></div>
          </form>
        </section>
      </div>}
    </main>
  );
}
