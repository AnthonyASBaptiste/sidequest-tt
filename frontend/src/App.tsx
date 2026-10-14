import { useCallback, useEffect, useRef, useState } from 'react';

type Quest = {
  id: string;
  title: string;
  description: string;
  region: string;
  durationMinutes: number;
  difficulty: string;
  rarity: 'common' | 'uncommon' | 'rare';
  xp: number;
  proofType?: 'text' | 'photo';
  proofInstructions: string;
  completionCriteria: string[];
  safetyGuidance: string[];
  lastCompletedAt: string | null;
  completedToday: boolean;
  completedYesterday: boolean;
};

type QuestBoard = {
  available: boolean;
  poolDate: string | null;
  fallback: boolean;
  generationRequested: boolean;
  quests: Quest[];
};

type Snapshot = Omit<
  Quest,
  'id' | 'completedToday' | 'completedYesterday' | 'lastCompletedAt' | 'slot'
>;

type Acceptance = {
  id: string;
  questId: string;
  status: 'accepted' | 'submitted' | 'retry' | 'completed' | 'expired';
  acceptedAt: string;
  questSnapshot: Snapshot;
};

type Submission = {
  id: string;
  acceptanceId: string;
  attemptNumber: number;
  status: 'pending' | 'verified' | 'retry' | 'review' | 'expired';
  submittedAt: string;
};

type VerificationStatus = {
  attemptId: string;
  acceptanceId: string;
  attemptNumber: number;
  status: Submission['status'];
  reason: string | null;
  confidence: number | null;
  failedCriteria: string[];
  xpAwarded: number;
  submittedAt: string;
};

type ActiveQuestResponse = {
  activeAcceptance: Acceptance | null;
  latestSubmission: VerificationStatus | null;
  recentCompletion: {
    acceptance: Acceptance;
    submission: VerificationStatus;
    completedAt: string;
  } | null;
};

type Guest = {
  id: string;
  region: string;
  xp: number;
};

type ApiError = Error & { status?: number };

const API_BASE_URL = (
  import.meta.env.PROD
    ? '/api'
    : import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api'
).replace(/\/+$/, '');
const MAX_EVIDENCE_CHARACTERS = 2000;
const POLL_INTERVAL_MS = 2500;
const SLOW_VERIFICATION_MS = 15_000;

const rarityLabels: Record<Quest['rarity'], string> = {
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
};

function apiRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<{ data: T; status: number }> {
  return fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  }).then(async (response) => {
    const text = await response.text();
    const body = text ? safeJsonParse(text) : null;
    if (!response.ok) {
      const unavailable = body as
        | { available?: boolean; reason?: string }
        | null;
      if (
        response.status === 503 &&
        unavailable?.available === false &&
        unavailable.reason === 'no_published_pool'
      ) {
        return { data: body as T, status: response.status };
      }
      const payload = body as { message?: string | string[] } | null;
      const message = Array.isArray(payload?.message)
        ? payload.message.join(' ')
        : payload?.message;
      const error = new Error(
        message || `The service returned an error (${response.status}).`,
      ) as ApiError;
      error.status = response.status;
      throw error;
    }
    return { data: body as T, status: response.status };
  });
}

function safeJsonParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function friendlyError(error: unknown): string {
  if (error instanceof TypeError) {
    return 'The game server could not be reached. Check your connection and try again.';
  }
  if (error instanceof Error) return error.message;
  return 'Something went wrong. Please try again.';
}

