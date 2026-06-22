import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Portfolio } from "../entities/portfolio.entity";
import { PortfolioAsset } from "../entities/portfolio-asset.entity";
import {
  OptimizationHistory,
  OptimizationMethod,
  OptimizationStatus,
} from "../entities/optimization-history.entity";
import { RiskProfile } from "../entities/risk-profile.entity";
import { CreatePortfolioDto, UpdatePortfolioDto } from "../dto/portfolio.dto";
import { CreateOptimizationDto } from "../dto/optimization.dto";
import {
  PortfolioStatus,
  PortfolioType,
  AllocationStrategy,
} from "../entities/portfolio.entity";
import { ModernPortfolioTheory } from "../algorithms/modern-portfolio-theory";
import { BlackLittermanModel } from "../algorithms/black-litterman";
import { ConstraintOptimizer } from "../algorithms/constraint-optimizer";

@Injectable()
export class PortfolioService {
  private readonly logger = new Logger(PortfolioService.name);

  constructor(
    @InjectRepository(Portfolio)
    private portfolioRepository: Repository<Portfolio>,
    @InjectRepository(PortfolioAsset)
    private portfolioAssetRepository: Repository<PortfolioAsset>,
    @InjectRepository(OptimizationHistory)
    private optimizationRepository: Repository<OptimizationHistory>,
    @InjectRepository(RiskProfile)
    private riskProfileRepository: Repository<RiskProfile>,
  ) {}

  async createPortfolio(userId: string, dto: CreatePortfolioDto): Promise<Portfolio> {
    this.validatePortfolioName(dto.name);
    this.validateAllocation(dto.initialAllocation);

    const existingPortfolio = await this.portfolioRepository.findOne({
      where: { name: dto.name, userId },
    });

    if (existingPortfolio && !existingPortfolio.deletedAt) {
      throw new BadRequestException(
        "Portfolio with this name already exists",
      );
    }

    const portfolio = this.portfolioRepository.create({
      ...dto,
      userId,
      status: PortfolioStatus.ACTIVE,
      currentAllocation: {},
      targetAllocation: {},
      totalValue: dto.totalValue || 0,
      autoRebalanceEnabled: dto.autoRebalanceEnabled || false,
      rebalanceThreshold: dto.rebalanceThreshold || 5,
    });

    return this.portfolioRepository.save(portfolio);
  }

  async getPortfolio(portfolioId: string): Promise<Portfolio> {
    const portfolio = await this.portfolioRepository.findOne({
      where: { id: portfolioId },
      relations: ["assets", "optimizationHistory", "performanceMetrics"],
    });

    if (!portfolio || portfolio.deletedAt) {
      throw new NotFoundException("Portfolio not found");
    }

    return portfolio;
  }

  async getUserPortfolios(userId: string): Promise<Portfolio[]> {
    return this.portfolioRepository.find({
      where: { userId },
      relations: ["assets", "performanceMetrics"],
      order: { createdAt: "DESC" },
    });
  }

  async updatePortfolio(
    portfolioId: string,
    dto: UpdatePortfolioDto,
  ): Promise<Portfolio> {
    const portfolio = await this.getPortfolio(portfolioId);

    if (dto.name && dto.name !== portfolio.name) {
      this.validatePortfolioName(dto.name);
    }

    if (dto.initialAllocation) {
      this.validateAllocation(dto.initialAllocation);
      portfolio.initialAllocation = dto.initialAllocation;
    }

    if (dto.currentAllocation) {
      this.validateAllocation(dto.currentAllocation);
      portfolio.currentAllocation = dto.currentAllocation;
    }

    if (dto.targetAllocation) {
      this.validateAllocation(dto.targetAllocation);
      portfolio.targetAllocation = dto.targetAllocation;
    }

    if (dto.status === PortfolioStatus.ARCHIVED) {
      portfolio.status = PortfolioStatus.ARCHIVED;
      portfolio.deletedAt = new Date();
    } else if (dto.status) {
      portfolio.status = dto.status;
      if (dto.status === PortfolioStatus.ACTIVE) {
        portfolio.deletedAt = null;
      }
    }

    Object.assign(portfolio, dto);

    return this.portfolioRepository.save(portfolio);
  }

  async deletePortfolio(portfolioId: string): Promise<void> {
    const portfolio = await this.getPortfolio(portfolioId);
    portfolio.status = PortfolioStatus.ARCHIVED;
    portfolio.deletedAt = new Date();
    await this.portfolioRepository.save(portfolio);
  }

  async restorePortfolio(portfolioId: string): Promise<Portfolio> {
    const portfolio = await this.portfolioRepository.findOne({
      where: { id: portfolioId },
    });

    if (!portfolio || !portfolio.deletedAt) {
      throw new NotFoundException("Archived portfolio not found");
    }

    portfolio.status = PortfolioStatus.ACTIVE;
    portfolio.deletedAt = null;

    return this.portfolioRepository.save(portfolio);
  }

