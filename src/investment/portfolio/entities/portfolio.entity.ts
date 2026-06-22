import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from "typeorm";
import { PortfolioAsset } from "./portfolio-asset.entity";
import { OptimizationHistory } from "./optimization-history.entity";
import { RebalancingEvent } from "./rebalancing-event.entity";
import { PerformanceMetric } from "./performance-metric.entity";
import { User } from "src/core/user/entities/user.entity";

export enum PortfolioStatus {
  ACTIVE = "active",
  INACTIVE = "inactive",
  ARCHIVED = "archived",
}

export enum PortfolioType {
  CONSERVATIVE = "conservative",
  BALANCED = "balanced",
  AGGRESSIVE = "aggressive",
  INCOME = "income",
  GROWTH = "growth",
  RETIREMENT = "retirement",
  CUSTOM = "custom",
}

export enum AllocationStrategy {
  MANUAL = "manual",
  MODERN_PORTFOLIO_THEORY = "modern_portfolio_theory",
  BLACK_LITTERMAN = "black_litterman",
  RISK_PARITY = "risk_parity",
  MIN_VARIANCE = "min_variance",
  MAX_SHARPE = "max_sharpe",
  CUSTOM = "custom",
}

@Entity("portfolios")
@Index(["userId", "status"])
export class Portfolio {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ unique: true })
  name: string;

  @Column({
    type: "enum",
    enum: PortfolioType,
    default: PortfolioType.CUSTOM,
  })
  type: PortfolioType;

  @Column({ type: "text", nullable: true })
  description: string;

  @Column({
    type: "enum",
    enum: PortfolioStatus,
    default: PortfolioStatus.ACTIVE,
  })
  status: PortfolioStatus;

  @Column({ type: "jsonb", default: {} })
  initialAllocation: Record<string, number>;

  @Column({ type: "enum", enum: AllocationStrategy, default: AllocationStrategy.MANUAL, nullable: true })
  allocationStrategy: AllocationStrategy;

  @Column({ type: "decimal", precision: 18, scale: 2, default: 0 })
  totalValue: number;

  @Column({ type: "jsonb", default: {} })
  currentAllocation: Record<string, number>;

  @Column({ type: "jsonb", nullable: true })
  targetAllocation: Record<string, number>;

  @Column({ type: "jsonb", nullable: true })
  metadata: Record<string, any>;

  @Column({ type: "boolean", default: false })
  autoRebalanceEnabled: boolean;

  @Column({ type: "varchar", nullable: true })
  rebalanceFrequency: "daily" | "weekly" | "monthly" | "quarterly" | null;

  @Column({ type: "decimal", precision: 5, scale: 2, default: 5 })
  rebalanceThreshold: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn({ nullable: true })
  deletedAt: Date;

  @Column({ nullable: true })
  lastRebalanceDate: Date;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  user: User;

  @Column("uuid")
  userId: string;

  @OneToMany(() => PortfolioAsset, (asset) => asset.portfolio, {
    cascade: true,
  })
  assets: PortfolioAsset[];

  @OneToMany(() => OptimizationHistory, (history) => history.portfolio, {
    cascade: true,
  })
  optimizationHistory: OptimizationHistory[];

  @OneToMany(() => RebalancingEvent, (event) => event.portfolio, {
    cascade: true,
  })
  rebalancingEvents: RebalancingEvent[];

  @OneToMany(() => PerformanceMetric, (metric) => metric.portfolio, {
    cascade: true,
  })
  performanceMetrics: PerformanceMetric[];
}
