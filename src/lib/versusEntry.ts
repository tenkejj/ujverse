/** One-shot entry into the shared conversation, consumed before sending to avoid repeat requests. */
export type VersusEntryState = { versusPrompt: string; versusRequestId: string }
export function versusEntryState(prompt: string): VersusEntryState {
  return { versusPrompt: prompt, versusRequestId: crypto.randomUUID() }
}
