import { describe, it, expect, vi, beforeEach } from "vitest";
import { CLIAgent } from "./cli-agent.js";

// Mock the AI SDK
vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("ai")>();
  return {
    ...actual,
    generateText: vi.fn(),
    streamText: vi.fn(),
  };
});

// Mock all provider packages
vi.mock("@ai-sdk/openai", () => ({
  openai: vi.fn(() => "mock-openai-model"),
}));

vi.mock("@ai-sdk/anthropic", () => ({
  anthropic: vi.fn(() => "mock-anthropic-model"),
}));

vi.mock("@ai-sdk/google", () => ({
  google: vi.fn(() => "mock-google-model"),
}));

describe("CLIAgent", () => {
  let mockClient: any;

  beforeEach(() => {
    mockClient = {
      hasSource: vi.fn().mockReturnValue(true),
      getMetadata: vi.fn().mockReturnValue({ type: "github", identifier: "test-owner/test-repo" }),
      search: vi.fn(),
      listFiles: vi.fn(),
      readFile: vi.fn(),
    };
  });

  it("creates agent with openai provider", () => {
    const agent = new CLIAgent({
      client: mockClient,
      provider: "openai",
      model: "gpt-5.2",
    });
    expect(agent).toBeDefined();
  });

  it("creates agent with anthropic provider", () => {
    const agent = new CLIAgent({
      client: mockClient,
      provider: "anthropic",
      model: "claude-sonnet-4-5",
    });
    expect(agent).toBeDefined();
  });

  it("creates agent with google provider", () => {
    const agent = new CLIAgent({
      client: mockClient,
      provider: "google",
      model: "gemini-3-pro",
    });
    expect(agent).toBeDefined();
  });

  it("resets conversation history", () => {
    const agent = new CLIAgent({
      client: mockClient,
      provider: "openai",
      model: "gpt-5.2",
    });
    agent.reset();
    expect(agent.getHistory()).toHaveLength(0);
  });

  it("uses custom system prompt", () => {
    const agent = new CLIAgent({
      client: mockClient,
      provider: "openai",
      model: "gpt-5.2",
      systemPrompt: "Custom prompt",
    });
    expect(agent).toBeDefined();
  });
});

