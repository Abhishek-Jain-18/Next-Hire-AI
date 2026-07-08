import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";

const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);

// ✅ Both are current, free, working models as of 2026
const primaryModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
const fallbackModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

const generationConfig = {
  temperature: 1,
  topP: 0.95,
  topK: 64,
  maxOutputTokens: 8192,
  responseMimeType: "application/json",
};

const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT,        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,       threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];

export const chatSession = primaryModel.startChat({ generationConfig, safetySettings });
export const fallbackChatSession = fallbackModel.startChat({ generationConfig, safetySettings });

export async function sendWithRetry(prompt, retries = 3, delayMs = 5000) {
  const sessions = [chatSession, fallbackChatSession];

  for (let i = 0; i < sessions.length; i++) {
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const result = await sessions[i].sendMessage(prompt);
        return result;
      } catch (err) {
        const is429 = err?.message?.includes("429") || err?.message?.includes("quota");
        const is404 = err?.message?.includes("404");
        const isLastAttempt = attempt === retries - 1;
        const isLastModel = i === sessions.length - 1;

        if (is404) {
          // Model not found - no point retrying, move on immediately
          console.error(`Model not found (404). Check model name.`);
          throw err;
        }

        if (is429 && !isLastAttempt) {
          const wait = delayMs * Math.pow(2, attempt);
          console.warn(`Rate limited. Retrying in ${wait / 1000}s...`);
          await new Promise((res) => setTimeout(res, wait));
        } else if (is429 && isLastAttempt && !isLastModel) {
          console.warn("Primary exhausted, switching to fallback...");
          break;
        } else {
          throw err;
        }
      }
    }
  }

  throw new Error("All models are rate limited. Please wait a minute and try again.");
}