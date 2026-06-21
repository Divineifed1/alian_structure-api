
import { Module, CacheModule } from "@nestjs/common";
import { DashboardController } from "./dashboard.controller";
import { DashboardService } from "./dashboard.service";
import { PortfolioModule } from "src/investment/portfolio/portfolio.module";

@Module({
  imports: [
    CacheModule.register({
      ttl: 60, // cache for 60 seconds
    }),
    PortfolioModule
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}