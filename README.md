# Optimisation du transport universitaire

Test technique MTDI Bénin - plateforme de suivi, de recommandation et de pilotage des bus universitaires.

L'application permet :

1. le suivi des bus en temps réel (carte + tableau) ;
2. la gestion des capacités (places libres, passagers, taux de remplissage) ;
3. l'analyse de chaque arrêt (montées, descentes, attente, temps moyen d'attente) ;
4. l'identification des itinéraires les plus fréquentés ;
5. la recommandation automatique du meilleur bus pour un étudiant ;
6. la détection des heures de pointe / congestions et des actions correctives chiffrées.

Aucun jeu de données n'étant fourni, **les données sont entièrement simulées** par un moteur de simulation (voir la section « Hypothèses »).

---

## Sommaire

1. [Démarrage rapide](#1-démarrage-rapide)
2. [Choix techniques](#2-choix-techniques)
3. [Structure du projet](#3-structure-du-projet)
4. [Hypothèses de simulation](#4-hypothèses-de-simulation)
5. [Comment fonctionne le moteur](#5-comment-fonctionne-le-moteur)
6. [Les cinq cas d'usage](#6-les-cinq-cas-dusage)
7. [Référence de l'API](#7-référence-de-lapi)
8. [Résultats obtenus sur la journée type](#8-résultats-obtenus-sur-la-journée-type)
9. [Tests](#9-tests)
10. [Simplifications assumées](#10-simplifications-assumées)
11. [Pour aller plus loin](#11-pour-aller-plus-loin)
12. [Publier le dépôt et rendre le test](#12-publier-le-dépôt-et-rendre-le-test)

---

## 1. Démarrage rapide

### Prérequis

- **Node.js 18 ou plus récent** (testé avec Node 22) et npm.
- Aucune base de données à installer. Aucun compte, aucune clé d'API.
- Aucun lien externe : Bootstrap et Bootstrap Icons sont installés via npm (les polices d'icônes sont embarquées dans le build).

### Installation

Depuis la racine du projet :

```bash
npm run install:all
```

Cette commande installe les dépendances de la racine, du dossier `server/` et du dossier `client/`.

Si vous préférez le faire à la main :

```bash
npm install
cd server && npm install && cd ..
cd client && npm install && cd ..
```

### Lancement en développement (2 serveurs en même temps)

```bash
npm run dev
```

- API Express : <http://localhost:4000>
- Interface React (Vite) : <http://localhost:5173> - **c'est cette adresse à ouvrir dans le navigateur**.

Vite redirige automatiquement les appels `/api` vers le port 4000 (voir `client/vite.config.js`).

Vous pouvez aussi lancer les deux parties séparément, dans deux terminaux :

```bash
npm --prefix server run dev      # API
npm --prefix client run dev      # interface
```

### Lancement « production » (un seul port)

```bash
npm run build     # compile le front dans client/dist
npm start         # Express sert l'API ET le front sur http://localhost:4000
```

### Variables d'environnement (facultatives)

| Variable    | Défaut  | Rôle                                                                                   |
| ----------- | ------- | -------------------------------------------------------------------------------------- |
| `PORT`      | `4000`  | Port de l'API                                                                          |
| `SIM_SPEED` | `20`    | Vitesse de la simulation en direct : 20 = 1 s réelle représente 20 s simulées          |
| `SIM_START` | `06:30` | Heure simulée de démarrage de la simulation en direct                                  |
| `SEED`      | `2026`  | Graine aléatoire : même graine = mêmes données (reproductible)                         |

Exemple : `SIM_START=07:30 SIM_SPEED=60 npm start` démarre en pleine heure de pointe, trois fois plus vite.

Sous Windows (PowerShell) : `$env:SIM_START="07:30"; npm start`.

### Que voir en premier ?

1. **Tableau de bord** : indicateurs globaux, carte avec les bus qui bougent, hypothèses de la simulation.
2. **Recommandation** : choisissez une position (ou cliquez sur la carte), une destination, ajustez les pondérations, puis cliquez sur « Recommander un bus ». En bas de page, le bouton « Simuler » traite le cas limite des 200 étudiants.
3. **Optimisation** : heures de pointe, points de congestion et actions correctives chiffrées.

> Astuce : pour voir des bus pleins et des étudiants refusés en direct, lancez avec `SIM_START=07:30`.

---

## 2. Choix techniques

| Élément            | Choix                                   | Pourquoi                                                                                                                                  |
| ------------------ | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Front              | **React 18 + Vite**                     | Framework JS très répandu, démarrage instantané, code lisible (composants + un hook).                                                      |
| Style              | **Bootstrap 5 + Bootstrap Icons (npm)** | Interface propre sans écrire beaucoup de CSS ; installé en local, aucun CDN (fonctionne hors connexion). `styles.css` = quelques couleurs. |
| Carte              | **SVG maison**                          | Pas de fond de carte externe (pas de clé, pas de réseau) : les arrêts et bus sont projetés depuis leurs coordonnées GPS.                  |
| Graphiques         | **Barres HTML/CSS**                     | Aucune librairie de graphiques nécessaire pour ces histogrammes simples.                                                                   |
| Back               | **Node.js + Express**                   | Même langage que le front, API REST simple.                                                                                                |
| Données            | **En mémoire (simulation)**             | Le sujet impose de *générer* un jeu de données ; un moteur de simulation est plus réaliste qu'un fichier figé et évite d'installer une base. |
| Tests              | **`node:test`** (intégré à Node)        | Aucune dépendance de test à installer.                                                                                                     |
| Temps réel         | **Polling toutes les 2 s**              | Simple et fiable pour un prototype. Une évolution vers SSE/WebSocket est décrite dans « Pour aller plus loin ».                            |

Le code est volontairement de niveau intermédiaire : fonctions courtes, commentaires en français, pas de patron de conception compliqué, pas de TypeScript.

---

## 3. Structure du projet

```
transport-universitaire/
├── package.json              scripts globaux (install:all, dev, build, start, test)
├── README.md
├── server/
│   ├── package.json
│   ├── scripts/bench.js      mesure du temps d'une recommandation
│   ├── tests/                tests automatiques (node:test)
│   └── src/
│       ├── index.js          démarrage Express
│       ├── config.js         paramètres (vitesse simulation, poids du score, seuils d'analyse)
│       ├── routes/api.js     routes REST
│       ├── data/             données de départ : arrêts, lignes, profil horaire, trafic
│       ├── lib/              outils : distance GPS, aléatoire avec graine, heures
│       ├── simulation/
│       │   ├── network.js    construit le réseau (distances entre arrêts...)
│       │   ├── engine.js     moteur : bus, étudiants, montées/descentes, statistiques
│       │   └── simulator.js  gère la journée « historique » et la simulation « en direct »
│       └── services/
│           ├── fleetService.js           cas 1 : capacité
│           ├── stopsService.js           cas 2 : arrêts
│           ├── analyticsService.js       cas 3 et 5 : top itinéraires, optimisation
│           ├── recommendationService.js  cas 4 : score, réservations, cas des 200 étudiants
│           └── networkService.js         réseau, hypothèses, indicateurs du tableau de bord
└── client/
    ├── package.json
    ├── vite.config.js
    └── src/
        ├── main.jsx          importe Bootstrap + icônes (npm)
        ├── App.jsx           en-tête, onglets, horloge
        ├── api.js            appels vers l'API
        ├── styles.css        couleurs simples
        ├── hooks/usePolling.js
        ├── components/       KpiCard, FillBar, BarChart, MapView (SVG)...
        └── pages/            Dashboard, Buses, Stops, Routes, Recommendation, Optimization
```

---

## 4. Hypothèses de simulation

Le réalisme des hypothèses fait partie de l'évaluation : voici toutes celles qui ont été retenues (elles sont aussi affichées dans le tableau de bord).

> Les coordonnées GPS sont des **approximations** de la zone Abomey-Calavi / Cotonou, pas des relevés officiels. Le choix des lignes est fictif.

### Réseau

- **16 arrêts** répartis entre Abomey-Calavi et Cotonou (Calavi Centre, Togba, ENEAM, UAC Campus, Godomey, Zogbo, Agla, Fidjrossè, Cadjèhoun, Stade de l'Amitié, Campus Cotonou, Jéricho, Étoile Rouge, Dantokpa, Ganhi, Akpakpa).
- Chaque arrêt a un type (résidence, carrefour, campus), une popularité (poids dans la génération de la demande) et une distance de marche moyenne des étudiants.
- **6 lignes**, **20 bus**, **1 170 places** au total. Par convention, le dernier arrêt de chaque ligne est le pôle universitaire.

| Ligne | Itinéraire                            | Arrêts | Longueur | Bus × places | Aller-retour | Fréquence (par sens) | Étudiants / jour |
| ----- | ------------------------------------- | ------ | -------- | ------------ | ------------ | -------------------- | ---------------- |
| L1    | Calavi → ENEAM → UAC                  | 4      | 7,1 km   | 3 × 60       | ~41 min      | ~14 min              | 2 500            |
| L2    | Akpakpa → Godomey → UAC               | 7      | 20,8 km  | 6 × 60       | ~108 min     | ~18 min              | 2 000            |
| L3    | Fidjrossè → Godomey → UAC             | 5      | 15,7 km  | 4 × 60       | ~82 min      | ~20 min              | 1 500            |
| L4    | Dantokpa → Cadjèhoun → Campus Cotonou | 4      | 9,6 km   | 3 × 60       | ~52 min      | ~17 min              | 1 300            |
| L5    | Agla → Campus Cotonou                 | 3      | 4,7 km   | 1 × 30       | ~28 min      | ~28 min              | 220              |
| L6    | Calavi → Cadjèhoun → Campus Cotonou   | 5      | 20,1 km  | 3 × 60       | ~102 min     | ~34 min              | 1 000            |

Au total : **environ 8 520 déplacements d'étudiants par jour**, service de 05h00 à 21h00.

La ligne L1 (2 500 étudiants/jour) reprend l'exemple de l'énoncé. La ligne L5 est volontairement sous-utilisée pour tester la détection des lignes à fusionner.

### Distances et vitesses

- Distance entre deux arrêts = distance à vol d'oiseau (Haversine) × **1,3** (détour routier).
- Vitesse moyenne des bus selon l'heure : 32 km/h à 5h, **15-16 km/h aux heures de pointe** (7-8h et 17-18h), 20 km/h vers midi et à 16h, entre 22 et 30 km/h le reste de la journée.
- Temps d'arrêt : 25 s + 1,5 s par passager qui monte ou descend (180 s maximum) ; pause de 2 min au terminus.
- Marche à pied : 4,5 km/h, avec un coefficient de détour de 1,25.

### Profil horaire de la demande

| Heure | 5h | 6h | **7h** | **8h** | 9h | 10h | 11h | 12h | 13h | 14h | 15h | 16h | **17h** | 18h | 19h | 20h |
| ----- | -- | -- | ------ | ------ | -- | --- | --- | --- | --- | --- | --- | --- | ------- | --- | --- | --- |
| Part  | 2 % | 7 % | 14 % | 13 % | 6 % | 4 % | 5 % | 7 % | 6 % | 5 % | 5 % | 6 % | 8 % | 6 % | 3 % | 2 % |

(Les parts sont normalisées pour faire 100 %.) On retrouve une pointe forte le matin, une petite pointe à midi et une pointe le soir.

**Sens des trajets** : le matin, 85 à 90 % des étudiants vont vers le campus ; le soir, seulement 12 à 20 %. Cette asymétrie est la principale cause de saturation : les bus sont pleins dans un sens et presque vides dans l'autre.

### Génération des étudiants

- À chaque pas de 10 s simulées, le nombre de nouveaux étudiants par ligne suit une **loi de Poisson** dont la moyenne dépend de la demande journalière de la ligne et de l'heure.
- Le couple (arrêt de départ, arrêt d'arrivée) est tiré au hasard, pondéré par la popularité des arrêts (x3 si la destination est un campus).
- La distance de marche de l'étudiant jusqu'à son arrêt suit une loi exponentielle autour de la moyenne de l'arrêt (max. 2,5 km).
- Tout est piloté par un générateur avec **graine** : mêmes paramètres = mêmes résultats.

---

## 5. Comment fonctionne le moteur

Le fichier `server/src/simulation/engine.js` contient la classe `Engine`. À chaque pas de 10 secondes simulées :

1. des étudiants apparaissent aux arrêts (loi de Poisson) ;
2. chaque bus avance (ou reste à l'arrêt) selon la vitesse de l'heure ;
3. quand un bus arrive à un arrêt :
   - les passagers dont c'est la destination **descendent** ;
   - au terminus, le bus **fait demi-tour** (les bus font des allers-retours) ;
   - les étudiants qui avaient **réservé** une place montent en priorité ;
   - les étudiants en attente **de cette ligne et dans ce sens** montent tant qu'il reste de la place, dans l'ordre d'arrivée ;
   - ceux qui restent sont comptés comme « restés à quai » (une seule fois par étudiant) ;
4. les statistiques sont mises à jour (par arrêt, par ligne, par heure).

Le serveur utilise **deux simulations** :

- **`history`** : une journée complète (5h → 21h) calculée au démarrage en une fraction de seconde. Elle alimente les analyses (top 5, heures de pointe, optimisation) qui ont besoin d'une journée entière ;
- **`live`** : une seconde simulation qui tourne en continu (x20 par défaut, démarrage à 06h30 après un « échauffement » depuis 05h). Elle alimente les écrans temps réel (bus, arrêts, recommandation, carte). À la fin du service, une nouvelle journée démarre.

Les écrans « Top itinéraires » et « Optimisation » permettent de basculer entre *Journée type (complète)* et *Aujourd'hui (en cours)*.

---

## 6. Les cinq cas d'usage

### Cas d'usage 1 - Gestion de capacité (page « Bus et capacité »)

Pour chaque bus : places disponibles, passagers, taux de remplissage.

```
taux de remplissage = (nombre_passagers / capacité) × 100
places restantes    = capacité − nombre_passagers
```

Exemple de l'énoncé : Bus A, 45 passagers, capacité 60 → 75 % et 15 places restantes (vérifié par un test automatique, `server/tests/capacity.test.js`).

Codes couleur : vert < 60 %, orange de 60 à 90 %, rouge ≥ 90 %.

### Cas d'usage 2 - Analyse des arrêts (page « Arrêts »)

Pour chaque arrêt : étudiants **en attente** (maintenant), **montées** et **descentes** (cumul depuis 05h00), étudiants **restés à quai**, **temps moyen d'attente**, et les derniers passages en clair, par exemple :

> `Bus 3 (L1) : 8 monté(s), 2 descendu(s), 7 reste(nt) à quai` - c'est exactement l'exemple « 15 en attente, 8 embarquent, 7 restent ».

Le temps moyen d'attente est celui des étudiants déjà montés dans un bus (arrivée à l'arrêt → montée). « Restés à quai » compte les étudiants qui ont vu partir au moins un bus plein.

### Cas d'usage 3 - Itinéraires les plus fréquentés (page « Top itinéraires »)

Top 5 des lignes classées par nombre d'étudiants transportés, avec deux mesures de saturation :

- **Taux de saturation (pointe)** : charge maximale observée sur une heure, dans le sens le plus chargé = `passagers-km / places-km`. C'est l'indicateur qui montre si la ligne « craque » ;
- **Remplissage moyen** : même calcul sur toute la journée et les deux sens (il est bas car les bus reviennent presque vides et roulent toute la journée : c'est aussi un constat utile pour l'optimisation).

Un histogramme montre les étudiants transportés par heure, avec les heures de pointe en rouge.

### Cas d'usage 4 - Recommandation intelligente (page « Recommandation »)

#### Principe

1. On retient les arrêts à **moins de 1,5 km** de l'étudiant (distance de marche estimée).
2. Pour chaque bus dont la ligne dessert à la fois l'arrêt et la destination **dans le bon sens**, on calcule, à partir des trajectoires prévues :
   - l'**heure d'arrivée du bus à l'arrêt** (on ne garde que les passages que l'étudiant a le temps d'atteindre à pied) ;
   - les **places libres prévues à ce moment-là** = passagers actuels − ceux qui seront descendus avant − places déjà réservées ;
   - la **distance de marche** jusqu'à l'arrêt ;
   - le **temps total** jusqu'à la destination.
3. On note chaque option avec la fonction de score ci-dessous. Les 2 prochains passages de chaque bus sont étudiés : si le premier est plein, le suivant peut être proposé.
4. Un bus **sans place libre** n'est jamais recommandé (il apparaît « complet » dans les autres options).

#### Fonction de score

Chaque critère est ramené entre 0 (mauvais) et 1 (excellent), puis on fait la somme pondérée. Résultat final entre 0 et 100.

```
note_attente = 1 − min(attente_bus_min / 30, 1)
note_places  = min(places_libres / 8, 1)
note_marche  = 1 − min(distance_marche_km / 1,5, 1)
note_trajet  = 1 − min(temps_total_min / 90, 1)

score = 100 × ( w_attente × note_attente
              + w_places  × note_places
              + w_marche  × note_marche
              + w_trajet  × note_trajet )
```

Les seuils (30 min, 8 places, 1,5 km, 90 min) et les pondérations sont dans `server/src/config.js` (`recommendationParams`) et **paramétrables à chaque appel** : sliders dans l'interface, champ `weights` dans l'API. Les pondérations sont automatiquement ramenées à une somme de 1.

#### Pondérations par défaut et justification

| Critère                 | Poids  | Justification                                                                                                                                                                                                 |
| ----------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Temps d'arrivée du bus  | **35 %** | Le temps d'attente est en général perçu comme plus pénible que le temps passé dans le véhicule, et il est incertain (bus en retard, arrêt sans abri). C'est le critère qui sépare le mieux deux options.     |
| Temps total du trajet   | **30 %** | C'est le résultat final pour l'étudiant (arriver à l'heure en cours). Attente + trajet représentent donc 65 % du score : le système optimise d'abord le temps de l'étudiant.                                  |
| Places disponibles      | **20 %** | Les places ne comptent que jusqu'à un certain seuil : au-delà de 8 places libres, l'étudiant monte de toute façon, donc la note est plafonnée à 1. Le vrai risque (bus plein) est traité par l'exclusion à 0 place et par les réservations. |
| Distance jusqu'à l'arrêt | **15 %** | C'est un coût fixe, mais l'étudiant a déjà été filtré à moins de 1,5 km ; on évite qu'une marche un peu plus courte l'emporte sur un bus beaucoup plus rapide.                                                  |

Ce choix est une hypothèse de départ : sans données de terrain (voir « Données manquantes »), on ne peut pas la calibrer. C'est pour cela que les poids sont modifiables. Le score compte volontairement l'attente deux fois (dans « attente » et dans « temps total ») : c'est un choix assumé pour privilégier le temps.

#### Exemple de l'énoncé

Bus A arrive dans 2 min avec 8 places libres, Bus B dans 4 min avec 35 places libres (marche identique de 300 m, trajet total 20 min pour A et 22 min pour B) :

| Critère (poids)  | Bus A                    | Bus B                     |
| ---------------- | ------------------------ | ------------------------- |
| Attente (35 %)   | 0,93 → 32,7 points       | 0,87 → 30,3 points        |
| Places (20 %)    | 1,00 → 20,0 (8 places = plafond) | 1,00 → 20,0        |
| Marche (15 %)    | 0,80 → 12,0              | 0,80 → 12,0               |
| Trajet (30 %)    | 0,78 → 23,3              | 0,76 → 22,7               |
| **Score**        | **88,0**                 | **85,0**                  |

**Bus A est recommandé**, comme dans l'énoncé (test automatique dans `recommendation.test.js`). Si l'on augmente le poids des places (ex. 60 %), Bus B peut passer devant : c'est le rôle des pondérations.

#### Cas limite : 200 étudiants reçoivent la même recommandation

Sans précaution, tous les étudiants voient le même « meilleur bus » et 200 personnes se présentent pour 60 places.

**Solution retenue : réservation provisoire de places (« hold »).**

1. Quand un étudiant accepte la recommandation (case « Réserver provisoirement une place », champ `hold: true` dans l'API), une place est réservée sur le bus pour la durée d'arrivée du bus + 5 minutes.
2. Les places réservées sont **retirées des places libres** dans le calcul des recommandations suivantes. Dès que le bus « est plein » sur le papier, l'étudiant suivant reçoit le bus d'après, ou le prochain passage du même bus.
3. Quand le bus arrive à l'arrêt, les étudiants qui ont réservé montent en priorité ; les réservations non honorées expirent toutes seules.
4. Si **aucun** bus n'a de place, le système le dit clairement (« tous les bus sont complets, prochain passage dans X min ») et calcule le nombre de bus supplémentaires nécessaires. Ce chiffre alimente aussi l'écran d'optimisation.

**Démonstration** : dans la page « Recommandation », le bouton **Simuler** lance N étudiants (200 par défaut) qui demandent la même recommandation au même endroit, d'abord sans réservation, puis avec. Exemple obtenu peu après le démarrage (Togba → UAC Campus, 200 étudiants) :

| Mode                | Bus utilisés | Étudiants envoyés vers un bus sans place | Sans solution |
| ------------------- | ------------ | ---------------------------------------- | ------------- |
| Sans réservation    | 1            | **140** (200 étudiants pour 60 places)   | 0             |
| Avec réservation    | 4 passages   | **0**                                    | 0             |

Autres mesures possibles (non implémentées, décrites dans « Pour aller plus loin ») : limitation du nombre de requêtes, léger étalement aléatoire entre deux options au score très proche, notifications quand un bus se remplit.

### Cas d'usage 5 - Optimisation d'itinéraire (page « Optimisation »)

**Détection** (à partir de la journée type ou de la journée en cours) :

- **Zones les plus fréquentées** : arrêts classés par montées + descentes, avec leur part du trafic ;
- **Heures de pointe** : les heures où la demande dépasse **125 % de la moyenne horaire** (mesurée sur les étudiants qui arrivent aux arrêts, pas sur les montées, qui sont retardées quand les bus sont pleins). Les heures consécutives sont regroupées en plages ;
- **Points de congestion** : arrêts où au moins **10 %** des étudiants ont vu passer un bus plein, ou dont l'attente moyenne dépasse 8 minutes.

**Actions correctives** - chacune est accompagnée d'indicateurs chiffrés calculés sur les données :

| Action                    | Règle de déclenchement                                                                                                          | Indicateurs affichés                                                                             |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| **Modification d'horaires** | Ligne saturée en pointe (≥ 75 % dans le sens fort) avec des étudiants refusés **et** des heures creuses à moins de 30 % : on propose de basculer des bus vers la pointe | Remplissage creux / pointe, bus actuels, bus à garder en creux, bus basculés |
| **Ajout de bus**          | Même situation : on calcule le nombre de bus manquants (étudiants refusés ÷ places offertes par bus et par heure) ; on ajoute seulement ce que la modification d'horaires ne couvre pas | Remplissage max, étudiants refusés, bus manquants, places/h ajoutées par bus, refus estimés avant → après |
| **Nouvel arrêt**          | Deux arrêts consécutifs distants de plus de 3 km, dont un arrêt voisin a au moins 20 % d'étudiants qui marchent plus d'1 km, et aucun arrêt existant à moins de 1 km du point proposé | Distance sans arrêt, % de marcheurs > 1 km, montées quotidiennes, coordonnées proposées |
| **Fusion de lignes**      | Ligne dont le remplissage journalier est inférieur à 10 %, avec au moins 50 % d'arrêts en commun avec une autre ligne         | Remplissage des deux lignes, % d'arrêts communs, étudiants à reporter, bus libérés               |

Le nombre de bus « à garder en heures creuses » respecte deux contraintes : un remplissage cible de 60 % **et** un bus au moins toutes les 30 minutes (sinon on proposerait de retirer presque tous les bus des longues lignes).

Les actions sont classées par priorité (haute / moyenne / basse) selon un indice de gravité calculé à partir des refus, du remplissage et des écarts.

---

## 7. Référence de l'API

Toutes les réponses sont en JSON. Les routes marquées « source » acceptent `?source=history` (journée complète, par défaut) ou `?source=live` (journée en cours).

| Méthode | Route                                | Description                                                                             |
| ------- | ------------------------------------ | --------------------------------------------------------------------------------------- |
| GET     | `/api/health`                        | Vérifie que le serveur répond                                                           |
| GET     | `/api/clock`                         | Heure simulée, vitesse, numéro du jour                                                  |
| GET     | `/api/network`                       | Arrêts et lignes (pour la carte)                                                        |
| GET     | `/api/assumptions`                   | Hypothèses de la simulation (lignes, fréquences, profil horaire)                        |
| GET     | `/api/overview`                      | Indicateurs globaux en direct                                                           |
| GET     | `/api/buses`                         | **Cas 1** : chaque bus (passagers, places libres, taux, position, prochain arrêt)       |
| GET     | `/api/stops`                         | **Cas 2** : chaque arrêt (attente, montées, descentes, restés à quai, temps d'attente)  |
| GET     | `/api/routes/top?limit=5&source=`    | **Cas 3** : top des itinéraires + demande par heure                                     |
| GET     | `/api/analytics/optimization?source=`| **Cas 5** : pointes, zones, congestion, actions correctives                             |
| GET     | `/api/recommendations/config`        | Paramètres et pondérations par défaut de la recommandation                              |
| POST    | `/api/recommendations`               | **Cas 4** : recommandation                                                              |
| POST    | `/api/recommendations/crowd`         | **Cas 4** : simulation de N étudiants simultanés                                        |

### Exemple : recommandation

```bash
curl -X POST http://localhost:4000/api/recommendations \
  -H "Content-Type: application/json" \
  -d '{
        "lat": 6.436, "lon": 2.335,
        "destinationStopId": "uac",
        "weights": { "eta": 35, "seats": 20, "walk": 15, "total": 30 },
        "hold": true
      }'
```

Réponse (abrégée) :

```json
{
  "weights": { "eta": 0.35, "seats": 0.2, "walk": 0.15, "total": 0.3 },
  "best": {
    "bus": { "id": "BUS-02", "name": "Bus 2", "capacity": 60 },
    "route": { "id": "L1", "name": "Calavi → ENEAM → UAC" },
    "boardStop": { "id": "togba", "name": "Togba" },
    "etaMin": 15.5, "walkMeters": 588, "freeSeats": 60, "totalMin": 23.6,
    "score": 68.2
  },
  "alternatives": [ ... ],
  "hold": { "id": 1, "validMin": 20.5 },
  "message": "Bus 2 (L1) arrive à « Togba » dans 15.5 min, 60 place(s) libre(s), ..."
}
```

Les identifiants d'arrêts sont ceux de `GET /api/network` (`calavi`, `togba`, `eneam`, `uac`, `godomey`, `zogbo`, `agla`, `fidjrosse`, `cadjehoun`, `stade`, `campus-cotonou`, `jericho`, `etoile-rouge`, `dantokpa`, `ganhi`, `akpakpa`).

### Exemple : 200 étudiants simultanés

```bash
curl -X POST http://localhost:4000/api/recommendations/crowd \
  -H "Content-Type: application/json" \
  -d '{ "lat": 6.436, "lon": 2.335, "destinationStopId": "uac", "count": 200 }'
```

Cette route travaille sur une copie temporaire des réservations : elle ne laisse aucune réservation active après l'appel.

---

## 8. Résultats obtenus sur la journée type

Résultats avec la graine par défaut (`SEED=2026`) - ils sont reproductibles.

**Top 5 des itinéraires (journée complète)**

| #  | Ligne | Étudiants transportés | Saturation en pointe (sens fort) | Remplissage moyen | Étudiants ayant vu un bus plein |
| -- | ----- | --------------------- | -------------------------------- | ----------------- | ------------------------------- |
| 1  | L1    | 2 444                 | 92,7 % (à 8h)                    | 17,7 %            | 303                             |
| 2  | L2    | 2 032                 | 87,4 % (à 8h)                    | 19,9 %            | 118                             |
| 3  | L3    | 1 568                 | 90,8 % (à 8h)                    | 18,9 %            | 111                             |
| 4  | L4    | 1 299                 | 68,6 % (à 8h)                    | 12,6 %            | 0                               |
| 5  | L6    | 997                   | 75,1 % (à 8h)                    | 17,0 %            | 39                              |

Total : 8 563 étudiants transportés (dont 223 sur L5, hors top 5).

**Constats** :

- Heures de pointe détectées : **07h-09h** et **17h-18h** ;
- Zones les plus fréquentées : UAC Campus (23,8 % du trafic), ENEAM, Campus Cotonou ;
- Points de congestion : Togba (32,8 % des étudiants ont vu passer un bus plein), Zogbo (21,6 %), Stade de l'Amitié (17,6 %) ;
- Les lignes sont saturées à 87-93 % en pointe dans le sens vers le campus, mais **remplies à moins de 20 % en moyenne sur la journée** : le problème n'est pas le nombre total de bus mais leur répartition dans le temps ;
- Actions proposées : basculer/ajouter des bus sur L1, L2, L3 (et ajouter 1 bus sur L6), créer des arrêts (Zogbo–Godomey, Stade–Godomey, Calavi–Togba), fusionner L5 dans L4.

---

## 9. Tests

```bash
npm test
```

Lance 19 tests automatiques (`server/tests/`) :

- **géographie** : distance de Haversine, temps de marche ;
- **capacité** : exemple 45/60 = 75 % de l'énoncé, places libres = capacité − passagers ;
- **moteur** : un bus ne dépasse jamais sa capacité pendant toute une journée, conservation des étudiants (apparus = montés + en attente), reproductibilité avec la même graine ;
- **recommandation** : normalisation des poids, exemple Bus A / Bus B de l'énoncé, effet des places libres, erreur 400 si destination inconnue, réservation qui retire une place, **cas des 200 étudiants** (sans réservation : surcharge ; avec réservation : zéro surcharge et aucune réservation résiduelle) ;
- **analyses** : top 5 trié, chaque arrêt expose ses indicateurs, chaque action est appuyée par au moins 3 indicateurs chiffrés.

Mesure de performance (ordre de grandeur) :

```bash
npm --prefix server run bench
```

Sur la flotte simulée de 20 bus, une recommandation prend de l'ordre de **0,07 ms** (0,03 ms avec un cache des trajectoires) sur une machine de développement. Ces valeurs dépendent de la machine ; elles servent à raisonner sur le passage à l'échelle (section 11).

---

## 10. Simplifications assumées

- **Trajets directs uniquement** : la recommandation ne gère pas les correspondances (changer de ligne). L'étudiant doit avoir une ligne qui relie un arrêt proche à sa destination.
- **Vitesse constante par heure** dans les prévisions d'arrivée (pas de retard aléatoire, pas d'incident).
- **Places libres prévues** = passagers actuels − descentes prévues − réservations. On ne prévoit pas les futures montées d'autres étudiants avant l'arrêt de l'étudiant (estimation prudente sur le nombre de places, mais elle peut être optimiste si beaucoup d'étudiants montent avant lui).
- **Un étudiant = une ligne** : chaque étudiant simulé attend un bus d'une ligne précise (il ne choisit pas entre L1 et L2 pour aller à l'UAC). Cela simplifie les files d'attente.
- **Réservations = passagers virtuels** : les étudiants qui réservent via l'application s'ajoutent aux étudiants simulés ; ils montent en priorité quand le bus arrive à leur arrêt, mais ne sont pas comptés dans les statistiques de montées/descentes.
- **Pas de base de données** : l'état est en mémoire, remis à zéro à chaque redémarrage (la journée type est régénérée à l'identique grâce à la graine).
- **Pas d'authentification** ni de comptes étudiants.
- **Actions d'optimisation approximatives** : les nombres de bus proposés sont des ordres de grandeur (les refus sont supposés absorbables par des places supplémentaires dans le sens de pointe) ; ils servent à prioriser, pas à dimensionner définitivement.

---

## 11. Pour aller plus loin

### Recul sur mes choix

Ce que je ferais différemment dès le départ, en sachant ce que je sais maintenant :

1. **Modéliser dès le début les correspondances** (un graphe arrêts/lignes) plutôt qu'un modèle « une ligne = un étudiant ». J'ai choisi des lignes indépendantes pour tenir dans le temps ; c'est la simplification qui limite le plus la recommandation (un étudiant qui pourrait faire L1 + L3 n'a aucune proposition).
2. **Séparer plus tôt le moteur de simulation de l'API** : aujourd'hui `Engine` sert à la fois de « source de vérité » et de simulateur. Avec des vrais GPS, il faudrait un composant « état de la flotte » alimenté par des événements (GPS, comptage), que le simulateur ne ferait qu'imiter. Je l'aurais isolé derrière une petite interface dès le début.
3. **Écrire les tests de propriétés du simulateur avant les services** : les invariants (capacité jamais dépassée, conservation des étudiants) m'ont fait gagner du temps ; j'aurais dû les écrire en premier.
4. **Utiliser un vrai routage** (OSRM ou GraphHopper avec OpenStreetMap) plutôt qu'un coefficient de détour de 1,3.

### Dette technique acceptée volontairement

Par ordre de gravité décroissante :

1. **État en mémoire, un seul processus** : pas de persistance, pas de haute disponibilité. Accepté pour un prototype de 72 h.
2. **Polling toutes les 2 s** côté front au lieu de SSE/WebSocket : simple, mais coûteux à grande échelle (voir plus bas).
3. **Vitesse et durée d'arrêt fixes** dans les prévisions d'arrivée : pas d'apprentissage sur l'historique.
4. **Seuils d'analyse et pondérations « à dire d'expert »** (fichier `config.js`) : non calibrés sur des données réelles.
5. **Pas d'authentification, pas de limitation de débit** sur l'API.
6. **Pas de tests côté front** (les tests couvrent le serveur : moteur, recommandation, analyses).
7. **Carte SVG schématique** au lieu d'une vraie carte (pas de tuiles, pas de tracé routier réel).

### Passage à l'échelle : 50 000 étudiants, 300 bus, heure de pointe

Ce qui a été **mesuré** : une recommandation coûte environ 0,07 ms de calcul pour 20 bus (`npm --prefix server run bench`). Le coût dépend des bus des lignes concernées, pas de la flotte entière ; avec 300 bus sur environ 40 lignes, on reste dans quelques dixièmes de milliseconde par requête. Ce qui est **estimé** (ordre de grandeur, à valider par un test de charge) :

- **Recommandations** : si 30 % des étudiants ouvrent l'application dans un créneau de 15 minutes, cela fait environ 17 requêtes/s en moyenne, quelques centaines en pic. Un seul processus Node tient ce débit : **ce n'est pas ce qui casse en premier**.
- **GPS** : 300 bus qui envoient une position toutes les 5 s = 60 messages/s. Négligeable.

**Ce qui casserait en premier** :

1. **Le polling des écrans temps réel.** Si 10 000 étudiants gardent l'écran ouvert avec un rafraîchissement toutes les 2 s, on obtient 5 000 requêtes/s, chacune recalculant et sérialisant l'état de toute la flotte (environ 350 octets par bus mesurés, soit ~105 Ko pour 300 bus, à multiplier par le nombre de requêtes par seconde). Réponse : **SSE/WebSocket** avec des données filtrées par client (uniquement les bus des lignes proches de l'étudiant), et un **instantané de la flotte mis en cache** 1-2 s (et servi par un CDN pour les endpoints publics).
2. **L'état en mémoire d'un seul processus** : impossible de répartir la charge sur plusieurs instances, et les réservations (holds) seraient perdues au redémarrage. Réponse : **Redis** (réservations avec TTL, décrément atomique du nombre de places pour éviter deux réservations sur la dernière place), file de messages pour les positions GPS.
3. **L'historique et les analyses** : recalculer les statistiques depuis la simulation ne tient plus avec de vraies données. Réponse : **PostgreSQL + PostGIS** (positions, arrêts, distances) avec des agrégats horaires précalculés (vues matérialisées) ; TimescaleDB si le volume d'historique GPS le justifie.
4. **La qualité de la prévision** avant la performance : avec de vrais bus, les ETA basés sur une vitesse constante seront fausses. Il faudra des ETA appris sur l'historique par tronçon et par heure.

### Données manquantes

Ce que je demanderais au terrain et la décision que cela permettrait :

| Donnée                                                                       | Décision qu'elle permet de prendre                                                                         |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **Comptages réels de montées/descentes** par arrêt et par bus (capteurs ou comptage manuel sur une semaine) | Valider (ou corriger) le profil horaire et les 8 500 déplacements ; dire où ajouter un bus avec des vrais chiffres |
| **Positions GPS réelles** des bus et temps de parcours par tronçon et par heure | Remplacer les vitesses fixes par de vraies ETA, mesurer la ponctualité                                        |
| **Origine-destination des étudiants** (adresse de résidence par quartier, emploi du temps par faculté) | Décider de **nouvelles lignes ou de nouveaux arrêts** (aujourd'hui je peux seulement proposer un point au milieu d'un tronçon) et mesurer les correspondances utiles |
| **Emploi du temps des cours** (heures de début/fin par faculté)              | Anticiper les pointes et décaler des horaires de cours ou de bus plutôt que d'ajouter des bus                  |
| **Refus et abandons réels** (étudiants qui renoncent ou prennent un taxi-moto) | Mesurer la demande non servie, aujourd'hui invisible ; dimensionner la flotte par le besoin réel             |
| **Contraintes d'exploitation** (nombre de chauffeurs, pauses, entretien, coût au km) | Savoir si « basculer 2 bus vers la pointe » est faisable en pratique et ce que cela coûte                    |
| **Comportement face à la recommandation** (acceptation, écart entre prévu et réel) | Calibrer les pondérations du score au lieu de les fixer à dire d'expert                                        |

### Mise en production : première itération avec de vrais étudiants et de vrais chauffeurs

Objectif de la première itération : **prouver la valeur sur une seule ligne, avec des données réelles, avant de généraliser.**

1. **Choisir la ligne pilote** : la plus saturée (dans mon jeu de données : L1). 3 bus, une pointe du matin, un seul campus : facile à observer.
2. **Côté chauffeurs** : une application très simple (ou un simple téléphone Android avec l'application en mode « conducteur ») qui envoie le GPS toutes les 5 s et permet de taper « +1 / −1 » ou de saisir le nombre de passagers à chaque arrêt. Pas de nouvelle procédure compliquée : on démarre avec le comptage manuel, plus fiable qu'un capteur qui tombe en panne. Une journée de formation et un référent par bus.
3. **Côté étudiants** : une page web mobile (pas d'installation, adaptée aux réseaux faibles, sans fond de carte lourd) affichant les prochains bus à l'arrêt choisi, leur remplissage (« places disponibles / bus presque plein / complet ») et la recommandation. Réservation activée seulement quand la fiabilité des données le permet.
4. **Mesurer avant/après** : attente moyenne, étudiants laissés à quai, taux de remplissage en pointe et en creux, écart entre l'heure d'arrivée prévue et réelle. Ces mesures répondent à l'objectif du sujet (moins de bus sous-utilisés, moins d'étudiants à quai).
5. **Garde-fous** : mode dégradé si le GPS d'un bus est silencieux depuis plus de 60 s (le bus n'est plus recommandé) ; message clair « estimation » plutôt qu'une fausse précision ; accès à l'application possible sans compte pour la première itération ; journalisation des recommandations pour comprendre les écarts.
6. **Retour d'expérience** : une réunion hebdomadaire avec les chauffeurs et un échantillon d'étudiants ; recalibrage des pondérations après deux semaines de données ; extension aux lignes L2 et L3 seulement si les indicateurs s'améliorent.

---

## 12. Publier le dépôt et rendre le test

```bash
git init
git add .
git commit -m "Test technique transport universitaire"
git branch -M main
git remote add origin <URL de votre dépôt GitHub ou GitLab>
git push -u origin main
```

Conseil : l'énoncé précise « Nous regardons comment vous travaillez ». Plutôt qu'un seul commit, faites plusieurs commits logiques, par exemple :

1. `feat(server): données simulées et moteur de simulation`
2. `feat(server): services capacité, arrêts et top itinéraires`
3. `feat(server): recommandation, réservations et cas des 200 étudiants`
4. `feat(server): détection et actions d'optimisation`
5. `test(server): tests automatiques`
6. `feat(client): interface React + Bootstrap`
7. `docs: README`

Envoi du lien par courriel à `atchokpodo@gouv.bj` et `kdegila@gouv.bj`, avec l'objet :

```
Test technique - Transport universitaire - [Nom Prénom]
```

(Si le dépôt est privé, pensez à donner l'accès aux deux destinataires.)
