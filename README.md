# 🚦 Smart Traffic — Simulation & Régulation IA de Carrefour Giratoire

Smart Traffic est une solution hybride (Front-end HTML5 Canvas + Back-end Node.js) simulant un rond-point à 4 branches avec feux tricolores adaptatifs. Le système intègre **Google Gemini 2.5 Flash** et des météos en temps réel (**Open-Meteo API**) pour réguler la circulation et fluidifier le trafic lors de congestions.

---

## 📸 Aperçu des Fonctionnalités

- **Moteur de Simulation Physico-géométrique :** Calculs de trajectoires, priorités dans l'anneau, accélérations, distances de sécurité et feux tricolores dynamiques.
- **Arbitrage Intelligente par IA (Gemini) :** Analyse du nombre de véhicules en attente, des temps d'attente max/moyen et des conditions météo (pluie, vent) pour accorder des phases de feux verts optimales.
- **Mode Fallback Embarqué :** Algorithme algorithmique local prenant le relais en cas de perte de connexion ou d'absence de clé API.
- **Tableau de Bord interactif :** Contrôle des débits, injection de trafic de test, réglage des seuils et métriques visuelles en temps réel.

---

## 🛠️ Tech Stack

- **Front-end :** HTML5, CSS3 (Variables OKLCH, Modern Layouts), JavaScript ES6+ (Canvas API native).
- **Back-end :** Node.js, Express, Zod (validation de schéma).
- **APIs & IA :** Google Gemini API (Gemini 2.5 Flash), Open-Meteo API (données météo en temps réel).

---

## 📂 Structure du Projet

```text
smart-traffic/
├── frontend/
│   ├── index.html
│   ├── css/
│   │   └── style.css
│   └── js/
│       ├── engine.js      # Moteur physique & mathématique du trafic
│       ├── renderer.js    # Rendu graphique sur Canvas
│       └── app.js         # Gestion UI, contrôles & appels API
└── backend/
    ├── package.json
    ├── server.js          # Serveur Express & validation Zod
    └── traffic.server.js  # Intégration Gemini & météo