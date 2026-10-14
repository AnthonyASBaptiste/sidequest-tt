import { resolve } from 'node:path';

export class InvalidModelOutputError extends Error {}
export class ModelTimeoutError extends Error {}
export class ModelUnavailableError extends Error {}

export function ensureEnvLoaded() {
  if (typeof process.loadEnvFile !== 'function') {
    return;
  }
  const candidatePaths = [
    'worker/.env',
    '.env',
    '../.env',
    resolve(import.meta.dirname, '.env'),
    resolve(import.meta.dirname, '../.env'),
  ];
  for (const envPath of candidatePaths) {
    try {
      process.loadEnvFile(envPath);
    } catch {
      // Ignore if file does not exist or was already parsed
    }
  }
}

export function loadRuntimeConfig(environment = process.env) {
  ensureEnvLoaded();

  const apiBaseUrl = parseApiBaseUrl(environment.API_BASE_URL, 'API_BASE_URL');
  const workerSecret = environment.VERIFICATION_WORKER_SECRET;
  if (typeof workerSecret !== 'string' || workerSecret.trim().length < 32) {
    throw new Error(
      'VERIFICATION_WORKER_SECRET must be configured with at least 32 characters.',
    );
  }

  const nvidiaApiKey = environment.NVIDIA_API_KEY?.trim();
  const hasNvidiaKey = Boolean(nvidiaApiKey && nvidiaApiKey.length > 0);
  const provider = hasNvidiaKey ? 'nvidia' : 'ollama';

  let gemmaModel;
  let baseUrl;

  if (provider === 'nvidia') {
    const rawModel =
      environment.GEMMA_MODEL ||
      environment.NVIDIA_MODEL ||
      'google/gemma-4-31b-it';
    gemmaModel = rawModel.trim();
    if (gemmaModel.length === 0) {
      throw new Error('GEMMA_MODEL must not be empty.');
    }

    const rawBaseUrl =
      environment.NVIDIA_BASE_URL ||
      environment.GEMMA_BASE_URL ||
      'https://integrate.api.nvidia.com/v1';
    baseUrl = parseRuntimeUrl(rawBaseUrl, 'NVIDIA_BASE_URL');
  } else {
    if (
      typeof environment.GEMMA_MODEL !== 'string' ||
      environment.GEMMA_MODEL.trim().length === 0
    ) {
      throw new Error(
        'GEMMA_MODEL must name a model available in the local runtime (or configure NVIDIA_API_KEY).',
      );
    }
    gemmaModel = environment.GEMMA_MODEL.trim();
    baseUrl = parseRuntimeUrl(environment.GEMMA_BASE_URL, 'GEMMA_BASE_URL');
  }

  const leaseSeconds = readInteger(
    environment.VERIFICATION_LEASE_SECONDS,
    'VERIFICATION_LEASE_SECONDS',
    120,
    30,
    3600,
  );
  const apiTimeoutMs = readInteger(
    environment.WORKER_API_TIMEOUT_MS,
    'WORKER_API_TIMEOUT_MS',
    10000,
    1000,
    120000,
  );
  const modelTimeoutMs = readInteger(
    environment.WORKER_MODEL_TIMEOUT_MS,
    'WORKER_MODEL_TIMEOUT_MS',
    75000,
    1000,
    600000,
  );
  const pollIntervalMs = readInteger(
    environment.WORKER_POLL_INTERVAL_MS,
    'WORKER_POLL_INTERVAL_MS',
    5000,
    250,
    60000,
  );
  const visionModel = (environment.VISION_MODEL || 'meta/llama-3.2-11b-vision-instruct').trim();
  const serpApiKey = (environment.SERPAPI_API_KEY || '').trim();
  const tavilyApiKey = (environment.TAVILY_API_KEY || '').trim();

  return {
    provider,
    apiBaseUrl,
    workerSecret,
    gemmaModel,
    visionModel,
    serpApiKey,
    tavilyApiKey,
    baseUrl,
    nvidiaApiKey,
    leaseSeconds,
    apiTimeoutMs,
    modelTimeoutMs,
    pollIntervalMs,
  };
}

export async function requestGemmaChat({
  config,
  messages,
  temperature = 0.2,
  maxTokens = 4096,
  schema = null,
  modelOverride = null,
  timeoutMs = null,
}) {
  if (config.provider === 'nvidia') {
    return requestNvidiaChat({
      config,
      messages,
      temperature,
      maxTokens,
      modelOverride,
      timeoutMs,
    });
  }
  return requestOllamaChat({
    config,
    messages,
    temperature,
    schema,
    timeoutMs,
  });
}

