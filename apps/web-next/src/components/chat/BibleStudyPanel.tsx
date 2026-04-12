import type {
  BibleLearningProgressState,
  BibleLearningTrack,
  BibleStudyModuleOption,
} from "./types";
import { BibleMascotPanel } from "./BibleMascotPanel";

const BIBLE_CODE_OPTIONS = ["NAA", "ARC", "ACF", "ARA", "NVI", "NVT"];

const MINISTRY_FOCUS_OPTIONS = [
  { value: "", label: "Leitura geral" },
  { value: "new_believers", label: "Novos convertidos" },
  { value: "teaching", label: "Ensino e aula" },
  { value: "preaching", label: "Pregacao e sermoes" },
];

const DEPTH_OPTIONS = [
  { value: "beginner", label: "Didatico" },
  { value: "balanced", label: "Equilibrado" },
  { value: "advanced", label: "Avancado" },
];

type BibleStudyPanelProps = {
  mascotMode?: "idle" | "listening" | "speaking" | "celebrating";
  mascotStatusLabel?: string | null;
  mascotVoiceEnabled?: boolean;
  moduleCatalog: BibleStudyModuleOption[];
  modeLocked?: boolean;
  onApplyStarter: (prompt: string) => void;
  onPreferredBibleCodeChange: (value: string) => void;
  onSelectStep: (trackId: string, stepId: string) => void;
  onSelectTrack: (trackId: string) => void;
  onStudyDepthPreferenceChange: (value: string) => void;
  onStudyMinistryFocusChange: (value: string) => void;
  onToggleModule: (moduleId: string) => void;
  onToggleStepDone: (trackId: string, stepId: string) => void;
  onToggleStudyMode: () => void;
  preferredBibleCode: string;
  progressState: BibleLearningProgressState;
  providerStatusLabel: string | null;
  selectedModuleIds: string[];
  studyDepthPreference: string;
  studyMinistryFocus: string;
  studyModeEnabled: boolean;
  studyTrackId: string | null;
  tracks: BibleLearningTrack[];
};

function getProgressEntry(progressState: BibleLearningProgressState, track: BibleLearningTrack) {
  return progressState[track.id] || {
    completedStepIds: [],
    currentStepId: track.steps[0]?.id || null,
    updatedAt: null,
  };
}

function getTrackTone(index: number) {
  return ["emerald", "sky", "amber", "rose"][index % 4];
}

function isCheckpointStep(stepIndex: number, totalSteps: number) {
  return (stepIndex + 1) % 3 === 0 || stepIndex === totalSteps - 1;
}

function getCheckpointLabel(stepIndex: number, totalSteps: number) {
  if (stepIndex === totalSteps - 1) {
    return "Conclusao";
  }

  return `Bloco ${Math.floor(stepIndex / 3) + 1}`;
}

function getStepMilestoneLabel(stepIndex: number, totalSteps: number) {
  for (let index = stepIndex; index < totalSteps; index += 1) {
    if (isCheckpointStep(index, totalSteps)) {
      return getCheckpointLabel(index, totalSteps);
    }
  }

  return getCheckpointLabel(totalSteps - 1, totalSteps);
}

