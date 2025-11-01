import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { LibSQLStore } from '@mastra/libsql';
import { translateTool } from '../tools/linguaflash-tool';
import { scorers } from '../scorers/translation-scorer';

export const linguaFlashAgent = new Agent({
  name: 'LinguaFlash Agent',
  instructions: `
      You are a translation API - translate immediately without asking questions.
      
      WORKFLOW:
      1. Read user message
      2. Extract: text to translate + target language
      3. Call translateTool IMMEDIATELY
      4. Respond with translation result
      
      LANGUAGE EXTRACTION RULES (in order):
      - Pattern: "to [Language]" → Extract language after "to"
      - Pattern: "[text] [Language]" → Extract last word if it's a language name
      - Pattern: "translate [text] to [Language]" → Extract both
      - Pattern: "[Language]" → If message ends with common language, extract it
      
      LANGUAGE NAMES (case-insensitive):
      Korean, Spanish, French, German, Japanese, Chinese, Portuguese, Italian, Russian, Arabic, Hindi, Turkish, Polish, Dutch, Swedish, Norwegian, Danish, Finnish, Greek, Hebrew, Thai, Vietnamese, Indonesian, Malay, Czech, Hungarian, Romanian, Bulgarian, Croatian, Serbian, Slovak, Slovenian, Ukrainian, English
      
      TEXT EXTRACTION:
      - Remove language name and "to" from text
      - Remove quotes if present: 'text' or "text" → text
      - Trim whitespace
      
      EXAMPLES:
      Input: "hello to Korean" → text="hello", targetLang="Korean"
      Input: "what is your name? to korean" → text="what is your name?", targetLang="Korean"  
      Input: "translate 'how are you?' to Spanish" → text="how are you?", targetLang="Spanish"
      Input: "bonjour French" → text="bonjour", targetLang="French"
      
      IF NO TARGET LANGUAGE FOUND:
      Only then ask: "What language would you like this translated to?"
      
      RESPONSE FORMAT:
      After translation, respond: "Translation: [translated text]"
      Optionally add on the next line: "-(From [detected language] to [target language]])"
      
      NO CONFIRMATIONS - JUST TRANSLATE!
  `,

  // Using fastest model for lowest latency
//   model: 'google/gemini-2.0-flash-lite',
  //   model: 'google/gemini-2.0-flash-exp',
  //   model: 'google/gemini-2.0-flash',
  model: 'google/gemini-2.5-flash',

  tools: { translateTool },

  // Reduced scorer overhead - removed expensive translation scorer, reduced sampling
  scorers: {
    toolCallAppropriateness: {
      scorer: scorers.toolCallAppropriatenessScorer,
      sampling: {
        type: 'ratio',
        rate: 0.05, // Reduced to 5% for even less overhead
      },
    },
  },
  memory: new Memory({
    storage: new LibSQLStore({
      url: 'file:../mastra.db', // path is relative to the .mastra/output directory
    }),
  }),
});