async function requestNvidiaChat({
  config,
  messages,
  temperature,
  maxTokens,
  modelOverride = null,
  timeoutMs = null,
}) {
  const endpoint = getOpenAiCompletionsEndpoint(config.baseUrl);
  const model = modelOverride || config.gemmaModel;
  const timeout = timeoutMs || config.modelTimeoutMs;
  let response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${config.nvidiaApiKey}`,
      },
      redirect: 'error',
      signal: AbortSignal.timeout(timeout),
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
        stream: false,
        response_format: { type: 'json_object' },
      }),
    });
  } catch (error) {
    if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
      throw new ModelTimeoutError(
        'NVIDIA API timed out while awaiting model completion.',
      );
    }
    throw new ModelUnavailableError(
      `The NVIDIA API endpoint could not be reached: ${error?.message || error}`,
    );
  }

  if (!response.ok) {
    if (response.status === 401) {
      throw new ModelUnavailableError(
        'NVIDIA API authentication failed (HTTP 401). Verify that NVIDIA_API_KEY is valid.',
      );
    }
    if (response.status === 429) {
      throw new ModelUnavailableError(
        'NVIDIA API rate limit reached (HTTP 429). The request will be retried.',
      );
    }
    throw new ModelUnavailableError(
      `NVIDIA API returned HTTP ${response.status}.`,
    );
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw new InvalidModelOutputError(
      'NVIDIA API returned a response that was not valid JSON.',
    );
  }

  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || content.trim().length === 0) {
    throw new InvalidModelOutputError(
      'NVIDIA API response did not contain message content.',
    );
  }

  return cleanJsonContent(content);
}

async function requestOllamaChat({
  config,
  messages,
  temperature,
  schema,
}) {
  let response;
  try {
    response = await fetch(new URL('/api/chat', config.baseUrl), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      redirect: 'error',
      signal: AbortSignal.timeout(config.modelTimeoutMs),
      body: JSON.stringify({
        model: config.gemmaModel,
        stream: false,
        format: schema,
        options: { temperature },
        messages,
      }),
    });
  } catch (error) {
    if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
      throw new ModelTimeoutError(
        'Local Gemma runtime timed out while processing request.',
      );
    }
    throw new ModelUnavailableError(
      'The local Gemma runtime could not be reached.',
    );
  }

  if (!response.ok) {
    throw new ModelUnavailableError(
      `Local Gemma runtime returned HTTP ${response.status}.`,
    );
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw new InvalidModelOutputError(
      'Local Gemma runtime returned an invalid JSON response.',
    );
  }

  const content = data?.message?.content;
  if (typeof content !== 'string') {
    throw new InvalidModelOutputError(
      'Local Gemma response did not contain structured message content.',
    );
  }

  return cleanJsonContent(content);
}

export function cleanJsonContent(rawContent) {
  if (typeof rawContent !== 'string') {
    throw new InvalidModelOutputError('Model content must be a string.');
  }
  let text = rawContent.trim();
  if (text.startsWith('```')) {
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  }
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    text = text.slice(firstBrace, lastBrace + 1);
  }
  return text;
}

function getOpenAiCompletionsEndpoint(baseUrl) {
  const originStr = baseUrl.origin;
  let pathStr = baseUrl.pathname.replace(/\/$/, '');
  if (!pathStr.endsWith('/chat/completions')) {
    if (pathStr.endsWith('/v1')) {
      pathStr = `${pathStr}/chat/completions`;
    } else if (pathStr === '' || pathStr === '/') {
      pathStr = '/v1/chat/completions';
    } else {
      pathStr = `${pathStr}/chat/completions`;
    }
  }
  return new URL(pathStr, originStr);
}

function parseApiBaseUrl(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${name} must be configured.`);
  }
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid URL.`);
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error(`${name} must be an HTTP(S) URL without credentials.`);
  }
  if (
    url.protocol !== 'https:' &&
    !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  ) {
    throw new Error(`${name} must use HTTPS except for loopback development.`);
  }
  if (url.pathname !== '/' || url.search || url.hash) {
    throw new Error(`${name} must be an origin without a path, query, or fragment.`);
  }
  return url;
}

function parseRuntimeUrl(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${name} must be configured.`);
  }
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid URL.`);
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error(`${name} must be an HTTP(S) URL without credentials.`);
  }
  if (
    url.protocol !== 'https:' &&
    !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  ) {
    throw new Error(`${name} must use HTTPS except for a loopback local runtime.`);
  }
  if (url.search || url.hash) {
    throw new Error(`${name} must not contain query parameters or fragments.`);
  }
  return url;
}

function readInteger(value, name, fallback, minimum, maximum) {
  const parsed = value === undefined ? fallback : Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(
      `${name} must be an integer between ${minimum} and ${maximum}.`,
    );
  }
  return parsed;
}
