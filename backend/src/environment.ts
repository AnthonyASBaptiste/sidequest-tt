export interface Environment {
  MONGODB_URI: string;
  MONGODB_DB_NAME?: string;
  PORT: number;
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

  const databaseName = environment.MONGODB_DB_NAME;
  if (databaseName !== undefined && typeof databaseName !== 'string') {
    throw new Error('MONGODB_DB_NAME must be a string when provided.');
  }

  return {
    MONGODB_URI: uri,
    MONGODB_DB_NAME: databaseName,
    PORT: port,
  };
}
