import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Google GenAI
// Note: We lazy-initialize or check for API key to avoid crashing if it's missing initially.
let aiClient: GoogleGenAI | null = null;
function getAiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not defined. Please configure it in your AI Studio secrets.");
    }
    aiClient = new GoogleGenAI({ apiKey });
  }
  return aiClient;
}

// REST APIs
app.get("/api/health", (req, res) => {
  res.json({ status: "healthy", time: new Date().toISOString() });
});

// Parse natural-language activity log using Gemini 3.5 Flash
app.post("/api/parse-activity", async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== "string") {
      return res.status(400).json({ error: "Missing required 'text' field in request body" });
    }

    const client = getAiClient();
    
    const prompt = `
You are "EcoTrack AI Carbon Calculator". Parse this short user-logged physical activity statement in English: "${text}".
Estimate the greenhouse gas impact in CO2 equivalent kilograms (kg CO2e) utilizing general scientific averages.
Map the activity STRICTLY to one of these four categories:
- 'transport' (cars, flying, public transit, trains, biking)
- 'food' (meals, beverages, animal agriculture vs plant-based)
- 'energy' (appliances, smart devices, air heaters, HVAC, lights, solar)
- 'shopping' (clothing, new electronics, plastic gadgets, major goods)

Be mathematically reasonable. E.g.:
- Medium car commute: ~0.2-0.4 kg CO2e per km
- A serving of beef: ~5.8 kg CO2e
- A serving of chicken: ~1.4 kg CO2e
- Green solar generation / walking: 0.0 kg CO2e or a small negative credits for recycling.
- Home energy: ~0.4 kg CO2e per kWh

If the statement contains negative physical credits (e.g. "recycled", "composted", "planted a tree"), calculate a native balance or carbon offset credit (e.g., -0.5 kg to -2.0 kg).

Output a valid JSON object matching this schema. Be robust with approximate uncertainty ranges where necessary.
`;

    const response = await client.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT" as any,
          properties: {
            description: { type: "STRING" as any, description: "A clean, nicely-capitalized statement of the activity parsed" },
            category: { type: "STRING" as any, description: "Must be strictly one of: 'transport', 'food', 'energy', 'shopping'" },
            co2eKg: { type: "NUMBER" as any, description: "Your best single estimated carbon weight in kg. Must be a decimal number." },
            range: { type: "STRING" as any, description: "A realistic range representing input uncertainty, e.g., '1.2 - 1.8 kg' or 'approx 5.8 kg'" },
            reasoning: { type: "STRING" as any, description: "A short, crystal-clear 1-sentence description explaining the formula or carbon drivers" }
          },
          required: ["description", "category", "co2eKg", "range", "reasoning"]
        }
      }
    });

    const textOutput = response.text || "{}";
    res.json(JSON.parse(textOutput.trim()));

  } catch (error: any) {
    console.error("Error in parse-activity:", error);
    res.status(500).json({ error: error.message || "Failed to analyze activity" });
  }
});

// Generate highly personalized actions-based tips from logged entries
app.post("/api/insights", async (req, res) => {
  try {
    const { logs, weeklyGoal } = req.body;
    const client = getAiClient();
    
    const prompt = `
You are "EcoTrack AI Sustainability Advisor".
Analyze the user's carbon footprint data over the past week and generate 2-3 highly specific reduction tips.
Their current weekly limit goal is: ${weeklyGoal || 80} kg CO2e.

Recent Carbon Footprint Logs:
${JSON.stringify(logs || [], null, 2)}

Requirements:
- Ensure the tips are personalized to their logged actions, mentioning concrete categories, notes, counts, or categories that dominated.
- DO NOT output generic boilerplate. Use the raw figures directly (e.g. "Your transport logs totaled 24.5 kg CO2e. Shaving off just one 10-mile ride by walking reduces this by X!").
- Calculate some potential savings in kg CO2e for each recommendation.
- Add a tiny, friendly "why this matters" explanation.

Respond with a strictly formatted JSON object matching this schema:
`;

    const response = await client.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT" as any,
          properties: {
            tips: {
              type: "ARRAY" as any,
              items: {
                type: "OBJECT" as any,
                properties: {
                  title: { type: "STRING" as any, description: "Engaging and actionable micro-header" },
                  tip: { type: "STRING" as any, description: "A customized suggestion referring to logs or specific category reduction ratios" },
                  whyMatters: { type: "STRING" as any, description: "Clear explanation of the global carbon absorption physics in friendly language" },
                  estimatedSavings: { type: "NUMBER" as any, description: "Numeric estimated kg of CO2 equivalent saved" }
                },
                required: ["title", "tip", "whyMatters", "estimatedSavings"]
              }
            }
          },
          required: ["tips"]
        }
      }
    });

    res.json(JSON.parse((response.text || "{}").trim()));

  } catch (error: any) {
    console.error("Error generating EcoTrack insights:", error);
    res.status(500).json({ error: error.message || "Failed to generate personalized insights" });
  }
});

