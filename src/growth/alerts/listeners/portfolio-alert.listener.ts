import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { AlertDispatcherService } from "../services/alert-dispatcher.service";

@Injectable()
export class PortfolioAlertListener {
  constructor(private readonly dispatcher: AlertDispatcherService) {}

  @OnEvent("portfolio.rebalanced")
  async handle(payload: { userId: string; details: any }) {
    await this.dispatcher.dispatch(payload.userId, {
      type: "portfolio.rebalanced",
      ...payload.details,
    });
  }
}
