/**
 * LLM Chat Application - English Learning Edition
 *
 * Enhanced for English learning with role-based conversations,
 * streaming responses via SSE, and CORS support.
 */
import { Env, ChatMessage } from "./types";

const MODEL_ID = "@cf/meta/llama-3.1-8b-instruct-fp8";

const SYSTEM_PROMPTS: Record<string, string> = {
  partner: `You are a friendly English conversation partner helping someone practice English.
Keep responses conversational, natural, and encouraging (2-4 sentences max).
Occasionally point out one grammar or vocabulary improvement in a gentle way.
Focus on making the learner feel comfortable and motivated.
Always respond in English only.`,

  interviewer: `You are a professional job interviewer conducting a mock interview in English.
Ask realistic interview questions and give brief constructive feedback on the candidate's English and communication.
Keep responses focused (2-4 sentences). Encourage proper business English usage.
After their answer, give one tip and ask the next relevant question.
Always respond in English only.`,

  support: `You are a friendly customer support agent helping someone practice real-world English conversations.
Simulate realistic customer service scenarios - billing, returns, technical issues, etc.
Keep responses helpful and professional (2-4 sentences).
Occasionally suggest more natural or polite phrases the learner could use.
Always respond in English only.`,

  teacher: `You are a patient English teacher helping a student improve their English.
Explain grammar rules simply, correct mistakes kindly, and provide examples.
Give clear, educational responses (3-5 sentences).
Encourage the student and celebrate their progress.
Always respond in English only.`,
};

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);

    if (url.pathname === "/" || !url.pathname.startsWith("/api/")) {
      return env.ASSETS.fetch(request);
    }

    if (url.pathname === "/api/chat") {
      if (request.method === "POST") {
        return handleChatRequest(request, env);
      }
      return new Response("Method not allowed", { status: 405, headers: CORS_HEADERS });
    }

    return new Response("Not found", { status: 404, headers: CORS_HEADERS });
  },
} satisfies ExportedHandler<Env>;

async function handleChatRequest(
  request: Request,
  env: Env,
): Promise<Response> {
  try {
    const { messages = [], role = "partner" } = (await request.json()) as {
      messages: ChatMessage[];
      role?: string;
    };

    const systemPrompt = SYSTEM_PROMPTS[role] || SYSTEM_PROMPTS.partner;

    // Build messages array with system prompt
    const allMessages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      ...messages.filter((m) => m.role !== "system"),
    ];

    const stream = await env.AI.run(
      MODEL_ID,
      {
        messages: allMessages,
        max_tokens: 512,
        stream: true,
      },
    );

    return new Response(stream, {
      headers: {
        ...CORS_HEADERS,
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache",
        "connection": "keep-alive",
      },
    });
  } catch (error) {
    console.error("Error processing chat request:", error);
    return new Response(
      JSON.stringify({ error: "Failed to process request" }),
      {
        status: 500,
        headers: { ...CORS_HEADERS, "content-type": "application/json" },
      },
    );
  }
}
