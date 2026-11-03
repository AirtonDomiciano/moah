import { converse } from "./converse.js";
import type { WorkLogContext } from "./work-log.js";
import type { Domain } from "../domain/constants.js";
import type { LlmProvider } from "../domain/llm.js";

export function rememberAsk(
  context: WorkLogContext,
  domain: Domain,
  project: string | null,
  provider: LlmProvider,
  maxToolCalls: number,
): (text: string) => Promise<string> {
  return async (text) => {
    const result = await converse({
      context,
      domain,
      project,
      history: [],
      text,
      provider,
      maxToolCalls,
    });
    return result.answer ?? "";
  };
}
