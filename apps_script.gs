// Recoit les fiches de tournee et les ecrit dans la feuille.
// Deploiement : Extensions > Apps Script, TOUT effacer dans Code.gs, coller ce
// fichier, enregistrer, puis Deployer > Nouveau deploiement > Application web,
// executer en tant que moi, acces "Tout le monde". Copier l'URL obtenue dans
// URL_DRIVE, premiere ligne utile de terrain/app.js.

// Identifiant du classeur, lisible dans son adresse entre /d/ et /edit.
// Designer la feuille par son ID marche que le script soit cree depuis la
// feuille ou depuis script.google.com, contrairement a getActiveSpreadsheet.
var ID_FEUILLE = "1HKFvJ5cZjE5ViTcvVFXO6M3b5JFlnGHne0eeWcDfhiw";

// La station n'est plus une colonne : c'est le nom de l'onglet.
var COLONNES = ["ID", "Jour", "Hauteur (cm)", "Niveau repère (cm)", "Conductivité",
                "pH", "Turbidité (NTU)", "O2 (mg/L)", "Chlorophylle (RFU)", "Température (°C)",
                "Correction", "Étalonnage conductivité", "Étalonnage hauteur",
                "Dernière acquisition OTT", "Remarque", "Opérateur"];

// Jour d'abord et heure UTC, comme le lisent les notebooks.
function jourUtc(iso) {
  return Utilities.formatDate(new Date(iso), "UTC", "dd/MM/yyyy HH:mm");
}

// Un onglet par station : une chronique se relit sans poser de filtre, et deux
// stations saisies le meme jour ne se melangent pas. L'onglet et sa ligne
// d'en-tete naissent au premier envoi, pour que les colonnes n'aient qu'une
// seule definition, ici.
function onglet(classeur, station) {
  var nom = String(station || "Sans station").replace(/[\[\]\*\?:\/\\]/g, " ").slice(0, 90);
  var feuille = classeur.getSheetByName(nom);
  if (!feuille) {
    feuille = classeur.insertSheet(nom);
    feuille.appendRow(COLONNES);
    feuille.setFrozenRows(1);
  }
  return feuille;
}

// Identifiants deja presents dans cet onglet : une fiche recue deux fois
// (renvoi, envoi sans accuse de reception) n'est jamais dupliquee.
function connus(feuille) {
  var vus = {};
  if (feuille.getLastRow() > 1) {
    var ids = feuille.getRange(2, 1, feuille.getLastRow() - 1, 1).getValues();
    for (var i = 0; i < ids.length; i++) {
      vus[ids[i][0]] = true;
    }
  }
  return vus;
}

function reponse(objet) {
  return ContentService.createTextOutput(JSON.stringify(objet))
                       .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var verrou = LockService.getScriptLock();
  verrou.waitLock(30000);                     // deux telephones peuvent envoyer ensemble
  try {
    var fiches = JSON.parse(e.postData.contents);
    var classeur = SpreadsheetApp.openById(ID_FEUILLE);

    var recus = [];
    var parStation = {};                      // station -> lignes a ecrire
    var vus = {};                             // station -> identifiants deja en feuille
    var ecrites = 0;
    for (var j = 0; j < fiches.length; j++) {
      var f = fiches[j];
      recus.push(f.id);
      var feuille = onglet(classeur, f.station);
      var nom = feuille.getName();
      if (!vus[nom]) {
        vus[nom] = connus(feuille);
        parStation[nom] = { feuille: feuille, lignes: [] };
      }
      if (vus[nom][f.id]) {
        continue;
      }
      vus[nom][f.id] = true;                  // deux fois dans le meme envoi : une seule ligne
      // Correction reste vide : elle se decide au bureau, devant le graphe.
      parStation[nom].lignes.push([f.id, jourUtc(f.jour_utc), f.hauteur, f.repere,
                   f.conductivite, f.ph, f.turbidite, f.o2, f.chlorophylle, f.temperature, "",
                   f.etal_cond, f.etal_hauteur, f.ott, f.remarque, f.operateur]);
    }

    for (var nom2 in parStation) {
      var bloc = parStation[nom2];
      if (bloc.lignes.length > 0) {
        bloc.feuille.getRange(bloc.feuille.getLastRow() + 1, 1,
                              bloc.lignes.length, COLONNES.length).setValues(bloc.lignes);
        ecrites += bloc.lignes.length;
      }
    }
    return reponse({ ok: true, ids: recus, ecrites: ecrites });
  } catch (err) {
    return reponse({ ok: false, erreur: String(err) });
  } finally {
    verrou.releaseLock();
  }
}

// Ouvrir l'URL /exec dans un navigateur appelle cette fonction : elle dit si le
// script atteint bien le classeur, et combien de fiches porte chaque station.
function doGet() {
  try {
    var classeur = SpreadsheetApp.openById(ID_FEUILLE);
    var feuilles = classeur.getSheets();
    var stations = {};
    for (var i = 0; i < feuilles.length; i++) {
      stations[feuilles[i].getName()] = Math.max(0, feuilles[i].getLastRow() - 1);
    }
    return reponse({ ok: true, classeur: classeur.getName(), stations: stations });
  } catch (err) {
    return reponse({ ok: false, erreur: String(err) });
  }
}