function formatPoolDate(value: string | null): string {
  if (!value) return 'an earlier day';
  const [year, month, day] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('en-TT', {
    dateStyle: 'long',
    timeZone: 'America/Port_of_Spain',
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}

function SnapshotDetails({
  quest,
  compact = false,
}: {
  quest: Snapshot | Quest;
  compact?: boolean;
}) {
  return (
    <>
      <p className="quest-description">{quest.description}</p>
      <p className="proof-instructions">{quest.proofInstructions}</p>
      {!compact && (
        <>
          <div className="detail-block">
            <h3>What counts</h3>
            <ul>
              {quest.completionCriteria.map((criterion) => (
                <li key={criterion}>{criterion}</li>
              ))}
            </ul>
          </div>
          <div className="detail-block safety-block">
            <h3>Stay safe</h3>
            <ul>
              {quest.safetyGuidance.map((guidance) => (
                <li key={guidance}>{guidance}</li>
              ))}
            </ul>
          </div>
        </>
      )}
    </>
  );
}

function RarityBadge({ rarity }: { rarity: Quest['rarity'] }) {
  const pipCount = rarity === 'common' ? 1 : rarity === 'uncommon' ? 2 : 3;

  return (
    <span className={`rarity-tag rarity-${rarity}`}>
      <span className="rarity-pips" aria-hidden="true">
        {Array.from({ length: pipCount }, (_, index) => (
          <span className="rarity-pip" key={index} />
        ))}
      </span>
      <span>{rarityLabels[rarity]}</span>
    </span>
  );
}

function compressImage(file: File, maxDimension = 1280, quality = 0.75): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas context not available'));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = reject;
    img.src = url;
  });
}

