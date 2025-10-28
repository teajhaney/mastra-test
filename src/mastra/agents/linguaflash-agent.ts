import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { LibSQLStore } from '@mastra/libsql';
import { scorers } from '../scorers/weather-scorer';
import { translateTool } from '../tools/linguaflash-tool';

export const linguaFlashAgent = new Agent({
  name: 'LinguaFlash Agent',
  instructions: `
      You are a helpful translation assistant that provides accurate language detection and high-quality translations for multilingual processing.
      Your primary function is to help users translate text to a specified target language. When responding:
      - Always ask for a target language if none is provided
      - If the source text isn't in the expected language, detect it automatically
      - Include relevant details like detected language code and confidence if applicable
      - Keep responses concise but informative
      - If the user asks for context-specific translations (e.g., formal/informal), adapt accordingly.
      Use the translateTool to detect source language and fetch translation data.
  `,
  model: 'google/gemini-2.5-pro',

  tools: { translateTool },
  scorers: {
    toolCallAppropriateness: {
      scorer: scorers.toolCallAppropriatenessScorer,
      sampling: {
        type: 'ratio',
        rate: 1,
      },
    },
    completeness: {
      scorer: scorers.completenessScorer,
      sampling: {
        type: 'ratio',
        rate: 1,
      },
    },
    translation: {
      scorer: scorers.translationScorer,
      sampling: {
        type: 'ratio',
        rate: 1,
      },
    },
  },
  memory: new Memory({
    storage: new LibSQLStore({
      url: 'file:../mastra.db', // path is relative to the .mastra/output directory
    }),
  }),
});
