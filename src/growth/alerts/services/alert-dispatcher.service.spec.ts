import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { AlertDispatcherService } from "./alert-dispatcher.service";
import { AlertPreference } from "../entities/alert-preference.entity";
import { AlertTriggerLog } from "../entities/alert-trigger-log.entity";

const makeRepo = <T>(
  overrides: Partial<Repository<T>> = {},
): Partial<Repository<T>> => ({
  findOne: jest.fn().mockResolvedValue(null),
  create: jest.fn().mockImplementation((entity) => entity),
  save: jest
    .fn()
    .mockImplementation((entity) =>
      Promise.resolve({ id: "log-id", ...entity }),
    ),
  ...overrides,
});

describe("AlertDispatcherService", () => {
  let service: AlertDispatcherService;
  let preferenceRepo: jest.Mocked<Repository<AlertPreference>>;
  let logRepo: jest.Mocked<Repository<AlertTriggerLog>>;

  beforeEach(async () => {
    const prefRepoMock = makeRepo<AlertPreference>();
    const logRepoMock = makeRepo<AlertTriggerLog>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlertDispatcherService,
        { provide: getRepositoryToken(AlertPreference), useValue: prefRepoMock },
        { provide: getRepositoryToken(AlertTriggerLog), useValue: logRepoMock },
      ],
    }).compile();

    service = module.get<AlertDispatcherService>(AlertDispatcherService);
    preferenceRepo = module.get(getRepositoryToken(AlertPreference));
    logRepo = module.get(getRepositoryToken(AlertTriggerLog));
  });

  afterEach(() => {
    jest.clearAllMocks();
    (service as any).fingerprintMap.clear();
    (service as any).rateLimitMap.clear();
  });

  describe("dispatch - deduplication", () => {
    it("should deliver the first alert normally", async () => {
      const saveSpy = logRepo.save as jest.Mock;
      await service.dispatch("user-1", { type: "risk.threshold.breached", asset: "BTC" });
      expect(saveSpy).toHaveBeenCalledTimes(1);
    });

    it("should skip a duplicate alert within the 5-minute window", async () => {
      const payload = { type: "risk.threshold.breached", asset: "BTC" };
      await service.dispatch("user-1", payload);
      await service.dispatch("user-1", payload);
      const saveSpy = logRepo.save as jest.Mock;
      expect(saveSpy).toHaveBeenCalledTimes(1);
    });

    it("should allow a different user to receive the same payload", async () => {
      const payload = { type: "risk.threshold.breached", asset: "BTC" };
      await service.dispatch("user-1", payload);
      await service.dispatch("user-2", payload);
      const saveSpy = logRepo.save as jest.Mock;
      expect(saveSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe("dispatch - rate limiting", () => {
    it("should skip alert after exceeding the default rate limit of 10 per hour", async () => {
      const saveSpy = logRepo.save as jest.Mock;
      for (let i = 0; i < 11; i++) {
        await service.dispatch("user-rl", { type: "alert", index: i });
      }
      expect(saveSpy).toHaveBeenCalledTimes(10);
    });

    it("should respect a custom rateLimit from user preferences", async () => {
      (preferenceRepo.findOne as jest.Mock).mockResolvedValue({
        channels: ["in-app"],
        rateLimit: 3,
        quietHoursStart: null,
        quietHoursEnd: null,
      } as Partial<AlertPreference>);
      const saveSpy = logRepo.save as jest.Mock;
      for (let i = 0; i < 5; i++) {
        await service.dispatch("user-custom-rl", { type: "alert", index: i });
      }
      expect(saveSpy).toHaveBeenCalledTimes(3);
    });
  });

  describe("dispatch - in-app channel delivery", () => {
    it("should store an AlertTriggerLog with channel=in-app", async () => {
      const createSpy = logRepo.create as jest.Mock;
      const saveSpy = logRepo.save as jest.Mock;
      await service.dispatch("user-inapp", { type: "portfolio.rebalanced" });
      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-inapp",
          payload: expect.objectContaining({ channel: "in-app" }),
        }),
      );
      expect(saveSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("deliverToChannel - retry on failure", () => {
    it("should retry up to 3 times on error and then stop", async () => {
      (logRepo.save as jest.Mock).mockRejectedValue(new Error("DB error"));
      const deliverSpy = jest.spyOn(service, "deliverToChannel");
      await service.deliverToChannel("in-app", "user-retry", { type: "test" }, 1);
      expect(deliverSpy).toHaveBeenCalledTimes(3);
      expect(deliverSpy).toHaveBeenNthCalledWith(1, "in-app", "user-retry", expect.any(Object), 1);
      expect(deliverSpy).toHaveBeenNthCalledWith(2, "in-app", "user-retry", expect.any(Object), 2);
      expect(deliverSpy).toHaveBeenNthCalledWith(3, "in-app", "user-retry", expect.any(Object), 3);
    });

    it("should not retry beyond attempt 3", async () => {
      (logRepo.save as jest.Mock).mockRejectedValue(new Error("Persistent error"));
      const deliverSpy = jest.spyOn(service, "deliverToChannel");
      await service.deliverToChannel("in-app", "user-no-more-retry", { type: "test" }, 3);
      expect(deliverSpy).toHaveBeenCalledTimes(1);
    });
  });
});
