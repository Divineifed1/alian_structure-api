import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { AlertPreference } from "../entities/alert-preference.entity";
import { AlertTriggerLog } from "../entities/alert-trigger-log.entity";

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

@Injectable()
export class AlertDispatcherService {
  private readonly logger = new Logger(AlertDispatcherService.name);
  private readonly fingerprintMap = new Map<string, number>();
  private readonly rateLimitMap = new Map<string, RateLimitEntry>();

  constructor(
    @InjectRepository(AlertPreference)
    private readonly preferenceRepo: Repository<AlertPreference>,
    @InjectRepository(AlertTriggerLog)
    private readonly logRepo: Repository<AlertTriggerLog>,
  ) {}

  async dispatch(userId: string, payload: object): Promise<void> {
    const windowSlot = Math.floor(Date.now() / 300_000);
    const fingerprint = `${userId}:${JSON.stringify(payload)}:${windowSlot}`;

    if (this.fingerprintMap.has(fingerprint)) {
      this.logger.debug(`[Dedup] Skipping duplicate alert for user ${userId}`);
      return;
    }
    this.fingerprintMap.set(fingerprint, Date.now());

    const cutoff = Date.now() - 300_000;
    for (const [key, ts] of this.fingerprintMap.entries()) {
      if (ts < cutoff) this.fingerprintMap.delete(key);
    }

    const prefs = await this.preferenceRepo.findOne({ where: { userId } });
    const channels: string[] = prefs?.channels ?? ["in-app"];
    const rateLimit: number = prefs?.rateLimit ?? 10;
    const quietHoursStart: number | null = prefs?.quietHoursStart ?? null;
    const quietHoursEnd: number | null = prefs?.quietHoursEnd ?? null;

    const now = Date.now();
    const hourMs = 3_600_000;
    const entry = this.rateLimitMap.get(userId);

    if (entry && now - entry.windowStart < hourMs) {
      if (entry.count >= rateLimit) {
        this.logger.warn(
          `[RateLimit] User ${userId} has reached ${rateLimit} alerts/hour limit`,
        );
        return;
      }
      entry.count += 1;
    } else {
      this.rateLimitMap.set(userId, { count: 1, windowStart: now });
    }

    if (
      quietHoursStart !== null &&
      quietHoursEnd !== null &&
      this.isInQuietHours(quietHoursStart, quietHoursEnd)
    ) {
      this.logger.debug(
        `[QuietHours] Suppressing alert for user ${userId} during quiet hours`,
      );
      return;
    }

    for (const channel of channels) {
      await this.deliverToChannel(channel, userId, payload, 1);
    }
  }

  async deliverToChannel(
    channel: string,
    userId: string,
    payload: object,
    attempt: number,
  ): Promise<void> {
    try {
      if (channel === "in-app") {
        this.logger.log(
          `[In-App] Delivering alert to user ${userId}: ${JSON.stringify(payload)}`,
        );
        const log = this.logRepo.create({
          alertId: "dispatcher",
          userId,
          payload: { ...payload, channel: "in-app" } as Record<string, unknown>,
        });
        await this.logRepo.save(log);
      } else if (channel === "email") {
        this.logger.log(
          `[Email] Would send to user ${userId}: ${JSON.stringify(payload)}`,
        );
      } else if (channel === "websocket") {
        this.logger.log(
          `[WebSocket] Would push to user ${userId}: ${JSON.stringify(payload)}`,
        );
      } else {
        this.logger.warn(`[Dispatcher] Unknown channel: ${channel}`);
      }
    } catch (err) {
      if (attempt < 3) {
        const backoffMs = 200 * Math.pow(2, attempt - 1);
        this.logger.warn(
          `[Retry] Attempt ${attempt} failed for channel ${channel}, user ${userId}. Retrying in ${backoffMs}ms`,
        );
        await this.sleep(backoffMs);
        return this.deliverToChannel(channel, userId, payload, attempt + 1);
      }
      this.logger.error(
        `[Dispatcher] Failed to deliver via ${channel} for user ${userId} after 3 attempts: ${(err as Error).message}`,
      );
    }
  }

  private isInQuietHours(start: number, end: number): boolean {
    const currentHour = new Date().getHours();
    if (start <= end) {
      return currentHour >= start && currentHour < end;
    }
    return currentHour >= start || currentHour < end;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}