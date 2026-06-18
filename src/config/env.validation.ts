import { IsString, IsNotEmpty, IsOptional, IsEnum, IsNumber, IsBoolean, IsUrl, Min, Max } from "class-validator";
import { Transform } from "class-transformer";

export enum NodeEnv {
  Development = "development",
  Production = "production",
  Test = "test",
}

export class EnvironmentVariables {
  @IsEnum(NodeEnv)
  NODE_ENV: NodeEnv = NodeEnv.Development;

  @IsNumber()
  @Min(1)
  @Max(65535)
  @Transform(({ value }) => parseInt(value, 10) || 3000)
  PORT: number = 3000;

  @IsString()
  @IsNotEmpty()
  DATABASE_URL: string;

  @IsString()
  @IsNotEmpty()
  JWT_SECRET: string;

  @IsString()
  @IsNotEmpty()
  CORS_ORIGIN: string = "http://localhost:3001";

  @IsString()
  LOG_LEVEL: string = "info";

  @IsOptional()
  @IsUrl()
  OTEL_EXPORTER_OTLP_ENDPOINT?: string;

  // Blockchain RPC URLs
  @IsString()
  @IsNotEmpty()
  ETH_RPC_URL: string;

  @IsString()
  @IsNotEmpty()
  ARB_RPC_URL: string;

  @IsString()
  @IsNotEmpty()
  POLY_RPC_URL: string;

  @IsString()
  @IsNotEmpty()
  OPT_RPC_URL: string;

  // Email configuration
  @IsOptional()
  @IsString()
  SMTP_HOST?: string;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10) || 587)
  SMTP_PORT?: number;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === "true")
  SMTP_SECURE?: boolean;

  @IsOptional()
  @IsString()
  SMTP_USER?: string;

  @IsOptional()
  @IsString()
  SMTP_PASSWORD?: string;

  @IsString()
  EMAIL_VERIFICATION_URL: string = "http://localhost:3000/auth/verify-email";

  @IsString()
  EMAIL_FROM: string = '"StellAIverse" <noreply@stellaiverse.com>';
}