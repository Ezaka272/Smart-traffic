require("dotenv").config();

const { GoogleGenAI } = require("@google/genai");

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const fetch = require('node-fetch');

const DIRS = ["north", "east", "south", "west"];
const FR = { north: "nord", east: "est", south: "sud", west: "ouest" };
const EN = {
  nord: "north",
  sud: "south",
  est: "east",
  ouest: "west",
  north: "north",
  south: "south",
  east: "east",
  west: "west",
};

async function getWeather(latitude, longitude) {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
      `&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    return {
      temperature: data.current.temperature_2m,
      humidity: data.current.relative_humidity_2m,
      precipitation: data.current.precipitation,
      windSpeed: data.current.wind_speed_10m,
    };
  } catch {
    return null;
  }
}

function fallbackDecision(traffic, weather) {
  const priority = DIRS.reduce((a, b) => (traffic.counts[b] > traffic.counts[a] ? b : a), "north");
  const load = traffic.counts[priority];
  const rain = (weather?.precipitation ?? 0) > 0.2;
  const green = Math.max(10, Math.min(60, Math.round(10 + load * 2.5 + (rain ? 6 : 0))));
  return {
    priority,
    greenDuration: green,
    reason: `Règle locale : ${FR[priority]} est la branche la plus chargée (${load} véhicules)${
      rain ? ", pluie détectée donc temps de dégagement allongé" : ""
    }.`,
    source: "fallback",
    weather,
  };
}

async function askGemini(traffic, weather, apiKey) {
  const prompt = `Tu es le régulateur intelligent d'un carrefour giratoire à Antananarivo.
DONNÉES DU TRAFIC (véhicules en attente par branche) :
${JSON.stringify(traffic, null, 2)}
MÉTÉO ACTUELLE :
${weather ? JSON.stringify(weather, null, 2) : "indisponible"}
RÈGLES :
1. Identifie la branche la plus congestionnée.
2. Le seuil de congestion : ${traffic.threshold} véhicules.
3. Tiens compte du temps d'attente moyen et maximal
4. Tiens compte de l'occupation de l'anneau.
5. Pluie, vent fort ou faible visibilité => allonge légèrement le vert (temps de dégagement).
6. greenDuration est un entier entre 10 et 60 secondes.
7. priority vaut exactement "north", "south", "east" ou "west".
8. reason : une phrase courte en français expliquant la décision.
Réponds UNIQUEMENT avec un objet JSON : {"priority":"...","greenDuration":00,"reason":"..."}`;

  try {
    const response = await ai.models.generateContent({
        model: "google/gemini-2.5-flash",
         contents: prompt,
         config: {
        responseMimeType: "application/json",
      },
    });
    const raw = response.text;

    if (!raw) {
      throw new Error("Réponse Gemini vide");
    }

    console.log("Réponse Gemini :", raw);

    const parsed = JSON.parse(raw);

    const priority = EN[String(parsed.priority ?? "").toLowerCase()];

    if (!priority) {
      throw new Error("Direction invalide renvoyée par Gemini" );
    }

    return {
    priority,
    greenDuration: Math.max(10, Math.min(60, Math.round(Number(parsed.greenDuration) || 20))),
    reason: parsed.reason?.trim() || "Décision Gemini.",
    source: "gemini",
    weather,
  };

  } catch (error) {
    console.error("Erreur Gemini :", error);

  if (error.status === 429) {
    throw new Error("Trop de requêtes Gemini. Réessayez dans un instant.");
  }
  throw new Error("Impossible d'obtenir une décision de Gemini");
  } 
  
}

module.exports = {
  getWeather,
  fallbackDecision,
  askGemini,
};