  private validatePortfolioName(name: string): void {
    if (!name || name.trim().length === 0) {
      throw new BadRequestException("Portfolio name cannot be empty");
    }

    if (name.length > 100) {
      throw new BadRequestException(
        "Portfolio name cannot exceed 100 characters",
      );
    }
  }

  private validateAllocation(allocation: Record<string, number>): void {
    if (!allocation) return;

    const tickers = Object.keys(allocation);

    if (tickers.length === 0) {
      throw new BadRequestException("Allocation cannot be empty");
    }

    if (tickers.length > 50) {
      throw new BadRequestException(
        "Allocation cannot contain more than 50 assets",
      );
    }

    const totalPercentage = Object.values(allocation).reduce(
      (sum, val) => sum + val,
      0,
    );

    if (Math.abs(totalPercentage - 100) > 0.01) {
      throw new BadRequestException(
        `Allocation percentages must sum to 100%, got ${totalPercentage.toFixed(2)}%`,
      );
    }

    for (const [ticker, percentage] of Object.entries(allocation)) {
      if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
        throw new BadRequestException(
          `Invalid allocation percentage ${percentage} for ${ticker}. Must be between 0 and 100`,
        );
      }
    }
  }

  async addAsset(
    portfolioId: string,
    ticker: string,
    name: string,
    quantity: number,
    currentPrice: number = 0,
    costBasis: number = 0,
  ): Promise<PortfolioAsset> {
    const portfolio = await this.getPortfolio(portfolioId);

    if (quantity <= 0) {
      throw new BadRequestException("Quantity must be positive");
    }

    if (currentPrice < 0) {
      throw new BadRequestException("Current price cannot be negative");
    }

    let asset = await this.portfolioAssetRepository.findOne({
      where: { portfolioId, ticker },
    });

    if (!asset) {
      asset = this.portfolioAssetRepository.create({
        portfolioId,
        ticker,
        name,
        quantity: 0,
        value: 0,
        allocationPercentage: 0,
        costBasis,
        costBasisPerShare: currentPrice,
      });
    }

    asset.quantity = quantity;
    asset.currentPrice = currentPrice;
    asset.value = quantity * currentPrice;

    asset = await this.portfolioAssetRepository.save(asset);

    await this.updatePortfolioAllocation(portfolioId);

    return asset;
  }

  async updateAssetPrice(
    assetId: string,
    currentPrice: number,
  ): Promise<PortfolioAsset> {
    const asset = await this.portfolioAssetRepository.findOne({
      where: { id: assetId },
    });

    if (!asset) {
      throw new NotFoundException("Asset not found");
    }

    if (currentPrice < 0) {
      throw new BadRequestException("Price cannot be negative");
    }

    asset.currentPrice = currentPrice;
    asset.value = asset.quantity * currentPrice;
    asset.lastPriceUpdate = new Date();

    const updated = await this.portfolioAssetRepository.save(asset);

    await this.updatePortfolioAllocation(asset.portfolioId);

    return updated;
  }

  async updatePortfolioAllocation(portfolioId: string): Promise<void> {
    const portfolio = await this.getPortfolio(portfolioId);
    const assets = await this.portfolioAssetRepository.find({
      where: { portfolioId },
    });

    let totalValue = 0;
    for (const asset of assets) {
      totalValue += asset.value || 0;
    }

    portfolio.totalValue = totalValue;

    const allocation: Record<string, number> = {};

    for (const asset of assets) {
      const percentage = totalValue > 0 ? (asset.value / totalValue) * 100 : 0;
      asset.allocationPercentage = percentage;
      allocation[asset.ticker] = percentage;
    }

    portfolio.currentAllocation = allocation;

    await this.portfolioRepository.save(portfolio);
    await this.portfolioAssetRepository.save(assets);
  }

  async runOptimization(
    portfolioId: string,
    dto: CreateOptimizationDto,
  ): Promise<OptimizationHistory> {
    const portfolio = await this.getPortfolio(portfolioId);
    const assets = await this.portfolioAssetRepository.find({
      where: { portfolioId },
    });

    if (assets.length === 0) {
      throw new BadRequestException("Portfolio has no assets to optimize");
    }

    const optimization = this.optimizationRepository.create({
      portfolioId,
      method: dto.method,
      status: OptimizationStatus.IN_PROGRESS,
      parameters: dto.parameters || {},
      suggestedAllocation: {},
      currentAllocation: portfolio.currentAllocation,
    });

    let result = await this.optimizationRepository.save(optimization);

    try {
      const expectedReturns = assets.map((a) => a.expectedReturn || 0.07);
      const volatilities = assets.map((a) => a.volatility || 0.15);

      const correlationMatrix = this.generateCorrelationMatrix(assets.length);

      const covarianceMatrix = ModernPortfolioTheory.calculateCovarianceMatrix(
        volatilities,
        correlationMatrix,
      );

      let suggestedWeights: number[] = [];

      switch (dto.method) {
        case OptimizationMethod.MEAN_VARIANCE:
          suggestedWeights = ModernPortfolioTheory.meanVarianceOptimization(
            expectedReturns,
            covarianceMatrix,
          );
          break;

        case OptimizationMethod.MIN_VARIANCE:
          suggestedWeights =
            ModernPortfolioTheory.minVarianceOptimization(covarianceMatrix);
          break;

        case OptimizationMethod.RISK_PARITY:
          suggestedWeights =
            ModernPortfolioTheory.riskParityOptimization(covarianceMatrix);
          break;

        case OptimizationMethod.MAX_SHARPE:
          suggestedWeights = ModernPortfolioTheory.meanVarianceOptimization(
            expectedReturns,
            covarianceMatrix,
            {},
            0.02,
          );
          break;

        default:
          suggestedWeights = new Array(assets.length).fill(1 / assets.length);
      }

      const suggestedAllocation: Record<string, number> = {};
      for (let i = 0; i < assets.length; i++) {
        suggestedAllocation[assets[i].ticker] = suggestedWeights[i] * 100;
        assets[i].suggestedAllocation = suggestedWeights[i] * 100;
      }

      const metrics = ModernPortfolioTheory.calculatePortfolioMetrics(
        suggestedWeights,
        expectedReturns,
        covarianceMatrix,
      );

      const currentReturn = 0;
      const currentVolatility = 0;

      const currentWeights = assets.map(
        (a) => (a.allocationPercentage || 0) / 100,
      );

      const currentMetrics = ModernPortfolioTheory.calculatePortfolioMetrics(
        currentWeights,
        expectedReturns,
        covarianceMatrix,
      );

      const improvementScore =
        currentMetrics.volatility > 0
          ? ((currentMetrics.volatility - metrics.volatility) /
              currentMetrics.volatility) *
            100
          : 0;

      result.status = OptimizationStatus.COMPLETED;
      result.suggestedAllocation = suggestedAllocation;
      result.expectedReturn = metrics.expectedReturn;
      result.expectedVolatility = metrics.volatility;
      result.expectedSharpeRatio = metrics.sharpeRatio;
      result.improvementScore = improvementScore;
      result.completedAt = new Date();

      result = await this.optimizationRepository.save(result);

      await this.portfolioAssetRepository.save(assets);

      this.logger.log(`Optimization completed for portfolio ${portfolioId}`);

      return result;
    } catch (error) {
      this.logger.error(`Optimization failed: ${error.message}`);
      result.status = OptimizationStatus.FAILED;
      result.errorMessage = error.message;
      await this.optimizationRepository.save(result);
      throw error;
    }
  }

  private generateCorrelationMatrix(size: number): number[][] {
    const matrix: number[][] = [];

    for (let i = 0; i < size; i++) {
      matrix[i] = [];
      for (let j = 0; j < size; j++) {
        if (i === j) {
          matrix[i][j] = 1;
        } else {
          matrix[i][j] = 0.5 + Math.random() * 0.2;
        }
      }
    }

    return matrix;
  }

  async approveOptimization(
    optimizationId: string,
    notes?: string,
  ): Promise<OptimizationHistory> {
    const optimization = await this.optimizationRepository.findOne({
      where: { id: optimizationId },
    });

    if (!optimization) {
      throw new NotFoundException("Optimization not found");
    }

    if (optimization.status !== OptimizationStatus.COMPLETED) {
      throw new BadRequestException(
        "Only completed optimizations can be approved",
      );
    }

    optimization.status = OptimizationStatus.APPROVED;
    if (notes) optimization.notes = notes;

    return this.optimizationRepository.save(optimization);
  }

  async implementOptimization(optimizationId: string): Promise<Portfolio> {
    const optimization = await this.optimizationRepository.findOne({
      where: { id: optimizationId },
    });

    if (!optimization) {
      throw new NotFoundException("Optimization not found");
    }

    if (optimization.status !== OptimizationStatus.APPROVED) {
      throw new BadRequestException(
        "Only approved optimizations can be implemented",
      );
    }

    const portfolio = await this.getPortfolio(optimization.portfolioId);

    portfolio.targetAllocation = optimization.suggestedAllocation;
    portfolio.lastRebalanceDate = new Date();

    optimization.status = OptimizationStatus.IMPLEMENTED;
    optimization.implementedAt = new Date();

    await this.optimizationRepository.save(optimization);

    return this.portfolioRepository.save(portfolio);
  }

  async getOptimizationHistory(
    portfolioId: string,
    limit: number = 10,
  ): Promise<OptimizationHistory[]> {
    return this.optimizationRepository.find({
      where: { portfolioId },
      order: { createdAt: "DESC" },
      take: limit,
    });
  }
}