// Endpoint to generate "Weekly Carbon Story" via Gemini
app.post("/api/carbon-story", async (req, res) => {
  try {
    const { logs, activeChallenges, weeklyGoal } = req.body;
    const client = getAiClient();

    const prompt = `
You are "EcoTrack Game Storyteller", a friendly, warm, slightly humorous, and highly supportive environmental coaching guide.
Analyze the user's carbon footprint logs and active challenges from this week.
Logs: ${JSON.stringify(logs || [])}
Active Challenges: ${JSON.stringify(activeChallenges || [])}
Weekly Goal: ${weeklyGoal || 80} kg CO2e.

Instructions for writing the Weekly Carbon Story:
1. Speak directly to the user (use "you" / "your").
2. Write a short, engaging story-style narrative of their week:
   - Open with a bold HIGHLIGHT: celebrate their absolute best moment (e.g. choosing low-carbon travel, vegan meal alternative, or saving emissions) referencing the specific day of the week if possible.
   - Include one honest, lighthearted CALLOUT: reference their highest emission moment (e.g. driving solo, synthetic polyester shopping) as a friendly nudge, but keep it warm, coaching, and never shaming or guilty.
   - Close with an encouraging positive nudge linked to an accepted challenge commitment or their target carbon budget.
3. Be specific! Mention the actual names of logs and their specific CO2 kg quantities.
4. Keep the narrative concise (around 150-250 words), conversational, warm, and highly engaging.
5. Extract/Identify:
   - "bestDay": the weekday of their best carbon-saving action or lowest footprint.
   - "worstDay": the weekday of their highest carbon emission action.
   - "highlightStat": a shareable, short headline stat summarizing a triumph of the week (e.g. "Best day: -5.5kg on Monday" or "Streak Champion!").
   - "totalSavedKg": estimate the overall avoided carbon sum (add up avoidedKg of logs).

Provide a valid JSON response with this exact structure:
{
  "storyText": "The narrative recap story...",
  "bestDay": "Monday",
  "worstDay": "Thursday",
  "highlightStat": "Best day: -5.45kg on Monday",
  "totalSavedKg": 6.8,
  "forwardNudge": "Keep up the awesome momentum!"
}
`;

    const response = await client.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT" as any,
          properties: {
            storyText: { type: "STRING" as any, description: "A friendly, lighthearted narrative story recapping the user's weekly carbon logs, referencing specific logs and weekdays." },
            bestDay: { type: "STRING" as any, description: "The day with the lowest footprint or highest savings (e.g. 'Monday')" },
            worstDay: { type: "STRING" as any, description: "The day with the highest footprint (e.g. 'Thursday')" },
            highlightStat: { type: "STRING" as any, description: "A brief shareable badge headline stat, e.g. 'Best day: -1.3kg on Monday'" },
            totalSavedKg: { type: "NUMBER" as any, description: "Total kilograms of CO2e avoided this week" },
            forwardNudge: { type: "STRING" as any, description: "One-sentence encouraging prompt for next week" }
          },
          required: ["storyText", "bestDay", "worstDay", "highlightStat", "totalSavedKg", "forwardNudge"]
        }
      }
    });

    res.json(JSON.parse((response.text || "{}").trim()));
  } catch (error: any) {
    console.error("Error generating carbon story recap:", error);
    res.status(500).json({ error: error.message || "Failed to generate carbon story recap" });
  }
});

// Endpoint to find country-specific daily averages and context
app.post("/api/country-context", async (req, res) => {
  const { country } = req.body;
  try {
    const client = getAiClient();
    
    const prompt = `
Estimate the daily average carbon footprint per citizen (CO2 equivalent in kg) contextually for: "${country || "United States"}".
Compare it to general global averages and state some country-specific renewable energy patterns.
`;

    const response = await client.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT" as any,
          properties: {
            country: { type: "STRING" as any },
            dailyAverageKg: { type: "NUMBER" as any, description: "Estimated average daily CO2e per person in kilograms." },
            contextText: { type: "STRING" as any, description: "A friendly contextual sentence comparing this country and detailing key carbon drivers." }
          },
          required: ["country", "dailyAverageKg", "contextText"]
        }
      }
    });

    res.json(JSON.parse((response.text || "{}").trim()));
  } catch (error: any) {
    console.error("Error in country-context:", error);
    res.json({
      country: country || "United States",
      dailyAverageKg: 16.0,
      contextText: "A average citizen produces ~16 kg CO2e daily, with transport and home power being primary drivers."
    });
  }
});

