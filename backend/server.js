const express = require('express');
const cors = require('cors');
const { z } = require('zod');
const { getWeather, fallbackDecision, askGemini } = require('./traffic.server');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const schema = z.object({
  counts: z.object({
    north: z.number().int().min(0),
    east: z.number().int().min(0),
    south: z.number().int().min(0),
    west: z.number().int().min(0),
  }),
  ringCount: z.number().int().min(0),
  avgWait: z.number().min(0),
  maxWait: z.number().min(0),
  threshold: z.number().int().min(1),
  currentGreen: z.enum(["ns", "ew"]),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

app.post('/api/analyze', async (req, res) => {
  try {
    const input = schema.parse(req.body);
    const weather = await getWeather(input.latitude ?? -18.8792, input.longitude ?? 47.5079);
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      const decision = fallbackDecision(input, weather);
      return res.json(decision);
    }

    try {
      const decision = await askGemini(input, weather, apiKey);
      return res.json(decision);
    } catch (error) {
      console.error("Gemini indisponible:", error.message);
      const decision = fallbackDecision(input, weather);
      return res.json(decision);
    }
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Format des données invalide", details: err.errors });
    }
    return res.status(500).json({ error: "Erreur interne serveur" });
  }
});

app.get('/api/test-gemini', async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "GEMINI_API_KEY absente"
      });
    }

    const response = await askGemini(
      {
        counts: {
          north: 10,
          east: 5,
          south: 3,
          west: 2
        },
        ringCount: 20,
        avgWait: 15,
        maxWait: 30,
        threshold: 8,
        currentGreen: "ns"
      },
      null,
      apiKey
    );

    res.json(response);

  } catch (error) {
    console.error("TEST GEMINI :", error);

    res.status(500).json({
      error: error.message
    });
  }
});
app.listen(PORT,"0.0.0.0", () => {
  console.log(`🚀 Backend Smart Traffic en écoute sur http://localhost:${PORT}`);
});