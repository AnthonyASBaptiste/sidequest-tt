export interface Environment {
  MONGODB_URI: string;
  MONGODB_DB_NAME?: string;
  PORT: number;
  FRONTEND_ORIGIN?: string;
  VERIFICATION_WORKER_SECRET?: string;
  VERIFICATION_LEASE_SECONDS: number;
}

export function validateEnvironment(
  environment: Record<string, unknown>,
): Environment {
  const uri = environment.MONGODB_URI;
  if (typeof uri !== 'string' || uri.trim().length === 0) {
    throw new Error('MONGODB_URI must be configured.');
  }

  if (!/^mongodb(?:\+srv)?:\/\//.test(uri)) {
    throw new Error('MONGODB_URI must use the mongodb:// or mongodb+srv:// scheme.');
  }

  const portValue = environment.PORT ?? '3000';
  const port = Number(portValue);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }

  const databaseName = environment.MONGODB_DB_NAME ?? 'sidequest';
  if (typeof databaseName !== 'string' || databaseName.trim().length === 0) {
    throw new Error('MONGODB_DB_NAME must be a non-empty string when provided.');
  }

  const rawFrontendOrigin = environment.FRONTEND_ORIGIN;
  let frontendOrigin: string | undefined;
  if (rawFrontendOrigin !== undefined && rawFrontendOrigin !== '') {
    if (typeof rawFrontendOrigin !== 'string') {
      throw new Error('FRONTEND_ORIGIN must be a single exact origin.');
    }

    const normalizedFrontendOrigin = rawFrontendOrigin.trim().replace(/\/+$/, '');
    let parsedOrigin: URL;
    try {
      parsedOrigin = new URL(normalizedFrontendOrigin);
    } catch {
      throw new Error('FRONTEND_ORIGIN must be a valid exact origin.');
    }

    if (
      parsedOrigin.origin !== normalizedFrontendOrigin ||
      parsedOrigin.username ||
      parsedOrigin.password
    ) {
      throw new Error('FRONTEND_ORIGIN must be a single exact origin without a path.');
    }
    frontendOrigin = parsedOrigin.origin;
  }

  const workerSecret = environment.VERIFICATION_WORKER_SECRET;
  if (
    workerSecret !== undefined &&
    (typeof workerSecret !== 'string' ||
      workerSecret.trim().length < 32 ||
      workerSecret.trim() !== workerSecret)
  ) {
    throw new Error(
      'VERIFICATION_WORKER_SECRET must contain at least 32 characters when provided.',
    );
  }

  const leaseSeconds = Number(environment.VERIFICATION_LEASE_SECONDS ?? 120);
  if (!Number.isInteger(leaseSeconds) || leaseSeconds < 30 || leaseSeconds > 3600) {
    throw new Error(
      'VERIFICATION_LEASE_SECONDS must be an integer between 30 and 3600.',
    );
  }

  return {
    MONGODB_URI: uri,
    MONGODB_DB_NAME: databaseName,
    PORT: port,
    FRONTEND_ORIGIN: frontendOrigin,
    VERIFICATION_WORKER_SECRET: workerSecret,
    VERIFICATION_LEASE_SECONDS: leaseSeconds,
  };
}
