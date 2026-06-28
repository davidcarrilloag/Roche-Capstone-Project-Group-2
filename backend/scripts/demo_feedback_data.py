"""Multilingual demo feedback content (no heavy imports — pure data).

Each item carries the same comment in all four supported languages. The seeder
picks an original language per entry (that becomes the stored `message` and
`language`) and keeps the full `t` map as `translations`, so the dashboard's
language switcher can render every comment in the viewer's language while the
row badge still shows the language it was originally written in.

Owner: Analytics & Feedback (Andrea).
"""

from __future__ import annotations

# Weighting for the *original* language of each entry (slight English lean).
ORIG_LANGS = ["en", "en", "de", "de", "fr", "it"]

REASONS = [
    "Wrong information",
    "Source not relevant",
    "Answer too vague",
    "Wrong language",
]

# (topic, sentiment, rating, {lang: comment}) — short, plausible lab feedback.
FEEDBACK_ITEMS = [
    ("Material return", "confused", 2, {
        "en": "What form do I need to send samples back?",
        "de": "Welches Formular brauche ich, um Proben zurückzuschicken?",
        "fr": "De quel formulaire ai-je besoin pour renvoyer des échantillons ?",
        "it": "Di quale modulo ho bisogno per rispedire i campioni?",
    }),
    ("Material return", "satisfied", 5, {
        "en": "Found the return form straight away, thanks.",
        "de": "Habe das Rückgabeformular sofort gefunden, danke.",
        "fr": "J'ai trouvé le formulaire de retour tout de suite, merci.",
        "it": "Ho trovato subito il modulo di reso, grazie.",
    }),
    ("Material return", "frustrated", 1, {
        "en": "The return process does not match the portal.",
        "de": "Der Rückgabeprozess stimmt nicht mit dem Portal überein.",
        "fr": "Le processus de retour ne correspond pas au portail.",
        "it": "Il processo di reso non corrisponde al portale.",
    }),
    ("Lab sharing", "confused", 2, {
        "en": "Can two teams share the fume hood?",
        "de": "Können sich zwei Teams den Abzug teilen?",
        "fr": "Deux équipes peuvent-elles partager la hotte ?",
        "it": "Due team possono condividere la cappa?",
    }),
    ("Lab sharing", "satisfied", 4, {
        "en": "Booking rules were explained clearly.",
        "de": "Die Buchungsregeln wurden klar erklärt.",
        "fr": "Les règles de réservation ont été expliquées clairement.",
        "it": "Le regole di prenotazione sono state spiegate chiaramente.",
    }),
    ("Lab sharing", "negative", 2, {
        "en": "Answer contradicted what my team lead told me.",
        "de": "Die Antwort widersprach dem, was mein Teamleiter mir sagte.",
        "fr": "La réponse contredisait ce que mon chef d'équipe m'a dit.",
        "it": "La risposta contraddiceva ciò che mi ha detto il mio team leader.",
    }),
    ("Onboarding", "confused", 2, {
        "en": "Who approves my safety training?",
        "de": "Wer genehmigt meine Sicherheitsschulung?",
        "fr": "Qui approuve ma formation à la sécurité ?",
        "it": "Chi approva la mia formazione sulla sicurezza?",
    }),
    ("Onboarding", "satisfied", 5, {
        "en": "The onboarding checklist was exactly what I needed.",
        "de": "Die Onboarding-Checkliste war genau das, was ich brauchte.",
        "fr": "La checklist d'intégration était exactement ce qu'il me fallait.",
        "it": "La checklist di onboarding era esattamente ciò di cui avevo bisogno.",
    }),
    ("Onboarding", "frustrated", 1, {
        "en": "This onboarding process is really confusing.",
        "de": "Dieser Onboarding-Prozess ist wirklich verwirrend.",
        "fr": "Ce processus d'intégration est vraiment déroutant.",
        "it": "Questo processo di onboarding è davvero confuso.",
    }),
    ("Building access", "confused", 2, {
        "en": "How do I get weekend access to the lab?",
        "de": "Wie bekomme ich am Wochenende Zugang zum Labor?",
        "fr": "Comment obtenir l'accès au laboratoire le week-end ?",
        "it": "Come ottengo l'accesso al laboratorio nel weekend?",
    }),
    ("Building access", "satisfied", 5, {
        "en": "Badge request was answered perfectly.",
        "de": "Die Badge-Anfrage wurde perfekt beantwortet.",
        "fr": "La demande de badge a reçu une réponse parfaite.",
        "it": "La richiesta del badge ha avuto una risposta perfetta.",
    }),
    ("Building access", "satisfied", 4, {
        "en": "This saved me a trip to the office.",
        "de": "Das hat mir einen Weg ins Büro erspart.",
        "fr": "Cela m'a évité un déplacement au bureau.",
        "it": "Questo mi ha risparmiato un viaggio in ufficio.",
    }),
    ("Device cleaning", "confused", 2, {
        "en": "Which solution should I use for the analyzer surface?",
        "de": "Welche Lösung soll ich für die Oberfläche des Analysegeräts verwenden?",
        "fr": "Quelle solution dois-je utiliser pour la surface de l'analyseur ?",
        "it": "Quale soluzione devo usare per la superficie dell'analizzatore?",
    }),
    ("Device cleaning", "satisfied", 5, {
        "en": "The cleaning steps for the device were spot on.",
        "de": "Die Reinigungsschritte für das Gerät waren genau richtig.",
        "fr": "Les étapes de nettoyage de l'appareil étaient parfaites.",
        "it": "I passaggi di pulizia del dispositivo erano perfetti.",
    }),
    ("Device cleaning", "negative", 1, {
        "en": "It pointed me to the wrong device SOP.",
        "de": "Es hat mich auf die falsche Geräte-SOP verwiesen.",
        "fr": "Cela m'a renvoyé vers la mauvaise SOP de l'appareil.",
        "it": "Mi ha indirizzato alla SOP sbagliata del dispositivo.",
    }),
    ("Calibration", "frustrated", 1, {
        "en": "The calibration drift steps did not work for my unit.",
        "de": "Die Schritte zur Kalibrierungsabweichung funktionierten bei meinem Gerät nicht.",
        "fr": "Les étapes de dérive d'étalonnage n'ont pas fonctionné pour mon appareil.",
        "it": "I passaggi sulla deriva di calibrazione non hanno funzionato per la mia unità.",
    }),
    ("Calibration", "confused", 2, {
        "en": "When is recalibration mandatory versus optional?",
        "de": "Wann ist eine Neukalibrierung verpflichtend und wann optional?",
        "fr": "Quand le réétalonnage est-il obligatoire ou facultatif ?",
        "it": "Quando la ricalibrazione è obbligatoria o facoltativa?",
    }),
    ("Waste disposal", "frustrated", 1, {
        "en": "The waste categories were wrong for solvents.",
        "de": "Die Abfallkategorien waren für Lösungsmittel falsch.",
        "fr": "Les catégories de déchets étaient incorrectes pour les solvants.",
        "it": "Le categorie di rifiuti erano sbagliate per i solventi.",
    }),
    ("Waste disposal", "confused", 2, {
        "en": "Where do biohazard sharps go?",
        "de": "Wohin kommen biogefährliche scharfe Gegenstände?",
        "fr": "Où vont les objets tranchants à risque biologique ?",
        "it": "Dove vanno i taglienti a rischio biologico?",
    }),
    ("Ordering supplies", "satisfied", 5, {
        "en": "The ordering steps matched the new portal.",
        "de": "Die Bestellschritte entsprachen dem neuen Portal.",
        "fr": "Les étapes de commande correspondaient au nouveau portail.",
        "it": "I passaggi per l'ordine corrispondevano al nuovo portale.",
    }),
    ("Ordering supplies", "confused", 2, {
        "en": "How do I order reagents under 500 CHF?",
        "de": "Wie bestelle ich Reagenzien unter 500 CHF?",
        "fr": "Comment commander des réactifs en dessous de 500 CHF ?",
        "it": "Come ordino i reagenti sotto i 500 CHF?",
    }),
    ("Ordering supplies", "neutral", 3, {
        "en": "Fine, though the approval limits were missing.",
        "de": "In Ordnung, aber die Genehmigungsgrenzen fehlten.",
        "fr": "Correct, mais les limites d'approbation manquaient.",
        "it": "Va bene, ma mancavano i limiti di approvazione.",
    }),
]
