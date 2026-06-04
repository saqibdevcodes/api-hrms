import dotenv from "dotenv";

// Load environment variables
dotenv.config();

interface EnvConfig {
  // Server Configuration
  PORT: number;
  NODE_ENV: string;
  API_PREFIX: string;

  // Database Configuration
  DATABASE_URL: string;

  // JWT Configuration
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  JWT_REFRESH_EXPIRES_IN: string;

  // Security Configuration
  BCRYPT_ROUNDS: number;
  RATE_LIMIT_WINDOW_MS: number;
  RATE_LIMIT_MAX_REQUESTS: number;

  // Cookie Configuration
  COOKIE_SECRET: string;
  COOKIE_DOMAIN: string;
  COOKIE_SECURE: boolean;
  COOKIE_SAME_SITE: "strict" | "lax" | "none";

  // Company Configuration
  COMPANY_NAME: string;
  COMPANY_DOMAIN: string;

  // Email Configuration
  SMTP_HOST?: string;
  SMTP_PORT?: number;
  SMTP_USER?: string;
  SMTP_PASS?: string;

  // Cloudinary Configuration
  CLOUDINARY_CLOUD_NAME: string;
  CLOUDINARY_API_KEY: string;
  CLOUDINARY_API_SECRET: string;
}

// added something
const getEnvVar = (key: string, defaultValue?: string): string => {
  const value = process.env[key] || defaultValue;
  if (!value) {
    throw new Error(`Environment variable ${key} is required`);
  }
  return value;
};

const getEnvNumber = (key: string, defaultValue?: number): number => {
  const value = process.env[key];
  if (!value && defaultValue === undefined) {
    throw new Error(`Environment variable ${key} is required`);
  }
  return value ? parseInt(value, 10) : defaultValue!;
};

const getEnvBoolean = (key: string, defaultValue?: boolean): boolean => {
  const value = process.env[key];
  if (!value && defaultValue === undefined) {
    throw new Error(`Environment variable ${key} is required`);
  }
  return value ? value.toLowerCase() === "true" : defaultValue!;
};

export const config: EnvConfig = {
  // Server Configuration
  PORT: getEnvNumber("PORT", 3000),
  NODE_ENV: getEnvVar("NODE_ENV", "development"),
  API_PREFIX: getEnvVar("API_PREFIX", "/api/v1"),

  // Database Configuration
  DATABASE_URL: getEnvVar("DATABASE_URL"),

  // JWT Configuration
  JWT_SECRET: getEnvVar("JWT_SECRET"),
  JWT_EXPIRES_IN: getEnvVar("JWT_EXPIRES_IN", "7d"),
  JWT_REFRESH_EXPIRES_IN: getEnvVar("JWT_REFRESH_EXPIRES_IN", "30d"),

  // Security Configuration
  BCRYPT_ROUNDS: getEnvNumber("BCRYPT_ROUNDS", 12),
  RATE_LIMIT_WINDOW_MS: getEnvNumber("RATE_LIMIT_WINDOW_MS", 900000), // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: getEnvNumber("RATE_LIMIT_MAX_REQUESTS", 100),

  // Cookie Configuration
  COOKIE_SECRET: getEnvVar("COOKIE_SECRET"),
  COOKIE_DOMAIN: getEnvVar("COOKIE_DOMAIN", "localhost"),
  COOKIE_SECURE: getEnvBoolean("COOKIE_SECURE", false),
  COOKIE_SAME_SITE: getEnvVar("COOKIE_SAME_SITE", "strict") as
    | "strict"
    | "lax"
    | "none",

  // Company Configuration
  COMPANY_NAME: getEnvVar("COMPANY_NAME", "Iris Communications"),
  COMPANY_DOMAIN: getEnvVar("COMPANY_DOMAIN", "iriscommunications.com"),

  // Email Configuration (Optional)
  SMTP_HOST: process.env.SMTP_HOST || process.env.MAIL_HOST,
  SMTP_PORT: process.env.SMTP_PORT
    ? parseInt(process.env.SMTP_PORT, 10)
    : process.env.MAIL_PORT
    ? parseInt(process.env.MAIL_PORT, 10)
    : undefined,
  SMTP_USER: process.env.SMTP_USER || process.env.MAIL_USERNAME,
  SMTP_PASS: process.env.SMTP_PASS || process.env.MAIL_PASSWORD,

  // Cloudinary Configuration (Optional for local development)
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME || "",
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY || "",
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET || "",
};

// Validation
export const validateConfig = (): void => {
  const requiredVars = ["DATABASE_URL", "JWT_SECRET", "COOKIE_SECRET"];

  const missingVars = requiredVars.filter((varName) => !process.env[varName]);

  if (missingVars.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingVars.join(", ")}`
    );
  }

  console.log("✅ Environment configuration validated successfully");
};

export default config;
