// app/lib/copilot/activity-assist/tools.ts
import type Anthropic from '@anthropic-ai/sdk';

/** Chip answer (Concept B): readable answer + save-ready title/summary in one call. */
export const ASSIST_ANSWER_TOOL: Anthropic.Tool = {
  name: 'assist_answer',
  description: 'Return the answer plus a save-ready title and summary.',
  input_schema: {
    type: 'object',
    properties: {
      answer: { type: 'string', description: 'The full readable answer shown to the user.' },
      title: { type: 'string', description: 'Short glanceable title (≤8 words) for the saved list.' },
      summary: { type: 'string', description: 'Brief 1–2 sentence key takeaway to save.' },
    },
    required: ['answer', 'title', 'summary'],
  },
};

/** Free-ask save summariser (Concept A). */
export const SAVE_SUMMARY_TOOL: Anthropic.Tool = {
  name: 'save_summary',
  description: 'Distil an answer into a short saved note.',
  input_schema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Short glanceable title (≤8 words).' },
      summary: { type: 'string', description: 'Brief 1–2 sentence key takeaway.' },
    },
    required: ['title', 'summary'],
  },
};