import { z } from "zod";

export const EnvironmentVariableSchema = z.object({
    PORT: z.string().regex(/^\d+$/).default("4000"),
    TOKEN: z.string(),
    CLIENT_ID: z.string(),
    CLIENT_SECRET: z.string(),
    DB_URL: z.string(),
    JWT_SECRET: z.string(),
    JWT_ISSUER: z.string().default("SudoBot"),
    HOME_GUILD_ID: z.string(),
    SUDO_ENV: z.enum(["dev", "prod"]).optional(),
    NODE_ENV: z.enum(["dev", "prod", "development", "production", "test"]).default("production"),
    DEBUG: z.enum(["1", "0"]).optional(),
    BASE_SERVER_URL: z.string().optional(),
    DISCORD_OAUTH2_REDIRECT_URI: z.string().optional(),
    DISCORD_OAUTH2_RP_REDIRECT_URI: z.string().optional(),
    FRONTEND_URL: z.string().optional(),
    SUDO_PREFIX: z.string().optional(),
    ERROR_WEBHOOK_URL: z.string().optional(),
    BACKUP_CHANNEL_ID: z.string().optional(),
    FRONTEND_AUTH_KEY: z.string().optional(),
    CREDENTIAL_SERVER: z.string().optional(),
    PRIVATE_BOT_MODE: z.literal("true").optional(),
    EXTENSIONS_DIRECTORY: z.string().optional(),
    NO_GENERATE_CONFIG_SCHEMA: z.string().optional(),
    NSFWJS_MODEL_URL: z.string().optional(),
    NSFWJS_MODEL_IMAGE_SIZE: z.string().optional(),
    BACKUP_STORAGE: z.string().optional(),
    SUPPRESS_LOGS: z.string().optional(),
    CAT_API_TOKEN: z.string().optional(),
    DOG_API_TOKEN: z.string().optional(),
    SYSTEM_API_URL: z.string().optional(),
    HTTP_USER_AGENT: z
        .string()
        .optional()
        .nullable()
        .transform(value => (value === "null" ? null : value)),
    API_NINJAS_JOKE_API_KEY: z.string().optional(),
    PIXABAY_TOKEN: z.string().optional(),
    GITHUB_CLIENT_ID: z.string().optional(),
    GITHUB_CLIENT_SECRET: z.string().optional(),
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
    FRONTEND_KEY: z.string().optional(),
    RECAPTCHA_SECRET_KEY: z.string().optional(),
    PERSPECTIVE_API_TOKEN: z.string().optional(),
    SYSTEM_SHELL_KEY: z.string().optional(),
    SYSTEM_SHELL_EXEC_STREAM_PORT: z.string().regex(/^\d+/).optional(),
    CF_TURNSTILE_SECRET: z.string().optional(),
    PROXYCHECKIO_API_KEY: z.string().optional()
});

export type EnvironmentVariableRecord = z.infer<typeof EnvironmentVariableSchema>;
