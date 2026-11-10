import { agencyRequest } from "./agency";
export type EvaluationCriterion = {
  key: string;
  title: string;
  stage: string;
  applicableTo: string;
  resultType: string;
  minimum: string | number;
  maximum: string | number;
  weight: string | number;
  formula: string;
  evidenceRequired: boolean;
  scale: number;
  rounding: string;
};
export type EvaluationRulePair = {
  documentRule: EvaluationCriterion;
  configuredRule: EvaluationCriterion;
  locator: string;
  manuallyChecked: boolean;
};
export type EvaluationConfig = {
  title: string;
  documentRevisionId: string;
  evaluationMethod: string;
  ruleVersion: string;
  ruleBasis: string;
  venue: string;
  scheduledAt: string | null;
  members: { userId: string; roles: string[] }[];
  rules: EvaluationRulePair[];
  tieRule: string;
};
export type EvaluationView = {
  round: {
    id: string;
    ordinal: number;
    status: string;
    version: number;
    frozenHash?: string;
    frozenAt?: string;
    voidReason: string;
  };
  config: EvaluationConfig;
  roster: { userId: string; name: string; roles: string[] }[];
  differences: {
    key: string;
    field: string;
    documentValue: string;
    configuredValue: string;
  }[];
  blockers: string[];
  frozenBasisStale: boolean;
};
export type EvaluationWorkspace = {
  rounds: EvaluationView[];
  sources: {
    revisionId: string;
    inputVersion: number;
    fileVersionId: string;
    hash: string;
    current: boolean;
    basisStale: boolean;
  }[];
};
export const evaluationRequest = <T>(
  path: string,
  method = "GET",
  body?: unknown,
) => agencyRequest<T>("/evaluation" + path, method, body);
export type AssessmentEntry = {
  participationId: string;
  criterionKey: string;
  score: string | number | null;
  conclusion: string | null;
  evidence: string;
  opinion: string;
};
export type AssessmentSheet = {
  stageKey?: string;
  id: string;
  userId: string;
  ordinal: number;
  status: string;
  entriesJson: string;
  version: number;
  previousId?: string;
  correctionId?: string;
  contentHash?: string;
  submittedAt?: string;
};
export type AssessmentSession = {
  id: string;
  roundId: string;
  roundHash: string;
  subjectsJson: string;
  openedAt: string;
  openingHash: string;
  note: string;
};
export type AssessmentCorrection = {
  id: string;
  sheetId: string;
  cellsJson: string;
  reason: string;
  status: string;
  workflowId: string;
  resultNote: string;
};
export type AssessmentMine = {
  stageKeys?: string[];
  selectedStage?: string;
  session: AssessmentSession;
  subjects: { participationId: string; supplierName: string }[];
  criteria: EvaluationCriterion[];
  sheets: AssessmentSheet[];
  corrections: AssessmentCorrection[];
  writable: boolean;
  blockers: string[];
};
export type AssessmentOverview = {
  sessions: AssessmentSession[];
  availableSubjects: { id: string; supplierName: string }[];
};
export type OpeningItem = {
  key: string;
  title: string;
  required: boolean;
  readerRoles: string[];
};
export type OpeningConfig = {
  cutoffAt: string;
  notBefore: string;
  minimumSubjects: number;
  ruleBasis: string;
  items: OpeningItem[];
};
export type OpeningSummary = {
  id: string;
  manifestHash: string;
  subjects: { participationId: string; supplierName: string }[];
  openedAt: string;
  evidenceVersionId: string;
  note: string;
};
export type OpeningReceipt = {
  receipt: {
    id: string;
    participationId: string;
    itemKey: string;
    receivedAt: string;
    originalType: string;
    sourceNote: string;
    lateEntryReason: string;
    status: string;
    version: number;
    withdrawReason: string;
  };
  file: import("./agency").AgencyFile;
  readable: boolean;
};
export type OpeningWorkspace = {
  plan: { roundId: string; status: string; version: number } | null;
  config: OpeningConfig | null;
  receipts: OpeningReceipt[];
  opening: OpeningSummary | null;
  issues: string[];
};
export type OpeningPreview = {
  planVersion: number;
  subjects: { participationId: string; supplierName: string }[];
  manifest: unknown[];
  blockers: string[];
  fingerprint: string;
};
export type AssessmentStageBoard = {
  stages: {
    stageKey: string;
    released: boolean;
    complete: boolean;
    candidates: {
      participationId: string;
      supplierName: string;
      priorPassed: boolean;
    }[];
    prerequisiteHash: string;
  }[];
};