// Endpoint to generate a dynamic Daily Eco-Quiz using Gemini 3.5 Flash with option-specific explanations
app.post("/api/quiz-question", async (req, res) => {
  try {
    const client = getAiClient();
    
    const quizTopics = [
      "food miles and localized farming",
      "vampire power draw of home appliances",
      "impact of fast fashion vs circular wardrobe",
      "carbon capture technologies and trees",
      "biodiversity loss and habitat preservation",
      "energy cost of synthetic vs natural fiber textile production",
      "methane emissions from animal farming vs grains",
      "benefits of thermal composting at home",
      "ocean acidification and plastic breakdown",
      "microplastics in drinking water systems",
      "efficiency of hydrogen fuel cells vs lithium batteries",
      "vertical indoor farms vs traditional agriculture grids",
      "water footprints of beef vs plant protein alternatives",
      "smart thermostats and HVAC conservation",
      "graywater reuse and rainwater harvesting",
      "urban heat island effect and tree covers",
      "environmental load of concrete vs timber building blocks"
    ];
    
    // Select a random topic to keep questions highly dynamic and distinct
    const selectedTopic = quizTopics[Math.floor(Math.random() * quizTopics.length)];

    const prompt = `
You are "EcoTrack AI trivia master", a scientific sustainability professor.
Generate a fascinating, highly educational single multiple-choice question about sustainability, carbon footprint, ecological systems, or environmental habits.
Focus on the topic of "${selectedTopic}".

Requirements:
1. The question must be clear, concise, and intellectually engaging (suited for conscious eco players).
2. Provide exactly 4 options.
3. Mark the index of the correct option (0, 1, 2, or 3).
4. Provide a friendly, scientific explanation for EACH of the 4 options (specifically explaining why that exact option is either correct or incorrect). This is crucial so that the player gets meaningful feedback regardless of which answer they click.
5. Keep descriptions compact, encouraging, and under 55 words per explanation.

Respond with a strictly formatted JSON object matching the requested schema. Do not include markdown formatting outside JSON.
`;

    const response = await client.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT" as any,
          properties: {
            question: { type: "STRING" as any, description: "The interesting double-line trivia question about the topic." },
            options: {
              type: "ARRAY" as any,
              items: { type: "STRING" as any },
              description: "Exactly four multiple choice candidate strings."
            },
            correctIndex: { type: "INTEGER" as any, description: "Integer representing the index of the correct choice (0 to 3)." },
            explanations: {
              type: "ARRAY" as any,
              items: { type: "STRING" as any },
              description: "Exactly four independent feedback explanations, matching the index order of options."
            },
            topic: { type: "STRING" as any, description: "A two-word topic header, e.g. 'Fast Fashion'." }
          },
          required: ["question", "options", "correctIndex", "explanations", "topic"]
        }
      }
    });

    const outputText = (response.text || "{}").trim();
    res.json(JSON.parse(outputText));

  } catch (error: any) {
    console.error("Error generating daily quiz question:", error);
    // Provide a detailed fallback quiz item to guarantee high-reliability
    res.json({
      question: "Which of these food categories generally releases the highest carbon footprint per kilogram of food produced?",
      options: [
        "Sustainably farmed salmon",
        "Pork and standard poultry",
        "Local greenhouse tomatoes",
        "Industrial pasture beef"
      ],
      correctIndex: 3,
      explanations: [
        "Sustainably farmed salmon produces around 5.4 kg CO2e per kg. While significant, it is far lower than beef.",
        "Pork and poultry produce about 6-7 kg CO2e per kg, mainly due to animal feed cultivation and transport fuels.",
        "Local greenhouse tomatoes can range from 1 to 2 kg CO2e, mostly driven by heating, but have minimal impact compared to livestock.",
        "Correct! Pastured beef generates a massive 60 kg CO2e per kilogram of meat, driven primarily by bovine enteric methane release and pasture deforesting."
      ],
      topic: "Livestock Emissions"
    });
  }
});

// Setup dev server or static file production build serving
async function start() {
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting express in development mode using Vite dev middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Serving static production assets from /dist...");
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    // SPA routing fallback
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Node Full-Stack server is actively hosting on http://localhost:${PORT}`);
  });
}

start();
