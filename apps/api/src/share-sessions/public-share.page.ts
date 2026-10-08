/**
 * Self-contained page served at /s/:token for people who don't have the app.
 * It polls the JSON endpoint and draws the shared position with MapLibre GL JS
 * on the same free OpenFreeMap basemap as the app: no API key, no build step.
 * The token is validated by the controller before it gets here (url-safe only).
 */
export function renderPublicSharePage(token: string): string {
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<meta name="robots" content="noindex" />
<meta name="theme-color" content="#0B1020" />
<title>Orbit · Position partagée</title>
<link rel="stylesheet" href="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap" rel="stylesheet" />
<style>
  :root {
    --ink: #0B1020; --ink-2: #4A5168; --muted: #8A90A6; --line: rgba(11,16,32,.08);
    --primary: #6C5CE7; --cyan: #22D3EE; --success: #10B981; --warn: #F59E0B;
    --card: rgba(255,255,255,.92);
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; height: 100%; background: #F3F1EC; font-family: "Plus Jakarta Sans", system-ui, sans-serif; color: var(--ink); }
  #map { position: fixed; inset: 0; }
  .card {
    position: fixed; left: 16px; right: 16px; bottom: max(16px, env(safe-area-inset-bottom));
    max-width: 520px; margin: 0 auto; padding: 18px 20px; border-radius: 24px;
    background: var(--card); backdrop-filter: blur(18px); -webkit-backdrop-filter: blur(18px);
    box-shadow: 0 20px 50px rgba(11,16,32,.18), 0 2px 6px rgba(11,16,32,.06);
    animation: rise .6s cubic-bezier(.2,.9,.3,1.2) both;
  }
  @keyframes rise { from { transform: translateY(40px); opacity: 0 } to { transform: none; opacity: 1 } }
  .row { display: flex; align-items: center; gap: 14px; }
  .avatar {
    width: 48px; height: 48px; border-radius: 50%; flex: none; display: grid; place-items: center;
    color: white; font-weight: 800; font-size: 17px;
    background: linear-gradient(135deg, var(--primary), var(--cyan));
    box-shadow: 0 6px 16px rgba(108,92,231,.35);
  }
  .name { font-size: 18px; font-weight: 800; letter-spacing: -.01em; }
  .sub { font-size: 14px; color: var(--ink-2); margin-top: 2px; }
  .pill { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 700; padding: 4px 10px; border-radius: 999px; background: rgba(16,185,129,.12); color: #047857; }
  .pill.off { background: rgba(138,144,166,.15); color: var(--ink-2); }
  .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--success); animation: blink 1.6s infinite; }
  @keyframes blink { 50% { opacity: .3 } }
  .eta { display: flex; gap: 10px; margin-top: 16px; }
  .eta > div { flex: 1; background: rgba(108,92,231,.07); border-radius: 16px; padding: 12px 14px; }
  .eta b { display: block; font-size: 22px; font-weight: 800; letter-spacing: -.02em; }
  .eta span { font-size: 12px; color: var(--muted); font-weight: 600; text-transform: uppercase; letter-spacing: .04em; }
  .foot { margin-top: 14px; font-size: 12px; color: var(--muted); display: flex; justify-content: space-between; gap: 8px; }
  .brand { font-weight: 800; background: linear-gradient(90deg, var(--primary), var(--cyan)); -webkit-background-clip: text; background-clip: text; color: transparent; }
  .me { position: relative; width: 22px; height: 22px; }
  .me i { position: absolute; inset: 0; border-radius: 50%; background: var(--primary); border: 3px solid white; box-shadow: 0 4px 12px rgba(108,92,231,.5); }
  .me::before, .me::after { content: ""; position: absolute; inset: -14px; border-radius: 50%; background: rgba(108,92,231,.25); animation: ping 2.2s ease-out infinite; }
  .me::after { animation-delay: 1.1s; }
  @keyframes ping { from { transform: scale(.3); opacity: 1 } to { transform: scale(1.4); opacity: 0 } }
  .flag { width: 34px; height: 34px; border-radius: 50% 50% 50% 4px; transform: rotate(-45deg); background: var(--ink); display: grid; place-items: center; box-shadow: 0 6px 14px rgba(11,16,32,.3); }
  .flag::after { content: ""; width: 10px; height: 10px; border-radius: 50%; background: white; }
  .center { text-align: center; padding: 8px 0 4px; }
  .big { font-size: 40px; margin-bottom: 4px; }
  .maplibregl-ctrl-attrib { font-size: 10px; }
</style>
</head>
<body>
<div id="map"></div>
<div class="card" id="card"><div class="sub">Chargement…</div></div>
<script src="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js"></script>
<script>
(function () {
  var TOKEN = ${JSON.stringify(token)};
  var card = document.getElementById("card");
  var map = new maplibregl.Map({
    container: "map",
    style: "https://tiles.openfreemap.org/styles/positron",
    center: [2.3522, 48.8566], zoom: 12, attributionControl: { compact: true },
  });
  var meEl = document.createElement("div"); meEl.className = "me"; meEl.innerHTML = "<i></i>";
  var me = new maplibregl.Marker({ element: meEl });
  var flagEl = document.createElement("div"); flagEl.className = "flag";
  var flag = new maplibregl.Marker({ element: flagEl, anchor: "bottom-left" });
  var framed = false, timer = null;

  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return "&#" + c.charCodeAt(0) + ";"; }); }
  function initials(n) { var w = n.trim().split(/\\s+/); return (w.length > 1 ? w[0][0] + w[w.length - 1][0] : n.slice(0, 2)).toUpperCase(); }
  function eta(s) { if (s < 60) return "< 1 min"; var m = Math.round(s / 60); if (m < 60) return m + " min"; return Math.floor(m / 60) + " h " + (m % 60 ? m % 60 + " min" : ""); }
  function dist(m) { return m < 1000 ? Math.round(m) + " m" : (m / 1000).toFixed(1).replace(".", ",") + " km"; }
  function ago(d) { var s = Math.max(0, Math.round((Date.now() - new Date(d)) / 1000)); if (s < 60) return "à l'instant"; var m = Math.round(s / 60); return m < 60 ? "il y a " + m + " min" : "il y a " + Math.round(m / 60) + " h"; }

  function render(d) {
    var name = esc(d.displayName), first = esc(d.displayName.split(" ")[0]);
    if (d.status !== "active") {
      clearInterval(timer); me.remove();
      var arrived = d.status === "arrived";
      card.innerHTML = '<div class="center"><div class="big">' + (arrived ? "🎉" : "👋") + '</div>' +
        '<div class="name">' + (arrived ? first + " est bien arrivé·e" : "Partage terminé") + '</div>' +
        '<div class="sub">' + (arrived && d.destinationName ? "à " + esc(d.destinationName) : "La position de " + first + " n'est plus partagée.") + '</div></div>' +
        '<div class="foot"><span>Partagé avec <span class="brand">Orbit</span></span><span>Lien désactivé</span></div>';
      return;
    }
    var where = d.destinationName ? "En route vers " + esc(d.destinationName) : d.destination ? "En route" : "Partage sa position en direct";
    var html = '<div class="row"><div class="avatar">' + esc(initials(d.displayName)) + '</div><div style="flex:1;min-width:0">' +
      '<div class="name">' + name + '</div><div class="sub">' + where + '</div></div>' +
      '<span class="pill' + (d.position ? "" : " off") + '">' + (d.position ? '<span class="dot"></span>En direct' : "En attente") + '</span></div>';
    if (d.etaSeconds != null) {
      html += '<div class="eta"><div><span>Arrivée</span><b>' + eta(d.etaSeconds) + '</b></div><div><span>Distance</span><b>' + dist(d.distanceMeters) + '</b></div></div>';
    }
    html += '<div class="foot"><span>' + (d.position ? "Mis à jour " + ago(d.position.recordedAt) : "Aucune position reçue pour l'instant") + '</span>' +
      '<span>' + (d.expiresAt ? "Jusqu'à " + new Date(d.expiresAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : '<span class="brand">Orbit</span>') + '</span></div>';
    card.innerHTML = html;

    if (d.destination) flag.setLngLat([d.destination.longitude, d.destination.latitude]).addTo(map);
    if (d.position) {
      var p = [d.position.longitude, d.position.latitude];
      me.setLngLat(p).addTo(map);
      if (!framed) {
        framed = true;
        if (d.destination) {
          var b = new maplibregl.LngLatBounds(p, p).extend([d.destination.longitude, d.destination.latitude]);
          map.fitBounds(b, { padding: { top: 60, left: 50, right: 50, bottom: 260 }, maxZoom: 16, duration: 1200 });
        } else map.flyTo({ center: p, zoom: 15, duration: 1200 });
      }
    }
  }

  function load() {
    fetch("/public/sessions/" + encodeURIComponent(TOKEN))
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(render)
      .catch(function () {
        clearInterval(timer);
        card.innerHTML = '<div class="center"><div class="big">🔒</div><div class="name">Lien invalide</div><div class="sub">Ce partage n\\'existe pas ou n\\'est plus disponible.</div></div>';
      });
  }
  load();
  timer = setInterval(load, 5000);
})();
</script>
</body>
</html>`;
}