function App() {
  const [guest, setGuest] = useState<Guest | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<'Trinidad' | 'Tobago'>('Trinidad');
  const [board, setBoard] = useState<QuestBoard | null>(null);
  const [acceptance, setAcceptance] = useState<Acceptance | null>(null);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [verification, setVerification] = useState<VerificationStatus | null>(
    null,
  );
  const [recentCompletion, setRecentCompletion] = useState<ActiveQuestResponse['recentCompletion']>(null);
  const [evidence, setEvidence] = useState('');
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [expandedQuest, setExpandedQuest] = useState<string | null>(null);
  const [awayMode, setAwayMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slowVerification, setSlowVerification] = useState(false);
  const idempotencyKeyRef = useRef<string | null>(null);
  const startedPollingAtRef = useRef<number | null>(null);
  const initializedRef = useRef(false);

  const loadBoard = useCallback(async (region: 'Trinidad' | 'Tobago' = selectedRegion) => {
    const result = await apiRequest<QuestBoard>(`/quests/today?region=${region}`);
    setBoard(result.data);
  }, [selectedRegion]);

  function handleRegionChange(newRegion: 'Trinidad' | 'Tobago') {
    setSelectedRegion(newRegion);
    void loadBoard(newRegion);
  }

  async function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setPhotoError('Please select a valid image file (JPEG, PNG, WebP).');
      return;
    }

    setPhotoError(null);
    try {
      const compressedDataUrl = await compressImage(file, 1280, 0.75);
      setPhotoPreview(compressedDataUrl);
      setPhotoBase64(compressedDataUrl);
    } catch {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        setPhotoPreview(result);
        setPhotoBase64(result);
      };
      reader.readAsDataURL(file);
    }
  }

  function handlePhotoRemove() {
    setPhotoPreview(null);
    setPhotoBase64(null);
    setPhotoError(null);
  }

  async function refreshAfterVerification() {
    const [sessionResult, activeResult, boardResult] = await Promise.allSettled([
      apiRequest<{ guest: Guest }>('/session/guest', { method: 'POST' }),
      apiRequest<ActiveQuestResponse>('/quests/active'),
      apiRequest<QuestBoard>(`/quests/today?region=${selectedRegion}`),
    ]);

    if (sessionResult.status === 'fulfilled') {
      setGuest(sessionResult.value.data.guest);
    }
    if (activeResult.status === 'fulfilled') {
      setRecentCompletion(activeResult.value.data.recentCompletion);
    }
    if (boardResult.status === 'fulfilled') {
      setBoard(boardResult.value.data);
    }

    if (
      sessionResult.status === 'fulfilled' &&
      activeResult.status === 'fulfilled' &&
      boardResult.status === 'fulfilled'
    ) {
      setAcceptance(null);
      setSubmission(null);
      setVerification(null);
      return;
    }

    setError(
      'Quest verified! Your points or quest board could not be refreshed. Reload to sync your progress.',
    );
  }

  const initialize = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const session = await apiRequest<{ guest: Guest }>('/session/guest', {
        method: 'POST',
      });
      setGuest(session.data.guest);
      let restoredActiveQuest = false;
      try {
        const activeResult =
          await apiRequest<ActiveQuestResponse>('/quests/active');
        const { activeAcceptance, latestSubmission, recentCompletion } =
          activeResult.data;
        if (activeAcceptance) {
          setAcceptance(activeAcceptance);
          if (latestSubmission) {
            setSubmission({
              id: latestSubmission.attemptId,
              acceptanceId: latestSubmission.acceptanceId,
              attemptNumber: latestSubmission.attemptNumber,
              status: latestSubmission.status,
              submittedAt: latestSubmission.submittedAt,
            });
            setVerification(latestSubmission);
            if (latestSubmission.status === 'pending') {
              startedPollingAtRef.current = Date.now();
            }
          }
          restoredActiveQuest = true;
        } else if (recentCompletion) {
          setRecentCompletion(recentCompletion);
        }
      } catch (activeRequestError) {
        setError(
          `Could not check for an active quest. ${friendlyError(activeRequestError)}`,
        );
      }

      if (!restoredActiveQuest) {
        await loadBoard();
      }
    } catch (requestError) {
      setError(friendlyError(requestError));
    } finally {
      setLoading(false);
    }
  }, [loadBoard]);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    void initialize();
  }, [initialize]);

  useEffect(() => {
    if (!board?.generationRequested) return;
    let stopped = false;
    let timeoutId: number;
    const refresh = async () => {
      try {
        const result = await apiRequest<QuestBoard>('/quests/today');
        if (stopped) return;
        setBoard(result.data);
        if (result.data.generationRequested) {
          timeoutId = window.setTimeout(refresh, 15_000);
        }
      } catch {
        if (!stopped) timeoutId = window.setTimeout(refresh, 15_000);
      }
    };
    timeoutId = window.setTimeout(refresh, 15_000);
    return () => {
      stopped = true;
      window.clearTimeout(timeoutId);
    };
  }, [board?.generationRequested]);

  useEffect(() => {
    if (!submission || !acceptance || verification?.status !== 'pending') {
      return;
    }

    let stopped = false;
    let timeoutId: number | undefined;
    const poll = async () => {
      try {
        const result = await apiRequest<VerificationStatus>(
          `/acceptances/${acceptance.id}/submissions/${submission.id}`,
        );
        if (stopped) return;
        setVerification(result.data);
        if (result.data.status === 'pending') {
          const elapsed =
            Date.now() - (startedPollingAtRef.current ?? Date.now());
          setSlowVerification(elapsed >= SLOW_VERIFICATION_MS);
          timeoutId = window.setTimeout(poll, POLL_INTERVAL_MS);
        } else {
          setSlowVerification(false);
          if (result.data.status === 'retry') {
            setAcceptance((current) =>
              current ? { ...current, status: 'retry' } : current,
            );
          }
          if (result.data.status === 'verified') {
            setAcceptance((current) =>
              current ? { ...current, status: 'completed' } : current,
            );
            void refreshAfterVerification();
          }
        }
      } catch {
        if (stopped) return;
        setSlowVerification(true);
        timeoutId = window.setTimeout(poll, POLL_INTERVAL_MS * 2);
      }
    };

    timeoutId = window.setTimeout(poll, POLL_INTERVAL_MS);
    return () => {
      stopped = true;
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    };
  }, [acceptance, submission, verification?.status]);

  async function acceptQuest(questId: string) {
    setAccepting(true);
    setError(null);
    try {
      const result = await apiRequest<Acceptance>(`/quests/${questId}/accept`, {
        method: 'POST',
      });
      setAcceptance(result.data);
      setRecentCompletion(null);
      setSubmission(null);
      setVerification(null);
      setEvidence('');
      setPhotoPreview(null);
      setPhotoBase64(null);
      setPhotoError(null);
      setAwayMode(false);
      idempotencyKeyRef.current = null;
    } catch (requestError) {
      const apiError = requestError as ApiError;
      setError(
        apiError.status === 409
          ? `${friendlyError(requestError)} Finish your active quest before choosing another.`
          : friendlyError(requestError),
      );
    } finally {
      setAccepting(false);
    }
  }

  async function submitEvidence(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!acceptance) return;
    const trimmedEvidence = evidence.trim();
    if (!trimmedEvidence && !photoBase64) {
      setError('Please provide either photo proof or a short reflection before submitting.');
      return;
    }
    if (trimmedEvidence && Array.from(trimmedEvidence).length > MAX_EVIDENCE_CHARACTERS) {
      setError('Keep your reflection within 2,000 characters.');
      return;
    }

    idempotencyKeyRef.current ??= crypto.randomUUID();
    setSubmitting(true);
    setError(null);
    try {
      const payload: { evidenceText?: string; evidencePhoto?: string } = {};
      if (trimmedEvidence) payload.evidenceText = trimmedEvidence;
      if (photoBase64) payload.evidencePhoto = photoBase64;

      const result = await apiRequest<Submission>(
        `/acceptances/${acceptance.id}/submissions`,
        {
          method: 'POST',
          headers: { 'Idempotency-Key': idempotencyKeyRef.current },
          body: JSON.stringify(payload),
        },
      );
      idempotencyKeyRef.current = null;
      setSubmission(result.data);
      setVerification({
        attemptId: result.data.id,
        acceptanceId: result.data.acceptanceId,
        attemptNumber: result.data.attemptNumber,
        status: result.data.status,
        reason: null,
        confidence: null,
        failedCriteria: [],
        xpAwarded: 0,
        submittedAt: result.data.submittedAt,
      });
      setEvidence('');
      setPhotoPreview(null);
      setPhotoBase64(null);
      setPhotoError(null);
      setAwayMode(false);
      startedPollingAtRef.current = Date.now();
      setSlowVerification(false);
    } catch (requestError) {
      setError(friendlyError(requestError));
    } finally {
      setSubmitting(false);
    }
  }

  function startAnotherAttempt() {
    if (verification?.status === 'review') {
      setAcceptance((current) =>
        current ? { ...current, status: 'retry' } : current,
      );
    }
    setSubmission(null);
    setEvidence('');
    setPhotoPreview(null);
    setPhotoBase64(null);
    setPhotoError(null);
    idempotencyKeyRef.current = null;
    startedPollingAtRef.current = null;
    setError(null);
  }

  if (loading) {
    return (
      <main className="loading-screen">
        <span className="sun-mark">✳</span>
        <p>Finding your next side quest…</p>
      </main>
    );
  }

  const activeQuest = acceptance?.questSnapshot;

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="SideQuest T&T home">
          <img
            className="brand-logo"
            src="/sidequest-logo.svg"
            alt=""
            width="240"
            height="56"
          />
        </a>
        <div className="topbar-controls">
          <label className="region-selector-wrapper" htmlFor="region-select">
            <span className="region-selector-label">Island:</span>
            <select
              id="region-select"
              className="region-select"
              value={selectedRegion}
              onChange={(e) => handleRegionChange(e.target.value as 'Trinidad' | 'Tobago')}
              aria-label="Select island region"
            >
              <option value="Trinidad">🇹🇹 Trinidad</option>
              <option value="Tobago">🏝️ Tobago</option>
            </select>
          </label>
          <div className="player-pill">
            <span className="player-dot" />
            <span className="player-region">
              {guest?.region ?? selectedRegion} explorer
            </span>
            <strong className="player-xp">
              {(guest?.xp ?? 0).toLocaleString()} XP
            </strong>
          </div>
        </div>
      </header>

      {error && (
        <div className="error-banner" role="alert">
          <span>{error}</span>
          <button
            className="text-button"
            onClick={() =>
              void (verification?.status === 'verified'
                ? refreshAfterVerification()
                : acceptance
                  ? loadBoard()
                  : initialize())
            }
            type="button"
          >
            Try again
          </button>
        </div>
      )}

      {acceptance && activeQuest ? (
        <section className="active-view">
          <div className="active-heading">
            <div>
              <p className="eyebrow">YOUR ACTIVE QUEST</p>
              <h1>{activeQuest.title}</h1>
            </div>
            <RarityBadge rarity={activeQuest.rarity} />
          </div>

          {awayMode && !submission ? (
            <div className="away-card">
              <span className="away-sun">☀</span>
              <p className="eyebrow">SCREEN AWAY</p>
              <h2>You’ve got this.</h2>
              <p>
                Your quest and safety notes are ready. Put your phone away and
                enjoy the moment. Come back when you’re ready to share what you
                noticed.
              </p>
              <button
                className="button button-primary"
                onClick={() => setAwayMode(false)}
                type="button"
              >
                I’m back — submit my reflection
              </button>
            </div>
          ) : (
            <div className="active-grid">
              <article className="quest-panel">
                <div className="quest-meta">
                  <span>{activeQuest.region}</span>
                  <span>·</span>
                  <span>{activeQuest.durationMinutes} min</span>
                  <span>·</span>
                  <span>{activeQuest.difficulty}</span>
                </div>
                <SnapshotDetails quest={activeQuest} />
                <button
                  className="button button-secondary away-button"
                  onClick={() => setAwayMode(true)}
                  type="button"
                  disabled={Boolean(submission && verification?.status === 'pending')}
                >
                  ☀ Put my phone away
                </button>
              </article>

              <aside className="submit-panel">
                {submission && verification ? (
                  <VerificationCard
                    verification={verification}
                    slow={slowVerification}
                    onAnotherAttempt={startAnotherAttempt}
                  />
                ) : acceptance.status === 'submitted' ? (
                  <div className="status-card">
                    <span className="status-icon">⏳</span>
                    <p className="eyebrow">EVIDENCE SUBMITTED</p>
                    <h2>Waiting for the Quest Master</h2>
                    <p>
                      The current browser doesn’t have this submission’s
                      status. Refresh the quest board after verification.
                    </p>
                  </div>
                ) : (
                  <form className="evidence-form" onSubmit={submitEvidence}>
                    <p className="eyebrow">
                      {acceptance.status === 'retry'
                        ? 'ANOTHER ATTEMPT'
                        : 'WHEN YOU’RE BACK'}
                    </p>
                    <h2>
                      {acceptance.status === 'retry'
                        ? 'Add a little more detail'
                        : 'How did it go?'}
                    </h2>
                    <p className="form-help">
                      {activeQuest.proofInstructions}
                    </p>
                    {acceptance.status === 'retry' && verification?.reason && (
                      <p className="retry-reason">{verification.reason}</p>
                    )}

                    {/* Photo Evidence Section */}
                    <div className="photo-evidence-section">
                      <label className="photo-upload-label" htmlFor="photo-upload">
                        📸 {photoPreview ? 'Change photo proof' : 'Add photo proof (recommended)'}
                      </label>
                      <input
                        id="photo-upload"
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        capture="environment"
                        className="photo-input"
                        onChange={handlePhotoSelect}
                      />
                      {photoError && <p className="photo-error">{photoError}</p>}
                      {photoPreview && (
                        <div className="photo-preview-container">
                          <img
                            src={photoPreview}
                            alt="Photo proof preview"
                            className="photo-preview-img"
                          />
                          <button
                            type="button"
                            className="photo-remove-btn"
                            onClick={handlePhotoRemove}
                            aria-label="Remove photo"
                          >
                            ✕ Remove photo
                          </button>
                        </div>
                      )}
                    </div>

                    <label className="visually-hidden" htmlFor="evidence">
                      Your quest reflection
                    </label>
                    <textarea
                      id="evidence"
                      onChange={(event) => setEvidence(event.target.value)}
                      placeholder={photoPreview ? 'Optional: What did you notice? Add any context...' : 'What did you notice? Describe what you saw or upload a photo above.'}
                      value={evidence}
                      rows={4}
                    />
                    <div className="form-footer">
                      <span>
                        {Array.from(evidence).length.toLocaleString()} / 2,000
                      </span>
                      <button
                        className="button button-primary"
                        disabled={
                          submitting ||
                          (!evidence.trim() && !photoBase64) ||
                          Array.from(evidence.trim()).length >
                            MAX_EVIDENCE_CHARACTERS
                        }
                        type="submit"
                      >
                        {submitting ? 'Sending…' : 'Submit proof'}
                      </button>
                    </div>
                    <p className="privacy-note">
                      Your proof is sent securely for verification and
                      photos are purged after 24 hours.
                    </p>
                  </form>
                )}
              </aside>
            </div>
          )}
        </section>
      ) : (
        <section className="board-view">
          <div className="hero">
            <div className="hero-copy">
              <p className="eyebrow">{selectedRegion.toUpperCase()} · DAILY QUESTS</p>
              <h1>
                The world is
                <br />
                your <em>game board.</em>
              </h1>
              <p className="hero-description">
                Pick a quest. Put your phone away. See what you find.
              </p>
            </div>
            <div className="hero-stamp" aria-hidden="true">
              <span>TOUCH</span>
              <strong>GRASS</strong>
              <span>GAIN XP</span>
            </div>
            <svg
              className="hero-islands"
              viewBox="0 0 160 250"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M80 15c10 5 17 14 17 25 0 7-5 12-2 19 3 8 13 12 12 22-1 7-8 11-8 19 1 10 10 17 7 26-2 7-11 10-12 18-1 9 8 16 4 24-3 5-11 7-13 14-2 8 3 16-2 22-5 7-16 6-21 13-6 8-4 18-10 25-6 7-16 7-22 13-7 7-8 19-17 23-7 3-15-1-23-1-7 1-16 5-21 0-5-4-3-12-5-19-2-9-10-15-9-24 1-8 11-13 11-21 0-7-8-13-6-20 1-8 11-12 12-20 1-7-6-14-3-21 3-7 13-8 17-14 5-8 0-19 5-27 5-7 16-7 22-13 5-6 5-16 11-20 7-5 16 0 24-4 7-3 10-12 17-15 7-4 15 0 22-4 5-3 7-11 12-14Z"
                stroke="currentColor"
                strokeWidth={selectedRegion === 'Trinidad' ? '2.4' : '1.2'}
                className={selectedRegion === 'Trinidad' ? 'map-island-active' : 'map-island-inactive'}
              />
              <path
                d="m122 62 4-6 8 2 3 5-5 5-8-1-2-5Z"
                stroke="currentColor"
                strokeWidth={selectedRegion === 'Tobago' ? '2.4' : '1.2'}
                className={selectedRegion === 'Tobago' ? 'map-island-active' : 'map-island-inactive'}
              />
              <path
                d="M100 76 67 107l27 31-34 35 17 27-39 31"
                stroke="currentColor"
                strokeWidth="1"
                strokeDasharray="2 6"
              />
              <circle cx="100" cy="76" r="4" className="map-marker" />
              <path
                d="m94 138 1.5 3.5 3.5.5-2.7 2.4.7 3.6-3-1.8-3 1.8.7-3.6-2.7-2.4 3.5-.5 1.5-3.5Z"
                className="map-marker"
              />
              <circle cx="77" cy="200" r="4" className="map-marker" />
            </svg>
          </div>

          {board?.fallback && (
            <div className="fallback-notice" role="status">
              <span className="notice-mark">↻</span>
              <span>
                Today’s quests aren’t ready yet. Showing the published pool
                from <strong>{formatPoolDate(board.poolDate)}</strong> while
                today’s pool is generated.
              </span>
            </div>
          )}

          {board && !board.available && board.generationRequested && (
            <div className="fallback-notice" role="status">
              <span className="notice-mark">↻</span>
              <span>
                Today’s quest pool is being prepared. The board will refresh
                when the home-server generator publishes it.
              </span>
            </div>
          )}

          {recentCompletion && (
            <div className="recent-completion" role="status">
              <div>
                <p className="eyebrow">QUEST VERIFIED</p>
                <h2>{recentCompletion.acceptance.questSnapshot.title}</h2>
                <p>
                  {recentCompletion.submission.reason ||
                    'The Quest Master verified your reflection.'}
                </p>
              </div>
              <strong>+{recentCompletion.submission.xpAwarded} XP</strong>
              <button
                className="text-button"
                onClick={() => setRecentCompletion(null)}
                type="button"
                aria-label="Dismiss completed quest message"
              >
                Dismiss
              </button>
            </div>
          )}

          {board && board.available ? (
            <>
              <div className="board-heading">
                <div>
                  <p className="eyebrow">YOUR QUEST BOARD</p>
                  <h2>Choose your next adventure</h2>
                </div>
                <span className="pool-date">
                  {formatPoolDate(board.poolDate)}
                </span>
              </div>
              <div className="quest-list">
                {board.quests.map((quest, index) => {
                  const expanded = expandedQuest === quest.id;
                  return (
                    <article
                      className={`quest-card ${
                        expanded ? 'quest-card-expanded' : ''
                      }`}
                      key={quest.id}
                    >
                      <button
                        className="quest-card-main"
                        onClick={() =>
                          setExpandedQuest(expanded ? null : quest.id)
                        }
                        type="button"
                        aria-expanded={expanded}
                      >
                        <span className="quest-number">
                          {String(index + 1).padStart(2, '0')}
                        </span>
                        <span className="quest-card-copy">
                          <span className="quest-card-title">{quest.title}</span>
                          <span className="quest-card-description">
                            {quest.description}
                          </span>
                          <span className="quest-meta">
                            <span>{quest.durationMinutes} min</span>
                            <span>·</span>
                            <span>{quest.difficulty}</span>
                            {quest.completedToday ? (
                              <span className="completed-today">
                                Completed today
                              </span>
                            ) : quest.completedYesterday ? (
                              <span className="completed-yesterday">
                                Completed yesterday
                              </span>
                            ) : null}
                          </span>
                        </span>
                        <span className="quest-card-reward">
                          <RarityBadge rarity={quest.rarity} />
                          <strong>{quest.xp} XP</strong>
                        </span>
                        <span className="expand-mark" aria-hidden="true">
                          {expanded ? '−' : '+'}
                        </span>
                      </button>
                      {expanded && (
                        <div className="quest-expanded-content">
                          <SnapshotDetails quest={quest} />
                          <button
                            className="button button-primary"
                            disabled={accepting}
                            onClick={() => void acceptQuest(quest.id)}
                            type="button"
                          >
                            {accepting ? 'Accepting…' : 'Accept this quest'}
                          </button>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
              <p className="board-footnote">
                Quest accepted? The next step is outside. Your XP is awarded
                only by the Quest Master after verification.
              </p>
            </>
          ) : (
            <div className="unavailable-card">
              <span className="status-icon">◌</span>
              <p className="eyebrow">
                {error && !board ? 'SERVER UNAVAILABLE' : 'QUEST BOARD UNAVAILABLE'}
              </p>
              <h2>{error && !board ? 'Could not load your quests' : 'No published quests yet'}</h2>
              <p>
                {error && !board
                  ? 'The game service could not be reached. Check your connection and try again.'
                  : 'We couldn’t reach a published quest pool. Try again when the service is available.'}
              </p>
              <button
                className="button button-primary"
                onClick={() => void initialize()}
                type="button"
              >
                Try again
              </button>
            </div>
          )}
        </section>
      )}

      <footer className="site-footer">
        <span>SideQuest T&amp;T</span>
        <span>Real life is the game.</span>
      </footer>
    </main>
  );
}

function VerificationCard({
  verification,
  slow,
  onAnotherAttempt,
}: {
  verification: VerificationStatus;
  slow: boolean;
  onAnotherAttempt: () => void;
}) {
  if (verification.status === 'pending') {
    return (
      <div className="status-card status-pending" role="status">
        <span className="status-icon">⏳</span>
        <p className="eyebrow">QUEST MASTER</p>
        <h2>Reflection received</h2>
        <p>
          Your submission is waiting for verification. You can put your phone
          down while the Quest Master checks it.
        </p>
        {slow && (
          <p className="worker-notice">
            Verification is taking longer than usual. The service may be
            temporarily unavailable; your submission is still safe.
          </p>
        )}
      </div>
    );
  }

  if (verification.status === 'verified') {
    return (
      <div className="status-card status-verified" role="status">
        <span className="status-icon">✳</span>
        <p className="eyebrow">QUEST VERIFIED</p>
        <h2>Quest complete!</h2>
        <p>{verification.reason || 'The Quest Master verified your quest.'}</p>
        <div className="xp-award">
          <strong>+{verification.xpAwarded} XP</strong>
          <span>awarded by the Quest Master</span>
        </div>
      </div>
    );
  }

  if (verification.status === 'retry') {
    return (
      <div className="status-card status-retry" role="status">
        <span className="status-icon">↻</span>
        <p className="eyebrow">ONE MORE DETAIL</p>
        <h2>Try another reflection</h2>
        <p>{verification.reason || 'Add a little more detail and try again.'}</p>
        {verification.failedCriteria.length > 0 && (
          <ul className="failed-criteria">
            {verification.failedCriteria.map((criterion) => (
              <li key={criterion}>{criterion}</li>
            ))}
          </ul>
        )}
        <p className="no-xp-note">No XP was awarded for this attempt.</p>
        <button
          className="button button-primary"
          onClick={onAnotherAttempt}
          type="button"
        >
          Write another reflection
        </button>
      </div>
    );
  }

  if (verification.status === 'review') {
    return (
      <div className="status-card status-review" role="status">
        <span className="status-icon">◷</span>
        <p className="eyebrow">TRY ANOTHER REFLECTION</p>
        <h2>Add the missing details</h2>
        <p>
          {verification.reason ||
            'Your result is awaiting review. No XP has been awarded.'}
        </p>
        {verification.failedCriteria.length > 0 && (
          <ul className="failed-criteria">
            {verification.failedCriteria.map((criterion) => (
              <li key={criterion}>{criterion}</li>
            ))}
          </ul>
        )}
        <p className="no-xp-note">
          No XP was awarded for this attempt. Add the missing observations and
          submit again; you don’t need to wait for a manual review.
        </p>
        <button
          className="button button-primary"
          onClick={onAnotherAttempt}
          type="button"
        >
          Write another reflection
        </button>
      </div>
    );
  }

  return (
    <div className="status-card" role="status">
      <span className="status-icon">⌛</span>
      <p className="eyebrow">EVIDENCE EXPIRED</p>
      <h2>This attempt has expired</h2>
      <p>
        The evidence retention period ended before verification completed.
        No XP was awarded.
      </p>
    </div>
  );
}

export default App;