export function BibleStudyPanel({
  mascotMode = "idle",
  mascotStatusLabel = null,
  mascotVoiceEnabled = false,
  moduleCatalog,
  modeLocked = false,
  onApplyStarter,
  onPreferredBibleCodeChange,
  onSelectStep,
  onSelectTrack,
  onStudyDepthPreferenceChange,
  onStudyMinistryFocusChange,
  onToggleModule,
  onToggleStepDone,
  onToggleStudyMode,
  preferredBibleCode,
  progressState,
  providerStatusLabel,
  selectedModuleIds,
  studyDepthPreference,
  studyMinistryFocus,
  studyModeEnabled,
  studyTrackId,
  tracks,
}: BibleStudyPanelProps) {
  const activeTrack = tracks.find((track) => track.id === studyTrackId) || tracks[0] || null;
  const activeTrackIndex = activeTrack ? tracks.findIndex((track) => track.id === activeTrack.id) : 0;
  const activeTrackTone = getTrackTone(activeTrackIndex >= 0 ? activeTrackIndex : 0);
  const progressEntry = activeTrack ? getProgressEntry(progressState, activeTrack) : null;
  const completedSteps = new Set(progressEntry?.completedStepIds || []);
  const completionRate = activeTrack?.steps.length
    ? Math.round((completedSteps.size / activeTrack.steps.length) * 100)
    : 0;
  const totalSteps = activeTrack?.steps.length || 0;
  const completedCount = completedSteps.size;
  const currentStepIndex = activeTrack
    ? activeTrack.steps.findIndex((step) => step.id === progressEntry?.currentStepId)
    : -1;
  const nextStepIndex = activeTrack
    ? activeTrack.steps.findIndex(
        (step, index) => !completedSteps.has(step.id) && index > currentStepIndex,
      )
    : -1;
  const fallbackNextStepIndex = activeTrack
    ? activeTrack.steps.findIndex(
        (step) => !completedSteps.has(step.id) && step.id !== progressEntry?.currentStepId,
      )
    : -1;
  const resolvedNextStepIndex = nextStepIndex >= 0 ? nextStepIndex : fallbackNextStepIndex;
  const currentStepLabel = activeTrack
    ? (progressEntry?.currentStepId ? activeTrack.steps.find((step) => step.id === progressEntry.currentStepId)?.label : null)
      || activeTrack.steps[0]?.label
      || null
    : null;
  const checkpointSteps = activeTrack
    ? activeTrack.steps
        .map((step, index) => ({
          id: step.id,
          index,
          label: getCheckpointLabel(index, activeTrack.steps.length),
        }))
        .filter((entry) => isCheckpointStep(entry.index, activeTrack.steps.length))
    : [];
  const completedCheckpointCount = checkpointSteps.filter((entry) => completedSteps.has(entry.id)).length;
  const nextCheckpoint = checkpointSteps.find((entry) => !completedSteps.has(entry.id)) || null;
  const highlightedModules = activeTrack
    ? moduleCatalog.filter((module) => activeTrack.bibleStudyModules.includes(module.id))
    : [];
  const streakDays = Math.max(1, completedCheckpointCount + (studyModeEnabled ? 1 : 0));
  const earnedXp = completedCount * 18 + (studyModeEnabled ? 12 : 0);
  const currentLessonLabel = currentStepLabel || "Escolha a primeira licao";
  const leagueLabel = completionRate >= 85
    ? "Coroa dourada"
    : completionRate >= 50
      ? "Liga sabedoria"
      : "Liga semente";
  const missionLabel = nextCheckpoint
    ? `Feche ${nextCheckpoint.label} e avance para a proxima medalha.`
    : "Complete a trilha atual para abrir uma nova rodada de revisao."
  const energyLabel = mascotVoiceEnabled ? "Escuta + voz prontas" : "Texto guiado pronto";

  return (
    <section
      className={`study-panel ${studyModeEnabled ? "active" : ""}`}
      data-tone={activeTrackTone}
      aria-label="Fale Biblico"
    >
      <div className="study-panel-head">
        <div>
          <p className="study-panel-kicker">Fale Biblico</p>
          <h3>Curriculo guiado</h3>
          <p>Ative uma trilha e mande contexto biblico estruturado para o GIOM.</p>
        </div>

        <button type="button" className="study-mode-toggle" onClick={onToggleStudyMode}>
          {modeLocked ? "Ativo neste workspace" : studyModeEnabled ? "Ativo" : "Ativar"}
        </button>
      </div>

      <div className="study-quest-strip" aria-label="Resumo gamificado da trilha">
        <article className="study-quest-card streak">
          <span>Sequencia</span>
          <strong>{streakDays} dias</strong>
          <small>ritmo de estudo</small>
        </article>
        <article className="study-quest-card xp">
          <span>XP biblico</span>
          <strong>{earnedXp}</strong>
          <small>acumulado na trilha</small>
        </article>
        <article className="study-quest-card lesson">
          <span>Licao atual</span>
          <strong>{currentLessonLabel}</strong>
          <small>{energyLabel}</small>
        </article>
        <article className="study-quest-card league">
          <span>Liga</span>
          <strong>{leagueLabel}</strong>
          <small>{missionLabel}</small>
        </article>
      </div>

      <BibleMascotPanel
        medalProgressLabel={checkpointSteps.length ? `${completedCheckpointCount}/${checkpointSteps.length}` : null}
        mode={mascotMode}
        nextMedalLabel={nextCheckpoint?.label || (checkpointSteps.length ? "Todas liberadas" : null)}
        progressPercent={completionRate}
        statusLabel={mascotStatusLabel}
        stepLabel={currentStepLabel}
        studyModeEnabled={studyModeEnabled}
        trackLabel={activeTrack?.label || null}
        variant="compact"
        voiceEnabled={mascotVoiceEnabled}
      />

      {providerStatusLabel && <p className="study-panel-provider">{providerStatusLabel}</p>}

      <div className="study-track-grid">
        {tracks.map((track, index) => {
          const active = activeTrack?.id === track.id;
          const trackProgress = getProgressEntry(progressState, track);
          const trackCompletedSteps = new Set(trackProgress.completedStepIds || []);
          const trackCompletionRate = track.steps.length
            ? Math.round((trackCompletedSteps.size / track.steps.length) * 100)
            : 0;
          const nextStepLabel = track.steps.find((step) => !trackCompletedSteps.has(step.id))?.label || track.steps[track.steps.length - 1]?.label || "Trilha pronta";
          return (
            <button
              key={track.id}
              type="button"
              className={`study-track-chip ${active ? "active" : ""}`}
              data-tone={getTrackTone(index)}
              onClick={() => onSelectTrack(track.id)}
            >
              <div className="study-track-card-top">
                <span className="study-track-card-kicker">{active ? "Ativa" : "Trilha"}</span>
                <span className="study-track-card-progress">{trackCompletedSteps.size}/{track.steps.length}</span>
              </div>
              <strong>{track.label}</strong>
              <span>{track.summary}</span>
              <div className="study-track-card-meta">
                <span>{track.steps.length} etapas</span>
                <span>{track.bibleStudyModules.length} modulos</span>
              </div>
              <div className="study-track-card-next">
                <small>Proxima</small>
                <p>{nextStepLabel}</p>
              </div>
              <progress className="study-track-card-bar" aria-hidden="true" max={100} value={trackCompletionRate} />
            </button>
          );
        })}
      </div>

      {activeTrack ? (
        <>
          <div className="study-panel-stats">
            <div>
              <strong>{completionRate}%</strong>
              <small>progresso</small>
            </div>
            <div>
              <strong>{activeTrack.steps.length}</strong>
              <small>etapas</small>
            </div>
            <div>
              <strong>{selectedModuleIds.length}</strong>
              <small>modulos</small>
            </div>
          </div>

          <section className="study-path-shell" aria-label="Mapa da trilha atual">
            <div className="study-path-head">
              <div>
                <p className="study-section-kicker">Mapa da trilha</p>
                <strong>{activeTrack.label}</strong>
              </div>
              <span className="study-path-progress">{completedCount}/{totalSteps} etapas</span>
            </div>
            <progress className="study-path-meter" aria-hidden="true" max={100} value={completionRate} />
            <div className="study-path-milestones">
              <div className="study-path-milestone-chip">
                <span>Medalhas</span>
                <strong>{completedCheckpointCount}/{checkpointSteps.length}</strong>
              </div>
              <div className={`study-path-milestone-chip ${nextCheckpoint ? "" : "complete"}`}>
                <span>{nextCheckpoint ? "Proxima medalha" : "Colecao"}</span>
                <strong>{nextCheckpoint ? nextCheckpoint.label : "Todas liberadas"}</strong>
              </div>
            </div>
          </section>

          <div className="study-control-grid">
            <label className="study-control-field">
              <span>Traducao</span>
              <select value={preferredBibleCode} onChange={(event) => onPreferredBibleCodeChange(event.target.value)}>
                {BIBLE_CODE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label className="study-control-field">
              <span>Profundidade</span>
              <select
                value={studyDepthPreference}
                onChange={(event) => onStudyDepthPreferenceChange(event.target.value)}
              >
                {DEPTH_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="study-control-field study-control-field-wide">
              <span>Contexto ministerial</span>
              <select
                value={studyMinistryFocus}
                onChange={(event) => onStudyMinistryFocusChange(event.target.value)}
              >
                {MINISTRY_FOCUS_OPTIONS.map((option) => (
                  <option key={option.value || "general"} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="study-step-list">
            {activeTrack.steps.map((step, index) => {
              const isDone = completedSteps.has(step.id);
              const isCurrent = progressEntry?.currentStepId === step.id;
              const isNext = !isCurrent && !isDone && index === resolvedNextStepIndex;
              const isLast = index === activeTrack.steps.length - 1;
              const isCheckpoint = isCheckpointStep(index, activeTrack.steps.length);
              const lane = index % 2 === 0 ? "right" : "left";
              const statusLabel = isCurrent ? "Atual" : isDone ? "Concluida" : isNext ? "Proxima" : "Na fila";
              const crestLabel = isDone ? "OK" : isCheckpoint ? "CP" : String(index + 1).padStart(2, "0");
              const milestoneLabel = getStepMilestoneLabel(index, activeTrack.steps.length);
              const rewardLabel = isDone
                ? isCheckpoint
                  ? `${milestoneLabel} liberado`
                  : `Rumo a ${milestoneLabel}`
                : isCheckpoint
                  ? `${milestoneLabel} ao concluir`
                  : isCurrent
                    ? `Rumo a ${milestoneLabel}`
                    : isNext
                      ? `Proximo: ${milestoneLabel}`
                      : `Na rota de ${milestoneLabel}`;

              return (
                <article
                  key={step.id}
                  className={`study-step-card ${isCurrent ? "active" : ""} ${isDone ? "done" : ""} ${isNext ? "next" : ""}`}
                  data-lane={lane}
                  data-checkpoint={isCheckpoint ? "true" : "false"}
                >
                  <div className="study-step-rail" aria-hidden="true">
                    <span className={`study-step-node ${isCurrent ? "active" : ""} ${isDone ? "done" : ""} ${isNext ? "next" : ""}`}></span>
                    {!isLast ? <span className={`study-step-line ${isDone ? "done" : ""} ${isCurrent ? "active" : ""}`}></span> : null}
                  </div>
                  <div className="study-step-shell">
                    <button
                      type="button"
                      className="study-step-main"
                      onClick={() => onSelectStep(activeTrack.id, step.id)}
                      aria-label={`Etapa ${index + 1}: ${step.label} (${statusLabel})`}
                    >
                      <span className="study-step-index">{String(index + 1).padStart(2, "0")}</span>
                      <div className="study-step-copy">
                        <div className="study-step-topline">
                          <span className={`study-step-state ${isCurrent ? "current" : isDone ? "done" : isNext ? "next" : ""}`}>
                            {statusLabel}
                          </span>
                          {isCheckpoint || isDone ? (
                            <span className={`study-step-checkpoint ${isDone ? "done" : ""}`}>
                              {isDone ? "Medalha" : "Checkpoint"}
                            </span>
                          ) : null}
                        </div>
                        <strong>{step.label}</strong>
                        <p>{step.summary}</p>
                        <small>{step.goal}</small>
                        <div className={`study-step-reward ${isCurrent ? "current" : ""} ${isDone ? "done" : ""} ${isNext ? "next" : ""} ${isCheckpoint ? "checkpoint" : ""}`}>
                          {rewardLabel}
                        </div>
                      </div>
                      <div
                        className={`study-step-crest ${isCurrent ? "active" : ""} ${isDone ? "done" : ""} ${isNext ? "next" : ""} ${isCheckpoint ? "checkpoint" : ""}`}
                        aria-hidden="true"
                      >
                        <span className="study-step-crest-core">{crestLabel}</span>
                      </div>
                    </button>

                    <div className="study-step-actions">
                      <button type="button" className="study-step-action" onClick={() => onApplyStarter(step.promptStarter)}>
                        Usar prompt
                      </button>
                      <button
                        type="button"
                        className={`study-step-action ${isDone ? "secondary" : ""}`}
                        onClick={() => onToggleStepDone(activeTrack.id, step.id)}
                      >
                        {isDone ? "Reabrir" : "Concluir"}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="study-module-grid">
            {highlightedModules.map((module) => {
              const active = selectedModuleIds.includes(module.id);

              return (
                <button
                  key={module.id}
                  type="button"
                  className={`study-module-chip ${active ? "active" : ""}`}
                  onClick={() => onToggleModule(module.id)}
                >
                  <strong>{module.label}</strong>
                  <span>{module.summary}</span>
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <p className="study-panel-empty">O curriculo biblico ainda nao carregou neste ambiente.</p>
      )}
    </section>
  );
}
