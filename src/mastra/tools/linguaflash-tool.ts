import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export const translateTool = createTool({
  id: 'linguaFlash-translate',
  description: 'Get current weather for a location',
  inputSchema: z.object({
    text: z.string().describe('Text to translate'),
    targetLang: z.string().describe('Target language name (e.g., "Spanish")'),
  }),
  outputSchema: z.object({
    text: z.string().describe('Original text'),
    targetLang: z.string().describe('Target language'),
    detectedLang: z.string().describe('ISO language code (e.g., "en")'),
    translation: z.string().describe('Translated text'),
  }),
  execute: async ({ context }) => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('GOOGLE_GEMINI_API_KEY environment variable is required');
    }

    const prompt = `
      Detect the source language of the following text and translate it precisely to ${context.targetLang}.
      Respond ONLY with valid JSON in this exact format: 
      {
        "detected": "ISO language code (e.g., 'en' for English)",
        "translation": "The translated text",
      }
      Do not add any explanations or extra text.

      Text: "${context.text}"
    `;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json' },
      }),
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.statusText}`);
    }

    const data = await response.json();
    const output = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    const parsed = JSON.parse(output);

    if (!parsed.detected || !parsed.translation) {
      throw new Error('Invalid response from translation service');
    }

    return {
      detectedLang: parsed.detected,
      translation: parsed.translation,
      text: context.text,
      targetLang: context.targetLang,
    };
  },
});
