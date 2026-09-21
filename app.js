// Saisie de tournee hors ligne. Les fiches restent dans le telephone tant que
// l'envoi n'a pas ete confirme, et repartent des que le reseau revient.

const CLE = "ouysse.fiches";
const CLE_URL = "ouysse.url";          // adresse du service Drive, propre a l'appareil
const CLE_OTT = "ouysse.ott";          // derniere acquisition OTT par station
const CLE_OP = "ouysse.operateur";

const MAX_LISTE = 10;                  // fiches affichees ; les autres sont dans la feuille
const GARDE_JOURS = 60;                // au-dela, une fiche envoyee est oubliee du telephone

//: (nom du champ, mini, maxi) : hors de cette gamme, un avertissement, jamais un blocage.
const GAMMES = [["ph", 5, 9.5], ["conductivite", 100, 5000], ["o2", 0, 20],
                ["temperature", 0, 30], ["hauteur", -50, 1000]];

const $ = (id) => document.getElementById(id);
const lire = (cle, defaut) => { try { return JSON.parse(localStorage.getItem(cle)) ?? defaut; }
                                catch (e) { return defaut; } };
const ecrire = (cle, val) => { try { localStorage.setItem(cle, JSON.stringify(val)); }
                               catch (e) { alerter("Stockage plein : exporte puis efface."); } };

let fiches = lire(CLE, []);

// L'adresse du service n'est pas dans le code : elle est saisie une fois sur
// l'appareil et gardee en local. Le depot et la page publiee ne portent donc
// aucun secret, et personne d'autre ne peut ecrire dans la feuille.
let URL_DRIVE = lire(CLE_URL, "");

function local(d) {                    // Date -> valeur d'un input datetime-local
  const p = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return p.toISOString().slice(0, 16);
}

function alerter(texte) { $("avert").textContent = texte; }

function etat() {
  const attente = fiches.filter((f) => !f.envoye).length;
  const reseau = navigator.onLine ? "en ligne" : "hors ligne";
  $("etat").innerHTML = `${fiches.length} fiche(s), <b>${attente}</b> en attente d'envoi `
                      + `&middot; ${reseau}` + (URL_DRIVE ? "" : " &middot; envoi non configuré");
  const vues = fiches.slice().reverse();
  $("liste").innerHTML = (vues.slice(0, MAX_LISTE).map((f) =>
    `<li data-id="${f.id}"><span>${f.station}<br>`
    + `<span class="envoye">${f.jour_local.replace("T", " ")}`
    + ` &middot; ${f.hauteur ?? "-"} cm</span></span>`
    + `<span class="${f.envoye ? "envoye" : "attente"}">${f.envoye ? "envoyée" : "en attente"}</span></li>`
  ).join("") || "<li><span class='envoye'>aucune fiche</span></li>")
    + (vues.length > MAX_LISTE
       ? `<li><span class="envoye">+ ${vues.length - MAX_LISTE} fiche(s) plus ancienne(s), `
         + "dans la feuille</span></li>" : "");
}

// Une fiche envoyee depuis longtemps est dans la feuille : la garder ici
// n'apporte rien et alourdit la liste. Celles qui attendent ne sont jamais
// touchees, quel que soit leur age.
function purger() {
  const limite = Date.now() - GARDE_JOURS * 86400000;
  const avant = fiches.length;
  fiches = fiches.filter((f) => !f.envoye || new Date(f.saisie).getTime() > limite);
  if (fiches.length !== avant) ecrire(CLE, fiches);
}

function prefixer() {                  // pre-remplissage depuis la tournee precedente
  const station = $("station").value;
  const ott = lire(CLE_OTT, {})[station];
  $("ott").value = ott || "";
  $("ott_precedent").textContent = ott
    ? `Tournée précédente : ${ott.replace("T", " ")}`
    : "Aucune acquisition OTT notée pour cette station.";
}

function verifier(donnees) {
  const hors = GAMMES.filter(([champ, mini, maxi]) => {
    const v = parseFloat(donnees[champ]);
    return !isNaN(v) && (v < mini || v > maxi);
  }).map(([champ]) => champ);
  alerter(hors.length ? `Valeur inhabituelle : ${hors.join(", ")}. Vérifie avant d'enregistrer.` : "");
  return hors.length === 0;
}

function afficherUtc() {
  const d = new Date($("quand").value);
  $("quand_utc").textContent = isNaN(d) ? ""
    : "Enregistré en UTC : " + jourUtc({ jour_utc: d.toISOString() });
}

$("quand").addEventListener("input", afficherUtc);
$("station").addEventListener("change", prefixer);

$("fiche").addEventListener("submit", (e) => {
  e.preventDefault();
  const form = new FormData(e.target);
  const donnees = Object.fromEntries(form.entries());
  const douteux = !verifier(donnees);
  if (douteux && !confirm("Des valeurs sortent des gammes habituelles. Enregistrer quand même ?"))
    return;

  const quand = new Date(donnees.quand);
  const fiche = {
    id: (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random())),
    station: donnees.station,
    jour_utc: quand.toISOString(),
    jour_local: donnees.quand,
    operateur: donnees.operateur || "",
    hauteur: donnees.hauteur, repere: donnees.repere, conductivite: donnees.conductivite,
    ph: donnees.ph, turbidite: donnees.turbidite, o2: donnees.o2,
    chlorophylle: donnees.chlorophylle, temperature: donnees.temperature,
    etal_cond: form.has("etal_cond") ? "Oui" : "Non",
    etal_hauteur: form.has("etal_hauteur") ? "Oui" : "Non",
    ott: donnees.ott || "", remarque: donnees.remarque || "",
    saisie: new Date().toISOString(), envoye: false,
  };
  fiches.push(fiche);
  ecrire(CLE, fiches);

  const memoire = lire(CLE_OTT, {});
  if (fiche.ott) { memoire[fiche.station] = fiche.ott; ecrire(CLE_OTT, memoire); }
  ecrire(CLE_OP, fiche.operateur);

  e.target.reset();
  $("station").value = fiche.station;
  $("operateur").value = fiche.operateur;
  $("quand").value = local(new Date());
  afficherUtc();
  prefixer();
  etat();
  synchroniser();
});

