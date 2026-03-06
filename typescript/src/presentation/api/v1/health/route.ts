/**
 * @fileoverview Health Check API
 * @description Health check endpoint for monitoring
 */

import { NextResponse } from 'next/server';
import { dbConfig } from '../../../infrastructure';

interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  version: string;
  checks: {
    database: {
      status: 'up' | 'down';
      latency?: number;
    };
    memory: {
      used: number;
      total: number;
      percentage: number;
    };
  };
}

/**
 * GET /api/v1/health
 * Health check endpoint
 */
export async function GET(): Promise<NextResponse<HealthCheckResponse>> {
  const startTime = Date.now();

  // Check database
  let databaseStatus: 'up' | 'down' = 'down';
  let databaseLatency: number | undefined;

  try {
    const dbStart = Date.now();
    const isConnected = await dbConfig.isConnected();
    databaseLatency = Date.now() - dbStart;
    databaseStatus = isConnected ? 'up' : 'down';
  } catch {
    databaseStatus = 'down';
  }

  // Memory usage
  const memoryUsage = process.memoryUsage();
  const memoryTotal = memoryUsage.heapTotal;
  const memoryUsed = memoryUsage.heapUsed;

  const response: HealthCheckResponse = {
    status: databaseStatus === 'up' ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    checks: {
      database: {
        status: databaseStatus,
        latency: databaseLatency,
      },
      memory: {
        used: memoryUsed,
        total: memoryTotal,
        percentage: Math.round((memoryUsed / memoryTotal) * 100),
      },
    },
  };

  const statusCode = response.status === 'healthy' ? 200 : 503;

  return NextResponse.json(response, { status: statusCode });
}
