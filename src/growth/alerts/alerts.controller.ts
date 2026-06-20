import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from "@nestjs/swagger";
import { AlertsService } from "./alerts.service";
import { CreatePriceAlertDto, CreatePortfolioAlertDto } from "./dto/alert.dto";
import { SubscribeAlertDto } from "./dto/alert-preference.dto";
import { JwtAuthGuard } from "src/core/auth/jwt.guard";

@ApiTags("Alerts")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("api/alerts")
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Post("price")
  @ApiOperation({ summary: "Create a price alert" })
  @ApiResponse({ status: 201, description: "Price alert created successfully" })
  createPriceAlert(@Body() dto: CreatePriceAlertDto) {
    return this.alertsService.createPriceAlert(dto);
  }

  @Post("portfolio")
  @ApiOperation({ summary: "Create a portfolio alert" })
  @ApiResponse({ status: 201, description: "Portfolio alert created" })
  createPortfolioAlert(@Body() dto: CreatePortfolioAlertDto) {
    return this.alertsService.createPortfolioAlert(dto);
  }

  @Get()
  @ApiOperation({ summary: "Get all active alerts for a user" })
  @ApiResponse({ status: 200, description: "List of active alerts" })
  getUserAlerts(@Query("userId") userId: string) {
    return this.alertsService.getUserAlerts(userId);
  }

  @Delete(":alertId")
  @ApiOperation({ summary: "Delete (deactivate) an alert by ID" })
  @ApiResponse({ status: 200, description: "Alert deactivated" })
  deleteAlert(@Param("alertId") alertId: string) {
    return this.alertsService.deleteAlert(alertId);
  }

  @Get("history")
  @ApiOperation({ summary: "Get alert trigger history for a user" })
  @ApiResponse({ status: 200, description: "Alert trigger history" })
  getAlertHistory(@Query("userId") userId: string) {
    return this.alertsService.getAlertHistory(userId);
  }

  @Post("subscribe")
  @ApiOperation({
    summary: "Subscribe to alert notifications",
    description: "Create or update alert delivery preferences. Supports in-app, email, websocket channels with quiet hours and rate limiting.",
  })
  @ApiResponse({ status: 201, description: "Alert preference saved successfully" })
  subscribe(@Body() dto: SubscribeAlertDto) {
    return this.alertsService.savePreference(dto);
  }

  @Delete("unsubscribe/:userId")
  @ApiOperation({
    summary: "Unsubscribe from alert notifications",
    description: "Remove alert delivery preferences for a user.",
  })
  @ApiResponse({ status: 200, description: "Alert preference removed" })
  unsubscribe(@Param("userId") userId: string) {
    return this.alertsService.deletePreference(userId);
  }

  @Get("preferences/:userId")
  @ApiOperation({ summary: "Get alert preferences for a user" })
  @ApiResponse({ status: 200, description: "User alert preferences" })
  getPreferences(@Param("userId") userId: string) {
    return this.alertsService.getPreference(userId);
  }
}
