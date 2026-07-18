import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const response = await anthropic.messages.create({
  model: "claude-sonnet-5",
  max_tokens: 10,
  messages: [{ role: "user", content: "Réponds juste: OK" }],
});

const text = response.content.find((b) => b.type === "text")?.text ?? "";
console.log("Connexion Claude OK. Réponse:", text.trim());
