// The active inference engine. ONE line to swap implementations — both share the
// signature (view, state) => string | Promise<string | {text, source}>, and the
// banner handles all return shapes, so nothing else in the UI changes.
//
// Local-only (no backend needed). To restore the AI read, swap in openaiInference.
import { localInference } from './localInference.js'

export const inferenceEngine = localInference
export const inferenceTag = 'Local rules'
