# HydroSync : Saisie terrain hors ligne

Formulaire installable sur un téléphone, fonctionne **sans réseau** et envoie
les fiches dans un tableur Google Drive dès que la connexion revient : 



    index.html            le formulaire
    app.js                saisie, file d'attente, synchronisation, export CSV
    sw.js                 cache hors ligne
    manifest.webmanifest  installation sur l'écran d'accueil
    icone.svg
    apps_script.gs        à coller dans Apps Script, côté Drive
