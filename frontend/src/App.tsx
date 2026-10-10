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
  proofInstructions: string;
  completionCriteria: string[];
  safetyGuidance: string[];
  lastCompletedAt: string | null;
  completedYesterday: boolean;
};

type QuestBoard = {
  available: boolean;
  poolDate: string | null;
  fallback: boolean;
  quests: Quest[];
};

type Snapshot = Omit<
  Quest,
  'id' | 'completedYesterday' | 'lastCompletedAt' | 'slot'
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
};

type Guest = {
  id: string;
  region: string;
  xp: number;
};

type ApiError = Error & { status?: number };

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api'
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

function App() {
  const [guest, setGuest] = useState<Guest | null>(null);
  const [board, setBoard] = useState<QuestBoard | null>(null);
  const [acceptance, setAcceptance] = useState<Acceptance | null>(null);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [verification, setVerification] = useState<VerificationStatus | null>(
    null,
  );
  const [evidence, setEvidence] = useState('');
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

  const loadBoard = useCallback(async () => {
    const result = await apiRequest<QuestBoard>('/quests/today');
    setBoard(result.data);
  }, []);

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
        const { activeAcceptance, latestSubmission } = activeResult.data;
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
      setSubmission(null);
      setVerification(null);
      setEvidence('');
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
    if (!trimmedEvidence) {
      setError('Add a short written reflection before submitting.');
      return;
    }
    if (Array.from(trimmedEvidence).length > MAX_EVIDENCE_CHARACTERS) {
      setError('Keep your reflection within 2,000 characters.');
      return;
    }

    idempotencyKeyRef.current ??= crypto.randomUUID();
    setSubmitting(true);
    setError(null);
    try {
      const result = await apiRequest<Submission>(
        `/acceptances/${acceptance.id}/submissions`,
        {
          method: 'POST',
          headers: { 'Idempotency-Key': idempotencyKeyRef.current },
          body: JSON.stringify({ evidenceText: trimmedEvidence }),
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
    setSubmission(null);
    setEvidence('');
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
          <span className="brand-mark">SQ</span>
          <span>SideQuest <b>T&amp;T</b></span>
        </a>
        <div className="player-pill">
          <span className="player-dot" />
          {guest?.region ?? 'Trinidad'} explorer
        </div>
      </header>

      {error && (
        <div className="error-banner" role="alert">
          <span>{error}</span>
          <button
            className="text-button"
            onClick={() => void (acceptance ? loadBoard() : initialize())}
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
                    <label className="visually-hidden" htmlFor="evidence">
                      Your quest reflection
                    </label>
                    <textarea
                      id="evidence"
                      onChange={(event) => setEvidence(event.target.value)}
                      placeholder="What did you notice?"
                      value={evidence}
                      required
                      rows={6}
                    />
                    <div className="form-footer">
                      <span>
                        {Array.from(evidence).length.toLocaleString()} / 2,000
                      </span>
                      <button
                        className="button button-primary"
                        disabled={
                          submitting ||
                          !evidence.trim() ||
                          Array.from(evidence.trim()).length >
                            MAX_EVIDENCE_CHARACTERS
                        }
                        type="submit"
                      >
                        {submitting ? 'Sending…' : 'Submit reflection'}
                      </button>
                    </div>
                    <p className="privacy-note">
                      Your reflection is sent securely for verification and
                      isn’t saved in this browser.
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
              <p className="eyebrow">TRINIDAD · DAILY QUESTS</p>
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
                strokeWidth="1.4"
              />
              <path
                d="m122 62 4-6 8 2 3 5-5 5-8-1-2-5Z"
                stroke="currentColor"
                strokeWidth="1.4"
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
                from <strong>{formatPoolDate(board.poolDate)}</strong>.
              </span>
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
                            {quest.completedYesterday && (
                              <span className="completed-yesterday">
                                Completed yesterday
                              </span>
                            )}
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
        <p className="eyebrow">AWAITING REVIEW</p>
        <h2>The Quest Master needs another look</h2>
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
          No XP earned yet. This result is awaiting review; you can’t submit
          another attempt until the Quest Master resolves it.
        </p>
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
