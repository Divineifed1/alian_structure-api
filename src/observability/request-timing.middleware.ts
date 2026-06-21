import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { trace, Span, SpanStatusCode } from '@opentelemetry/api';
import { createSpan } from '../config/tracing';

export interface RequestTiming {
  requestId: string;
  method: string;
  path: string;
  startTime: number;
  timings: {
    middlewareStart: number;
    middlewareEnd: number;
    routeHandlerStart: number;
    routeHandlerEnd: number;
    databaseStart?: number;
    databaseEnd?: number;
    totalDuration: number;
  };
  span?: Span;
}

@Injectable()
export class RequestTimingMiddleware implements NestMiddleware {
  private activeRequests: Map<string, RequestTiming> = new Map();

  use(req: Request, res: Response, next: NextFunction) {
    const headerRequestId = req.headers['x-request-id'];
    const requestId: string = Array.isArray(headerRequestId) ? headerRequestId[0] : (headerRequestId || Math.random().toString(36).substring(7));
    const startTime = Date.now();
    
    const timing: RequestTiming = {
      requestId,
      method: req.method,
      path: req.path,
      startTime,
      timings: {
        middlewareStart: startTime,
        middlewareEnd: 0,
        routeHandlerStart: 0,
        routeHandlerEnd: 0,
        totalDuration: 0
      }
    };

    this.activeRequests.set(requestId, timing);

    // Add timing to request object for use in other parts of the application
    (req as any).requestTiming = timing;
    (req as any).startDatabaseTimer = this.startDatabaseTimer.bind(this, requestId);
    (req as any).endDatabaseTimer = this.endDatabaseTimer.bind(this, requestId);

    // Create OpenTelemetry span for this request
    createSpan(`HTTP ${req.method} ${req.path}`, async (span) => {
      timing.span = span;
      span.setAttribute('http.method', req.method);
      span.setAttribute('http.path', req.path);
      span.setAttribute('request.id', requestId);

      // Track when the request finishes
      res.on('finish', () => {
        const endTime = Date.now();
        timing.timings.routeHandlerEnd = endTime;
        timing.timings.totalDuration = endTime - startTime;
        
        // Add all timings as span attributes
        span.setAttribute('timings.middleware_duration', timing.timings.middlewareEnd - timing.timings.middlewareStart);
        span.setAttribute('timings.handler_duration', timing.timings.routeHandlerEnd - timing.timings.routeHandlerStart);
        span.setAttribute('timings.total_duration', timing.timings.totalDuration);
        
        if (timing.timings.databaseEnd && timing.timings.databaseStart) {
          span.setAttribute('timings.database_duration', timing.timings.databaseEnd - timing.timings.databaseStart);
        }

        // Add response status code
        span.setAttribute('http.status_code', res.statusCode);
        if (res.statusCode >= 400) {
          span.setStatus({ code: SpanStatusCode.ERROR });
        } else {
          span.setStatus({ code: SpanStatusCode.OK });
        }

        // Log the timing data for analysis
        this.logRequestTiming(timing);
        
        // Cleanup
        this.activeRequests.delete(requestId);
      });

      // Continue to the next middleware/handler
      timing.timings.middlewareEnd = Date.now();
      timing.timings.routeHandlerStart = Date.now();
      next();
    });
  }

  private startDatabaseTimer(requestId: string) {
    const timing = this.activeRequests.get(requestId);
    if (timing) {
      timing.timings.databaseStart = Date.now();
    }
  }

  private endDatabaseTimer(requestId: string, operation?: string, table?: string) {
    const timing = this.activeRequests.get(requestId);
    if (timing && timing.timings.databaseStart) {
      timing.timings.databaseEnd = Date.now();
      const duration = timing.timings.databaseEnd - timing.timings.databaseStart;
      
      // Add database operation details to the span if available
      if (timing.span && operation && table) {
        timing.span.addEvent(`database.${operation}`, {
          'db.operation': operation,
          'db.table': table,
          'db.duration': duration
        });
      }
    }
  }

  private logRequestTiming(timing: RequestTiming) {
    const { requestId, method, path, timings } = timing;
    const databaseDuration = timings.databaseEnd && timings.databaseStart 
      ? timings.databaseEnd - timings.databaseStart 
      : 0;

    // Log with structured data for easy parsing
    console.log(JSON.stringify({
      type: 'request_timing',
      timestamp: new Date().toISOString(),
      requestId,
      method,
      path,
      timings: {
        middleware: timings.middlewareEnd - timings.middlewareStart,
        handler: timings.routeHandlerEnd - timings.routeHandlerStart,
        database: databaseDuration,
        total: timings.totalDuration
      },
      // Waterfall timings for visualization
      waterfall: {
        middleware: [timings.middlewareStart - timing.startTime, timings.middlewareEnd - timing.startTime],
        handler: [timings.routeHandlerStart - timing.startTime, timings.routeHandlerEnd - timing.startTime],
        database: timings.databaseStart && timings.databaseEnd 
          ? [timings.databaseStart - timing.startTime, timings.databaseEnd - timing.startTime]
          : null
      }
    }));
  }

  // Helper to get all active requests for monitoring
  getActiveRequests(): RequestTiming[] {
    return Array.from(this.activeRequests.values());
  }
}