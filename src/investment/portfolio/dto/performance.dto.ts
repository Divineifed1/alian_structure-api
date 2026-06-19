import { IsOptional, IsNumber, IsDateString, IsEnum } from "class-validator";

export enum TimeRange {
  ONE_MONTH = "1M",
  THREE_MONTHS = "3M",
  SIX_MONTHS = "6M",
  ONE_YEAR = "1Y",
  ALL = "ALL",
}

export class TimeRangeDto {
  @IsOptional()
  @IsEnum(TimeRange)
  timeRange?: TimeRange;
}

export class GetPerformanceMetricsDto {
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsNumber()
  limit?: number;
}

export class PerformanceMetricResponseDto {
  id: string;
  dateTime: Date;
  portfolioValue: number;
  dailyReturn?: number;
  cumulativeReturn?: number;
  yearToDateReturn?: number;
  oneYearReturn?: number;
  volatility?: number;
  sharpeRatio?: number;
  sortinoRatio?: number;
  maxDrawdown?: number;
  currentDrawdown?: number;
  valueAtRisk95?: number;
  allocation?: Record<string, number>;
  assetContribution?: Record<string, number>;
  riskContribution?: Record<string, number>;
}

export class PortfolioSummaryDto {
  portfolioId: string;
  portfolioName: string;
  totalValue: number;
  currentAllocation: Record<string, number>;
  targetAllocation?: Record<string, number>;
  assetCount: number;
  dayReturn?: number;
  yearToDateReturn?: number;
  oneYearReturn?: number;
  volatility?: number;
  sharpeRatio?: number;
  maxDrawdown?: number;
  lastRebalanceDate?: Date;
  nextRebalanceDate?: Date;
}

export class PerformanceResponseDto {
  portfolioId: string;
  timeRange: TimeRange;
  totalValue: number;
  returnPercentage: number;
  volatility: number;
  sharpeRatio: number;
  maxDrawdown: number;
  timestamp: Date;
  calculationDate: Date;
}

export class AllocationResponseDto {
  portfolioId: string;
  assets: Array<{
    ticker: string;
    name: string;
    quantity: number;
    currentPrice: number;
    value: number;
    percentage: number;
  }>;
  timestamp: Date;
  calculationDate: Date;
}

export class ComparisonResponseDto {
  portfolioId: string;
  timeRange: TimeRange;
  portfolioReturn: number;
  benchmarkReturn: number;
  outperformance: number;
  timestamp: Date;
  calculationDate: Date;
}
