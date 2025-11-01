import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export const translateTool = createTool({
  id: 'linguaFlash-translate',
  description:
    'Detects source language and translates text accurately into a specified target language',
  inputSchema: z.object({
    text: z.string().describe('Text to translate'),
    targetLang: z.string().describe('Target language name (e.g., "Spanish")'),
  }),
  outputSchema: z.object({
    text: z.string().describe('Original text'),
    targetLang: z.string().describe('Target language'),
    detectedLang: z.string().describe('Detected language (e.g., "English")'),
    translation: z.string().describe('Translated text'),
  }),
  execute: async ({ context }) => {
    const apiKey =
      process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
      process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error(
        'GOOGLE_GENERATIVE_AI_API_KEY or GOOGLE_GEMINI_API_KEY environment variable is required'
      );
    }

    // Normalize inputs for caching
    const normalizedText = context.text.trim();
    const normalizedTargetLang = context.targetLang.trim();

    // Optimized prompt with explicit JSON schema
    const prompt = `You are a translation API. Translate the text to ${normalizedTargetLang} and detect the source language.

Text to translate: "${normalizedText}"

Respond ONLY with valid JSON in this exact format (no other text):
{
  "detected": "Source language name (e.g., 'English')",
  "translation": "Translated text"
}`;

    // Use faster model endpoint
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.1, // Very low for faster, more deterministic responses
            maxOutputTokens: 150, // Reduced for speed
            topP: 0.9,
            topK: 20, // Limit choices for faster responses
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Gemini API Error:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText,
        });
        throw new Error(
          `Gemini API error (${response.status}): ${response.statusText} - ${errorText.substring(0, 200)}`
        );
      }

      const data = await response.json();
      const output = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';

      let parsed;
      try {
        parsed = JSON.parse(output);
      } catch (e) {
        // Fallback: try to extract JSON from response
        const jsonMatch = output.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error(`Invalid JSON response: ${output}`);
        }
      }

      if (!parsed.detected || !parsed.translation) {
        throw new Error(
          `Invalid response format: missing detected or translation field`
        );
      }

      const result = {
        detectedLang: parsed.detected,
        translation: parsed.translation,
        text: normalizedText,
        targetLang: normalizedTargetLang,
      };

      return result;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Translation request timed out after 10 seconds');
      }
      throw error;
    }
  },
});
