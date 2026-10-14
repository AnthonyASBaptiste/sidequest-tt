import { readFile, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { setTimeout as sleep } from 'node:timers/promises';
import {
  cleanJsonContent,
  loadRuntimeConfig,
  requestGemmaChat,
} from './runtime-client.mjs';
import { getTemporalContext } from './temporal-context.mjs';
import { searchEventsForRegion } from './event-search.mjs';

const config = loadRuntimeConfig(process.env);
const args = process.argv.slice(2);
let stopping = false;

const specifiedRegion = optionValue(args, '--region') || null;
const targetRegions = specifiedRegion ? [specifiedRegion] : ['Trinidad', 'Tobago'];

if (args[0] === '--preview') {
  const outputPath = optionValue(args, '--out');
  if (!outputPath) {
    throw new Error('--preview requires --out <file>.');
  }
  const previewRegion = specifiedRegion || 'Trinidad';
  const payload = await generatePool(previewRegion);
  await writeFile(resolve(outputPath), `${JSON.stringify(payload, null, 2)}\n`, {
    mode: 0o600,
  });
  console.info(
    `Generated ${payload.quests.length} quest candidates for ${payload.region} (${payload.poolDate}) with ${config.gemmaModel} (provider=${config.provider}); preview saved to ${basename(outputPath)}. Nothing was published.`,
  );
} else if (args[0] === '--publish-from') {
  const inputPath = optionValue(args, '--publish-from');
  if (!inputPath) {
    throw new Error('--publish-from requires a JSON file path.');
  }
  const payload = JSON.parse(await readFile(resolve(inputPath), 'utf8'));
  validatePoolPayload(payload);
  await publishPool(payload);
} else if (args[0] === '--schedule' && args.length <= 3) {
  console.info(
    `Quest-pool worker started (provider=${config.provider}, model=${config.gemmaModel}); monitoring pools for ${targetRegions.join(', ')} every 30 seconds.`,
  );
  process.once('SIGINT', () => {
    stopping = true;
  });
  process.once('SIGTERM', () => {
    stopping = true;
  });
  while (!stopping) {
    await generateScheduledPools();
    if (!stopping) {
      await sleep(30_000);
    }
  }
  console.info('Quest-pool scheduler stopped.');
} else if (args.length === 0 || (args.length === 2 && specifiedRegion)) {
  for (const region of targetRegions) {
    try {
      const payload = await generatePool(region);
      await publishPool(payload);
    } catch (error) {
      console.warn(`[PoolWorker] Could not generate pool for ${region}: ${error.message}`);
    }
  }
} else {
  throw new Error(
    'Usage: worker:generate-pool [--preview --out <file> [--region <Trinidad|Tobago>] | --publish-from <file> | --schedule [--region <Trinidad|Tobago>]].',
  );
}

async function generatePool(region = 'Trinidad') {
  const templatesResponse = await fetchTemplates(region);
  if (templatesResponse.poolAlreadyPublished) {
    throw new Error(
      `A quest pool is already published for ${region} on ${templatesResponse.poolDate}; the existing pool was left unchanged.`,
    );
  }
  return generatePoolFromTemplates(templatesResponse, region);
}

async function generateScheduledPools() {
  for (const region of targetRegions) {
    if (stopping) break;
    try {
      const templatesResponse = await fetchTemplates(region);
      if (templatesResponse.poolAlreadyPublished) {
        continue;
      }
      if (!templatesResponse.generationRequested) continue;
      console.info(`[PoolWorker] Generating requested pool for ${region} (${templatesResponse.poolDate})...`);
      const payload = await generatePoolFromTemplates(templatesResponse, region);
      await publishPool(payload);
    } catch (error) {
      console.error(
        error instanceof Error
          ? `[PoolWorker] Quest-pool generation for ${region} failed: ${error.message}`
          : `[PoolWorker] Quest-pool generation for ${region} failed; existing board unchanged.`,
      );
    }
  }
}

async function fetchTemplates(region = 'Trinidad') {
  const templatesResponse = await apiRequest(`/internal/quest-pools/templates?region=${encodeURIComponent(region)}`);
  if (!isTemplatesResponse(templatesResponse)) {
    throw new Error(`The API returned an invalid quest-template response for ${region}.`);
  }
  return templatesResponse;
}

async function generatePoolFromTemplates(templatesResponse, region = 'Trinidad') {
  const templates = templatesResponse.templates;
  const poolDate = templatesResponse.poolDate;
  const temporalContext = getTemporalContext(poolDate, region);
  const liveEvents = await searchEventsForRegion(region, config, temporalContext);

  const schema = createQuestPoolSchema(templates);
  const startedAt = performance.now();
  const runtimeResponse = await requestGemma(templates, schema, region, temporalContext, liveEvents);
  const candidates = parseGeneratedCandidates(runtimeResponse, templates);
  const payload = {
    poolDate,
    region,
    model: config.gemmaModel,
    quests: candidates,
  };
  validatePoolPayload(payload);
  console.info(
    `${config.provider === 'nvidia' ? 'NVIDIA Gemma' : 'Gemma'} generated ${candidates.length} candidates for ${region} in ${Math.round(performance.now() - startedAt)} ms.`,
  );
  return payload;
}

function createQuestPoolSchema(templates) {
  return {
    type: 'object',
    properties: {
      quests: {
        type: 'array',
        minItems: templates.length,
        maxItems: templates.length,
        items: {
          type: 'object',
          properties: {
            templateId: {
              type: 'string',
              enum: templates.map((template) => template.id),
            },
            title: { type: 'string' },
            description: { type: 'string' },
            durationMinutes: { type: 'integer' },
          },
          required: [
            'templateId',
            'title',
            'description',
            'durationMinutes',
          ],
          additionalProperties: false,
        },
      },
    },
    required: ['quests'],
    additionalProperties: false,
  };
}

async function requestGemma(templates, schema, region, temporalContext, liveEvents) {
  const eventsList = liveEvents && liveEvents.length > 0
    ? liveEvents.map(e => `- ${e.title} (${e.date}, ${e.venue}): ${e.snippet}`).join('\n')
    : 'No live ticketed events today. Rely on local seasonal traditions, food spots, and public spaces.';

  const systemPrompt = `You are the creative Quest Master for SideQuest T&T (${region}).
Your role is to craft lively, imaginative, culturally authentic real-world quests based on human-reviewed templates.

SAFETY FIRST (MANDATORY):
- All quests must be safe, lawful, and accessible during daytime or well-lit hours.
- Never require entering private property, trespassing, crossing hazardous highways without pedestrian overpasses/crosswalks, swimming in unpatrolled waters, or walking in unsafe or isolated areas alone.
- Players should keep their phone away while moving and stay aware of their real-world environment.

CULTURAL & DYNAMIC INSPIRATION:
- Today is in the ${temporalContext.seasonName}.
- Seasonal guidance: ${temporalContext.seasonalMandate}
- Day-of-week rhythm: ${temporalContext.dayRhythm}
- Real-time event inspirations in the area:
${eventsList}

QUEST FLAVOR:
- Encourage sensory exploration: tasting a local food spot (doubles, bake & shark, hot bread from a neighborhood bakery, fresh seasonal fruit), enjoying a coastal sea breeze (northern beaches like Maracas/Las Cuevas in Trinidad or Pigeon Point/Castara in Tobago), or fun scavenger moments like taking a picture on a green park bench or near a vibrant mural.
- Clearly tell the player how to satisfy the proof instructions (photo proof or written reflection).
- Keep titles punchy (e.g. "Green Bench Scavenger", "The Northern Coastal Breeze", "Island Flavor Quest") and descriptions actionable.

OUTPUT FORMAT (STRICT):
You must output a single JSON object with a single key "quests", which is an array of exactly ${templates.length} quest objects (one for each template provided in the user prompt).
Each quest object in the "quests" array MUST contain exactly these 4 fields:
- "templateId": (string) matching the input templateId
- "title": (string) title of the quest
- "description": (string) engaging real-world quest description
- "durationMinutes": (integer) estimated duration in minutes

Example output structure:
{
  "quests": [
    {
      "templateId": "...",
      "title": "...",
      "description": "...",
      "durationMinutes": 30
    }
  ]
}`;

  const userPrompt = `Generate exactly ${templates.length} quests, one for each of the following templates. Remember to wrap them in a JSON object with a "quests" array containing all ${templates.length} items:\n` + JSON.stringify({
    region,
    poolDate: temporalContext.poolDate,
    season: temporalContext.seasonName,
    templateCount: templates.length,
    templates: templates.map((template) => ({
      templateId: template.id,
      rarity: template.rarity,
      difficulty: template.difficulty,
      activityShape: template.activityShape,
      generationGuidance: template.generationGuidance,
      completionCriteria: template.completionCriteria,
      proofInstructions: template.proofInstructions,
      safetyGuidance: template.safetyGuidance,
      durationMinutesRange: durationRange(template.rarity),
    })),
  }, null, 2);

  return requestGemmaChat({
    config,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.75,
    maxTokens: 4096,
    schema,
  });
}

function parseGeneratedCandidates(content, templates) {
  let parsed;
  try {
    const cleaned = cleanJsonContent(content);
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error('Gemma returned malformed structured quest content.');
  }
  if (
    !isRecord(parsed) ||
    !Array.isArray(parsed.quests) ||
    parsed.quests.length !== templates.length
  ) {
    console.error('Debug: templates count =', templates.length, 'parsed quests count =', parsed?.quests?.length, 'parsed =', JSON.stringify(parsed));
    throw new Error('Gemma output did not contain exactly one quest per template.');
  }

  const templatesById = new Map(templates.map((template) => [template.id, template]));
  const seenIds = new Set();
  const seenTitles = new Set();
  return parsed.quests.map((candidate) => {
    if (
      !isRecord(candidate) ||
      !hasExactKeys(candidate, [
        'templateId',
        'title',
        'description',
        'durationMinutes',
      ]) ||
      typeof candidate.templateId !== 'string' ||
      typeof candidate.title !== 'string' ||
      typeof candidate.description !== 'string' ||
      !Number.isInteger(candidate.durationMinutes)
    ) {
      throw new Error('Gemma returned a quest with an invalid shape.');
    }
    const template = templatesById.get(candidate.templateId);
    if (!template || seenIds.has(candidate.templateId)) {
      throw new Error('Gemma returned a duplicate or unknown template ID.');
    }
    const title = candidate.title.trim();
    const description = candidate.description.trim();
    const titleKey = title.toLocaleLowerCase('en');
    const range = durationRange(template.rarity);
    if (
      title.length < 3 ||
      title.length > 120 ||
      description.length < 20 ||
      description.length > 2000 ||
      candidate.durationMinutes < range.min ||
      candidate.durationMinutes > range.max ||
      seenTitles.has(titleKey)
    ) {
      throw new Error('Gemma returned a quest outside the approved content limits.');
    }
    seenIds.add(candidate.templateId);
    seenTitles.add(titleKey);
    return {
      templateId: candidate.templateId,
      title,
      description,
      durationMinutes: candidate.durationMinutes,
    };
  });
}

function validatePoolPayload(payload) {
  if (
    !isRecord(payload) ||
    typeof payload.poolDate !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(payload.poolDate) ||
    payload.model !== config.gemmaModel ||
    !Array.isArray(payload.quests) ||
    payload.quests.length < 5 ||
    payload.quests.length > 10
  ) {
    throw new Error('Quest-pool payload failed local validation.');
  }

  const expectedKeys = payload.region ? ['poolDate', 'region', 'model', 'quests'] : ['poolDate', 'model', 'quests'];
  if (!hasExactKeys(payload, expectedKeys)) {
    throw new Error('Quest-pool payload keys mismatch.');
  }

  const ids = new Set();
  const titles = new Set();
  for (const quest of payload.quests) {
    if (
      !isRecord(quest) ||
      !hasExactKeys(quest, [
        'templateId',
        'title',
        'description',
        'durationMinutes',
      ]) ||
      typeof quest.templateId !== 'string' ||
      !/^[a-f\d]{24}$/i.test(quest.templateId) ||
      typeof quest.title !== 'string' ||
      quest.title.length < 3 ||
      quest.title.length > 120 ||
      typeof quest.description !== 'string' ||
      quest.description.length < 20 ||
      quest.description.length > 2000 ||
      !Number.isInteger(quest.durationMinutes) ||
      ids.has(quest.templateId) ||
      titles.has(quest.title.toLocaleLowerCase('en'))
    ) {
      throw new Error('Quest-pool payload failed local validation.');
    }
    ids.add(quest.templateId);
    titles.add(quest.title.toLocaleLowerCase('en'));
  }
}

async function publishPool(payload) {
  const response = await apiRequest('/internal/quest-pools/publish', {
    method: 'POST',
    body: payload,
  });
  if (
    !isRecord(response) ||
    typeof response.published !== 'boolean' ||
    typeof response.alreadyPublished !== 'boolean' ||
    typeof response.batchId !== 'string' ||
    response.poolDate !== payload.poolDate ||
    response.questCount !== payload.quests.length ||
    response.model !== config.gemmaModel
  ) {
    throw new Error('The API returned an invalid quest-pool publication response.');
  }
  if (response.alreadyPublished) {
    console.info(
      `A pool for ${payload.region || 'Trinidad'} on ${response.poolDate} is already published; no records were changed.`,
    );
    return;
  }
  if (!response.published) {
    throw new Error('The API did not confirm quest-pool publication.');
  }
  console.info(
    `Published ${response.questCount} quests for ${payload.region || 'Trinidad'} (${response.poolDate}) to the database.`,
  );
}

function durationRange(rarity) {
  switch (rarity) {
    case 'common':
      return { min: 10, max: 30 };
    case 'uncommon':
      return { min: 30, max: 60 };
    case 'rare':
      return { min: 60, max: 120 };
    default:
      throw new Error(`Unsupported quest rarity "${rarity}".`);
  }
}

function isTemplatesResponse(value) {
  return (
    isRecord(value) &&
    typeof value.poolDate === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(value.poolDate) &&
    typeof value.poolAlreadyPublished === 'boolean' &&
    typeof value.generationRequested === 'boolean' &&
    Array.isArray(value.templates) &&
    value.templates.every(
      (template) =>
        isRecord(template) &&
        typeof template.id === 'string' &&
        /^[a-f\d]{24}$/i.test(template.id) &&
        Number.isInteger(template.version) &&
        ['common', 'uncommon', 'rare'].includes(template.rarity) &&
        ['easy', 'moderate', 'challenging'].includes(template.difficulty) &&
        typeof template.activityShape === 'string' &&
        typeof template.generationGuidance === 'string' &&
        Array.isArray(template.completionCriteria) &&
        template.completionCriteria.every((item) => typeof item === 'string') &&
        typeof template.proofInstructions === 'string' &&
        Array.isArray(template.safetyGuidance) &&
        template.safetyGuidance.every((item) => typeof item === 'string'),
    )
  );
}

async function apiRequest(path, { method = 'GET', body } = {}) {
  let response;
  try {
    response = await fetch(new URL(`/api${path}`, config.apiBaseUrl), {
      method,
      headers: {
        authorization: `Bearer ${config.workerSecret}`,
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      redirect: 'error',
      signal: AbortSignal.timeout(config.apiTimeoutMs),
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    throw new Error(
      error?.name === 'TimeoutError' || error?.name === 'AbortError'
        ? 'The API request timed out.'
        : `The API is unreachable (${error?.message || 'unknown error'}).`,
    );
  }

  const text = await response.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    throw new Error('The API returned a response that was not valid JSON.');
  }

  if (!response.ok) {
    const message =
      isRecord(json) && typeof json.message === 'string'
        ? json.message
        : `HTTP ${response.status}`;
    throw new Error(`The API rejected the quest-pool request: ${message}`);
  }

  return json;
}

function optionValue(args, name) {
  const index = args.indexOf(name);
  if (index === -1) {
    return null;
  }
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    return null;
  }
  return value;
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(value, keys) {
  const actual = Object.keys(value).sort();
  return (
    actual.length === keys.length &&
    actual.every((key, index) => key === [...keys].sort()[index])
  );
}
