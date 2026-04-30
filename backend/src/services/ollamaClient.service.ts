import axios from "axios";
import { env } from "../config/env.js";

type OllamaRole = "user" | "assistant" | "system";

interface GenerateOptions {
  model?: string;
  format?: "json" | undefined;
  temperature?: number;
}

interface ChatOptions {
  model?: string;
}

interface OllamaGenerateResponse {
  response: string;
}

interface OllamaChatResponse {
  message: {
    role: OllamaRole;
    content: string;
  };
}

interface OllamaTagsResponse {
  models?: Array<{ name?: string }>;
}

const client = axios.create({
  baseURL: env.OLLAMA_BASE_URL,
  timeout: 30_000
});

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  return "Unknown error";
};

export const ollamaClient = {
  async generate(prompt: string, options?: GenerateOptions): Promise<string> {
    try {
      const response = await client.post<OllamaGenerateResponse>("/api/generate", {
        model: options?.model ?? env.OLLAMA_MODEL,
        prompt,
        stream: false,
        format: options?.format,
        options: {
          temperature: options?.temperature ?? 0.2
        }
      });
      return response.data.response;
    } catch (error) {
      throw new Error(`Ollama unavailable: ${getErrorMessage(error)}`);
    }
  },

  async chat(
    messages: Array<{ role: OllamaRole; content: string }>,
    options?: ChatOptions
  ): Promise<string> {
    try {
      const response = await client.post<OllamaChatResponse>("/api/chat", {
        model: options?.model ?? env.OLLAMA_MODEL,
        messages,
        stream: false
      });
      return response.data.message.content;
    } catch (error) {
      throw new Error(`Ollama unavailable: ${getErrorMessage(error)}`);
    }
  },

  async isAvailable(): Promise<boolean> {
    try {
      const response = await client.get("/api/tags");
      return response.status === 200;
    } catch {
      return false;
    }
  },

  async listModels(): Promise<string[]> {
    try {
      const response = await client.get<OllamaTagsResponse>("/api/tags");
      const models = response.data.models ?? [];
      return models.map((model) => model.name).filter((name): name is string => typeof name === "string");
    } catch (error) {
      throw new Error(`Ollama unavailable: ${getErrorMessage(error)}`);
    }
  }
};