import { 
  Controller, 
  Get, 
  Post,
  HttpStatus, 
  HttpException
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { SkipKyc } from '../common/decorators/skip-kyc.decorator';
import { PerformanceBaselineService } from './performance-baseline.service';
import { RequestTimingMiddleware } from './request-timing.middleware';

@ApiTags('Observability')
@Controller('observability')
@Public()
@SkipKyc()
export class ObservabilityController {
  constructor(
    private readonly performanceBaselineService: PerformanceBaselineService,
    private readonly requestTimingMiddleware: RequestTimingMiddleware
  ) {}

  @Get('baselines')
  @ApiOperation({ 
    summary: 'Get performance baselines',
    description: 'Returns all established performance baselines for routes'
  })
  @ApiResponse({ status: 200, description: 'List of performance baselines' })
  getBaselines() {
    return this.performanceBaselineService.getBaselines();
  }

  @Get('regressions')
  @ApiOperation({ 
    summary: 'Get detected performance regressions',
    description: 'Returns all detected performance regressions'
  })
  @ApiResponse({ status: 200, description: 'List of performance regressions' })
  getRegressions() {
    return this.performanceBaselineService.getRegressions();
  }

  @Post('baselines/reset')
  @ApiOperation({ 
    summary: 'Reset performance baselines',
    description: 'Resets all performance baselines - useful after deployments'
  })
  @ApiResponse({ status: 200, description: 'Baselines reset successfully' })
  resetBaselines() {
    this.performanceBaselineService.resetBaselines();
    return { success: true, message: 'Performance baselines reset successfully' };
  }

  @Get('active-requests')
  @ApiOperation({ 
    summary: 'Get currently active requests',
    description: 'Returns all requests currently being processed with their timing data'
  })
  @ApiResponse({ status: 200, description: 'List of active requests' })
  getActiveRequests() {
    return this.requestTimingMiddleware.getActiveRequests().map(timing => ({
      requestId: timing.requestId,
      method: timing.method,
      path: timing.path,
      elapsedMs: Date.now() - timing.startTime,
      timings: timing.timings
    }));
  }

  @Get('memory/current')
  @ApiOperation({ 
    summary: 'Get current memory usage',
    description: 'Returns detailed current memory usage statistics'
  })
  @ApiResponse({ status: 200, description: 'Current memory usage' })
  getCurrentMemoryUsage() {
    const memoryUsage = process.memoryUsage();
    return {
      timestamp: new Date().toISOString(),
      memory: {
        rss: { bytes: memoryUsage.rss, mb: memoryUsage.rss / 1024 / 1024 },
        heapTotal: { bytes: memoryUsage.heapTotal, mb: memoryUsage.heapTotal / 1024 / 1024 },
        heapUsed: { bytes: memoryUsage.heapUsed, mb: memoryUsage.heapUsed / 1024 / 1024 },
        external: { bytes: memoryUsage.external, mb: memoryUsage.external / 1024 / 1024 },
        arrayBuffers: { bytes: memoryUsage.arrayBuffers, mb: memoryUsage.arrayBuffers / 1024 / 1024 }
      }
    };
  }
}