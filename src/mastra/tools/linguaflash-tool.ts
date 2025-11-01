import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

// Simple in-memory cache for translations (consider Redis for production)
const translationCache = new Map<
  string,
  { detectedLang: string; translation: string; timestamp: number }
>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
const CACHE_MAX_SIZE = 1000; // Limit cache size

// Generate cache key
function getCacheKey(text: string, targetLang: string): string {
  return `${text.toLowerCase().trim()}:${targetLang.toLowerCase().trim()}`;
}

// Clean old cache entries periodically
function cleanCache() {
  const now = Date.now();
  const keysToDelete: string[] = [];

  for (const [key, value] of translationCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      keysToDelete.push(key);
    }
  }

  keysToDelete.forEach(key => translationCache.delete(key));

  // If cache is still too large, remove oldest entries
  if (translationCache.size > CACHE_MAX_SIZE) {
    const sorted = Array.from(translationCache.entries()).sort(
      (a, b) => a[1].timestamp - b[1].timestamp
    );
    const toRemove = sorted.slice(0, translationCache.size - CACHE_MAX_SIZE);
    toRemove.forEach(([key]) => translationCache.delete(key));
  }
}

// Clean cache every hour
setInterval(cleanCache, 60 * 60 * 1000);

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
    const cacheKey = getCacheKey(normalizedText, normalizedTargetLang);

    // Check cache first
    const cached = translationCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return {
        detectedLang: cached.detectedLang,
        translation: cached.translation,
        text: normalizedText,
        targetLang: normalizedTargetLang,
      };
    }

    // Optimized prompt with explicit JSON schema
    const prompt = `You are a translation API. Translate the text to ${normalizedTargetLang} and detect the source language.

Text to translate: "${normalizedText}"

Respond ONLY with valid JSON in this exact format (no other text):
{
  "detected": "Source language name (e.g., 'English')",
  "translation": "Translated text"
}`;

    // Use faster model endpoint
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${apiKey}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // Reduced to 8s timeout for faster failures

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
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

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

      // Handle different possible response structures
      let output = '';
      if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
        output = data.candidates[0].content.parts[0].text;
      } else if (data.text) {
        output = data.text;
      } else if (typeof data === 'string') {
        output = data;
      } else {
        // Try to find JSON in the response structure
        output = JSON.stringify(data);
      }

      // Clean the output - remove markdown code blocks if present
      let cleanedOutput = output.trim();
      if (cleanedOutput.startsWith('```json')) {
        cleanedOutput = cleanedOutput
          .replace(/^```json\s*/i, '')
          .replace(/\s*```$/i, '');
      } else if (cleanedOutput.startsWith('```')) {
        cleanedOutput = cleanedOutput
          .replace(/^```\s*/i, '')
          .replace(/\s*```$/i, '');
      }

      let parsed;
      try {
        parsed = JSON.parse(cleanedOutput);
      } catch (parseError) {
        // Fallback: try to extract JSON from response
        const jsonMatch = cleanedOutput.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            parsed = JSON.parse(jsonMatch[0]);
          } catch (e2) {
            console.error('JSON Parse Error:', {
              originalOutput: output.substring(0, 500),
              cleanedOutput: cleanedOutput.substring(0, 500),
              match: jsonMatch[0].substring(0, 500),
            });
            throw new Error(
              `Failed to parse JSON response. Raw output: ${output.substring(0, 200)}`
            );
          }
        } else {
          console.error('No JSON found in response:', {
            originalOutput: output.substring(0, 500),
            cleanedOutput: cleanedOutput.substring(0, 500),
          });
          throw new Error(
            `No valid JSON found in response: ${output.substring(0, 200)}`
          );
        }
      }

      // Robust field extraction - handle different field names
      const detectedLang =
        parsed.detected ||
        parsed.detectedLang ||
        parsed.detectedLanguage ||
        parsed.source ||
        parsed.sourceLanguage ||
        'Unknown';

      const translation =
        parsed.translation ||
        parsed.translated ||
        parsed.text ||
        parsed.result ||
        '';

      if (!translation || translation.trim().length === 0) {
        console.error('Missing translation in response:', {
          parsed,
          detectedLang,
          translation,
        });
        throw new Error(
          `Invalid response format: translation field is empty. Response: ${JSON.stringify(parsed).substring(0, 200)}`
        );
      }

      const result = {
        detectedLang: detectedLang.toString().trim() || 'Unknown',
        translation: translation.toString().trim(),
        text: normalizedText,
        targetLang: normalizedTargetLang,
      };

      // Cache the result
      translationCache.set(cacheKey, {
        detectedLang: result.detectedLang,
        translation: result.translation,
        timestamp: Date.now(),
      });

      return result;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Translation request timed out after 10 seconds');
      }
      throw error;
    }
  },
});
