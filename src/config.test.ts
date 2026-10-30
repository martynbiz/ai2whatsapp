import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadConfig } from "./config";

const REQUIRED_VARS = [
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "TWILIO_WHATSAPP_NUMBER",
  "TWILIO_ALLOWED_FROM",
  "OPENAI_API_KEY",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
] as const;

function validEnv(): Record<string, string> {
  return {
    PORT: "3000",
    TWILIO_ACCOUNT_SID: "AC_test",
    TWILIO_AUTH_TOKEN: "token_test",
    TWILIO_WHATSAPP_NUMBER: "whatsapp:+10000000000",
    TWILIO_ALLOWED_FROM: "whatsapp:+10000000001",
    OPENAI_API_KEY: "sk-test",
    GOOGLE_CLIENT_ID: "client_id_test",
    GOOGLE_CLIENT_SECRET: "client_secret_test",
  };
}

describe("loadConfig", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("throws when a required env var is missing", () => {
    for (const missing of REQUIRED_VARS) {
      process.env = { ...validEnv() };
      delete process.env[missing];
      expect(() => loadConfig(), `expected missing ${missing} to throw`).toThrow();
    }
  });

  it("returns a typed config object when all required vars are present", () => {
    process.env = { ...validEnv() };
    const config = loadConfig();

    expect(config).toEqual({
      port: 3000,
      twilio: {
        accountSid: "AC_test",
        authToken: "token_test",
        whatsappNumber: "whatsapp:+10000000000",
        allowedFrom: "whatsapp:+10000000001",
      },
      openaiApiKey: "sk-test",
      google: {
        clientId: "client_id_test",
        clientSecret: "client_secret_test",
      },
    });
  });

  it("defaults PORT to 3000 when not set", () => {
    process.env = { ...validEnv() };
    delete process.env.PORT;
    const config = loadConfig();
    expect(config.port).toBe(3000);
  });
});