async function synchroniser() {
  const attente = fiches.filter((f) => !f.envoye);
  if (!attente.length || !URL_DRIVE || !navigator.onLine) return;
  const corps = JSON.stringify(attente);      // text/plain : requete simple, pas de preflight
  let envoyes = null;
  try {
    const reponse = await fetch(URL_DRIVE, { method: "POST", body: corps });
    const recu = await reponse.json();
    if (recu.ok) {
      envoyes = new Set(recu.ids);
      alerter("");
    } else {
      alerter("Le service a refusé l'envoi : " + (recu.erreur || "réponse inattendue"));
    }
  } catch (e) {
    // Apps Script repond par une redirection dont la reponse n'est pas toujours
    // lisible depuis une autre origine. On renvoie alors sans accuse de reception :
    // le service refuse les doublons, un envoi repete est sans danger.
    try {
      await fetch(URL_DRIVE, { method: "POST", mode: "no-cors", body: corps });
      envoyes = new Set(attente.map((f) => f.id));
      alerter("Envoyé sans accusé de réception : vérifie la feuille.");
    } catch (e2) {
      alerter("Envoi impossible pour l'instant, les fiches restent en attente.");
    }
  }
  if (envoyes) {
    fiches.forEach((f) => { if (envoyes.has(f.id)) f.envoye = true; });
    ecrire(CLE, fiches);
  }
  etat();
}

const COLONNES = [
  ["Station", "station"], ["Jour", null], ["Hauteur (cm)", "hauteur"],
  ["Niveau repère (cm)", "repere"], ["Conductivité", "conductivite"], ["pH", "ph"],
  ["Turbidité (NTU)", "turbidite"], ["O2 (mg/L)", "o2"], ["Chlorophylle (RFU)", "chlorophylle"],
  ["Température (°C)", "temperature"], ["Correction", null],
  ["Étalonnage conductivité", "etal_cond"], ["Étalonnage hauteur", "etal_hauteur"],
  ["Dernière acquisition OTT", "ott"], ["Remarque", "remarque"], ["Opérateur", "operateur"],
];

function jourUtc(f) {                  // format attendu par les notebooks : jour d'abord, UTC
  const d = new Date(f.jour_utc), n = (x) => String(x).padStart(2, "0");
  return `${n(d.getUTCDate())}/${n(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} `
       + `${n(d.getUTCHours())}:${n(d.getUTCMinutes())}`;
}

function csv() {
  const cell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lignes = [COLONNES.map(([titre]) => cell(titre)).join(";")];
  fiches.forEach((f) => lignes.push(COLONNES.map(([titre, champ]) =>
    cell(champ ? f[champ] : (titre === "Jour" ? jourUtc(f) : ""))).join(";")));
  return "﻿" + lignes.join("\r\n");
}

$("csv").addEventListener("click", () => {
  const blob = new Blob([csv()], { type: "text/csv;charset=utf-8" });
  const nom = `tournee_${new Date().toISOString().slice(0, 10)}.csv`;
  const fichier = new File([blob], nom, { type: "text/csv" });
  if (navigator.canShare && navigator.canShare({ files: [fichier] })) {
    navigator.share({ files: [fichier], title: nom });
    return;
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = nom;
  a.click();
  URL.revokeObjectURL(a.href);
});

$("reglages").addEventListener("click", () => {
  const saisie = prompt("Adresse du service Drive (.../exec), vide pour désactiver l'envoi :",
                        URL_DRIVE);
  if (saisie === null) return;
  URL_DRIVE = saisie.trim();
  ecrire(CLE_URL, URL_DRIVE);
  etat();
  synchroniser();
});

// L'envoi part seul : a l'enregistrement, au retour du reseau, au demarrage.
// Reste le cas d'une fiche marquee envoyee sans accuse de reception, qui peut
// n'etre jamais arrivee : la toucher dans la liste la remet en attente. Le
// service refuse les doublons, un renvoi est sans danger.
$("liste").addEventListener("click", (e) => {
  const ligne = e.target.closest("li[data-id]");
  if (!ligne) return;
  const fiche = fiches.find((f) => f.id === ligne.dataset.id);
  if (!fiche || !fiche.envoye) return;
  if (!confirm("Renvoyer cette fiche dans la feuille ?")) return;
  fiche.envoye = false;
  ecrire(CLE, fiches);
  etat();
  synchroniser();
});
window.addEventListener("online", () => { etat(); synchroniser(); });
window.addEventListener("offline", etat);

purger();
$("quand").value = local(new Date());
afficherUtc();
$("operateur").value = lire(CLE_OP, "");
prefixer();
etat();
synchroniser();

if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
