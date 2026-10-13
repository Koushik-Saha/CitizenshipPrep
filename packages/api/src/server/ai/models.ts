import { createFallbackGenerator, type FallbackOptions } from './fallback';
import { createGeminiGenerator, geminiModel } from './gemini';
import { createClaudeGenerator, type TextGenerator } from './generator';

// Which models answer learners, from the keys that are set. Claude first;
// Gemini after it, for when Claude cannot answer.

/** The settings read here: ANTHROPIC_API_KEY, GEMINI_API_KEY and GEMINI_MODEL. */
type AiEnv = Readonly<Record<string, string | undefined>>;

/** Whether any model's key is set. */
export function isAiConfigured(env: AiEnv): boolean {
  return Boolean(env.ANTHROPIC_API_KEY?.trim() || env.GEMINI_API_KEY?.trim());
}

/** The models with a key, in the order they are asked. */
export function configuredGenerators(env: AiEnv): TextGenerator[] {
  const generators: TextGenerator[] = [];
  if (env.ANTHROPIC_API_KEY?.trim()) generators.push(createClaudeGenerator());
  const geminiKey = env.GEMINI_API_KEY?.trim();
  if (geminiKey) {
    generators.push(
      createGeminiGenerator({ apiKey: geminiKey, model: geminiModel(env.GEMINI_MODEL) }),
    );
  }
  return generators;
}

/** The generator the app asks: every configured model, each a fallback for the one before. */
export function createAppGenerator(env: AiEnv, options: FallbackOptions = {}): TextGenerator {
  return createFallbackGenerator(configuredGenerators(env), options);
}
