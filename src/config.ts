import "dotenv/config";

export interface Config {
  port: number;
  twilio: {
    accountSid: string;
    authToken: string;
    whatsappNumber: string;
    allowedFrom: string;
  };
  openaiApiKey: string;
  google: {
    clientId: string;
    clientSecret: string;
  };
}

const REQUIRED_VARS = [
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "TWILIO_WHATSAPP_NUMBER",
  "TWILIO_ALLOWED_FROM",
  "OPENAI_API_KEY",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
] as const;

function requireEnv(name: (typeof REQUIRED_VARS)[number]): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function loadConfig(): Config {
  for (const name of REQUIRED_VARS) {
    requireEnv(name);
  }

  return {
    port: process.env.PORT ? Number(process.env.PORT) : 3000,
    twilio: {
      accountSid: requireEnv("TWILIO_ACCOUNT_SID"),
      authToken: requireEnv("TWILIO_AUTH_TOKEN"),
      whatsappNumber: requireEnv("TWILIO_WHATSAPP_NUMBER"),
      allowedFrom: requireEnv("TWILIO_ALLOWED_FROM"),
    },
    openaiApiKey: requireEnv("OPENAI_API_KEY"),
    google: {
      clientId: requireEnv("GOOGLE_CLIENT_ID"),
      clientSecret: requireEnv("GOOGLE_CLIENT_SECRET"),
    },
  };
}
