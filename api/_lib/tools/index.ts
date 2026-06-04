/**
 * Barrel modułu Tools — pojedynczy import "side-effect" rejestrujący wszystkie
 * narzędzia w `toolRegistry`. Każdy plik narzędzia w momencie importu woła
 * `registerTool({...})`, więc samo wczytanie tego barrel-a wystarczy, żeby
 * `toGroqToolsArray()` zwróciło komplet definicji.
 *
 * Konsumenci (np. `api/chat.ts`) importują:
 *   import { toGroqToolsArray, getToolEntry } from './_lib/tools/index.js'
 *
 * a następnie:
 *   const tools = toGroqToolsArray()
 *   const entry = getToolEntry(toolCall.function.name)
 */

import './getLatestAnnouncements.js'
import './searchEvents.js'
import './getLatestPosts.js'

export {
  type Tool,
  type ToolContext,
  type ToolExecutor,
  type ToolEntry,
  type ToolJsonSchema,
  type GroqToolDescriptor,
  type RegisterToolArgs,
  registerTool,
  getToolEntry,
  listToolNames,
  toGroqToolsArray,
  clearToolCache,
} from './registry.js'
