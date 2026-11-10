import { agencyRequest } from "./agency";
export type ExecutionChapter = {
  code: string;
  title: string;
  body: string;
  required: boolean;
};
export type ExecutionRevision = {
  id: string;
  inputVersion: number;
  sourceKind: string;
  status: string;
  workflowId?: string;
  fileVersionId: string;
  hash: string;
  comment?: string;
};
export type ExecutionDocument = {
  document: {
    id: string;
    kind: string;
    version: number;
    status: string;
    currentRevisionId?: string;
  };
  sections: ExecutionChapter[];
  settings: Record<string, string>;
  revisions: ExecutionRevision[];
  basisStale: boolean;
  issues: string[];
};
export type ExecutionDemand = {
  id: string;
  fieldKey: string;
  valueText: string;
  sourceVersionId: string;
  locator: string;
  status: string;
  version: number;
  origin: string;
};
export type ExecutionTemplate = {
  template: {
    id: string;
    name: string;
    scope: string;
    procurementMethod: string;
    version: number;
    active: boolean;
    publishedVersionId?: string;
    packageId?: string;
    objectCode?: string;
    regime?: string;
    region?: string;
    description?: string;
  };
  versions: {
    id: string;
    ordinal: number;
    status: string;
    sectionsJson: string;
    sourceNote: string;
    sourceDate?: string;
    policyVersion?: string;
    originTemplateVersionId?: string;
    workflowId?: string;
  }[];
};
export type ExecutionMilestone = {
  id: string;
  title: string;
  nodeKey: string;
  ownerId?: string;
  startsAt?: string;
  dueAt?: string;
  dependenciesJson: string;
  materialRequirement: string;
  status: string;
  resultNote: string;
  legalDeadline?: string;
  legalBasis: string;
  version: number;
  templateVersion: number;
  completedAt?: string;
};
export type ExecutionParticipation = {
  importId?: string;
  sourceRow?: number;
  id: string;
  supplierName: string;
  creditCode: string;
  contact: string;
  phone: string;
  source: string;
  acquisitionStatus: string;
  submissionStatus: string;
  riskNote: string;
  riskStatus: string;
  evidenceVersionId?: string;
  notes: string;
  version: number;
};
export type ExecutionPreparation = {
  venue: string;
  scheduledAt?: string;
  scheduledEndAt?: string;
  purpose?: string;
  materialNotes: string;
  committeeNotes?: string;
  drawNotes?: string;
  evidenceVersionId?: string;
  version: number;
};
export type ExecutionWorkspace = {
  requirements: ExecutionDemand[];
  documents: ExecutionDocument[];
  publicationRule?: {
    version: number;
    announcementApplicable: boolean;
    reason: string;
    evidenceVersionId: string;
  };
  readiness?: {
    ready: boolean;
    reasons: string[];
    purchaseRevisionId?: string;
    announcementRevisionId?: string;
    announcementApplicable: boolean;
  };
  publications: {
    id: string;
    platform: string;
    publishedAt: string;
    url?: string;
    purchaseRevisionId: string;
    announcementRevisionId?: string;
  }[];
  participations: ExecutionParticipation[];
  milestones: ExecutionMilestone[];
  preparation?: ExecutionPreparation;
  jobs: {
    id: string;
    kind: string;
    status: string;
    errorText?: string;
    attempts: number;
    resultJson?: string;
  }[];
  aiEnabled: boolean;
  onlineOfficeEnabled: boolean;
};
export const executionRequest = <T>(
  path: string,
  method = "GET",
  data?: unknown,
) => agencyRequest<T>("/execution" + path, method, data);
export const executionWorkspace = (id: string) =>
  executionRequest<ExecutionWorkspace>("/packages/" + encodeURIComponent(id));
export const executionTemplates = (id: string, keyword = "") =>
  executionRequest<ExecutionTemplate[]>(
    "/packages/" +
      encodeURIComponent(id) +
      "/templates?keyword=" +
      encodeURIComponent(keyword),
  );
export type AgencyReminderSettings = {
  enabled: boolean;
  leadHours: number[];
  overdueHours: number[];
  escalationUserId?: string | null;
  escalationAfterHours: number;
};
export type AgencyReminderPolicy = {
  milestoneId: string;
  settingsJson: string;
  version: number;
  reason: string;
};
export type AgencyReminderDelivery = {
  id: string;
  milestoneId: string;
  milestoneVersion: number;
  policyVersion: number;
  recipientId: string;
  level: string;
  status: string;
  attempts: number;
  nextAttemptAt?: string;
  sentAt?: string;
  errorText?: string;
};
export type AgencyReminders = {
  policies: AgencyReminderPolicy[];
  deliveries: { delivery: AgencyReminderDelivery; readAt?: string }[];
  smsEnabled: boolean;
};
export type ParticipationImportRow = {
  rowNumber: number;
  data: {
    supplierName: string;
    creditCode: string;
    contact: string;
    phone: string;
    source: string;
    acquisitionStatus: string;
    submissionStatus: string;
    riskNote: string;
    riskStatus: string;
    notes: string;
  };
  errors: string[];
  warnings: string[];
};
export type ParticipationImportView = {
  record: {
    id: string;
    sourceVersionId: string;
    sourceHash: string;
    sourceName: string;
    status: string;
    version: number;
    resultJson: string;
    createdAt: string;
  };
  rows: ParticipationImportRow[];
  errorCount: number;
  warningCount: number;
};
export type ParticipationImportSummary = {
  id: string;
  sourceName: string;
  sourceVersionId: string;
  status: string;
  version: number;
  rowCount: number;
  createdAt: string;
};
export type PreparationPerson = {
  id: string;
  name: string;
  organization: string;
  role: string;
  status: string;
  version: number;
  reason: string;
};
export type PreparationForm = {
  id: string;
  groupId: string;
  ordinal: number;
  kind: string;
  code: string;
  title: string;
  bodyText: string;
  fileVersionId: string;
  fileHash: string;
  status: string;
  version: number;
  createdAt: string;
  voidReason?: string;
};
export type PreparationFormView = {
  form: PreparationForm;
  people: PreparationPerson[];
  stale: boolean;
  currentReturnedPeople: string[];
};
export type PreparationReturn = {
  id: string;
  formId: string;
  peopleJson: string;
  fileVersionId: string;
  fileHash: string;
  signedOn: string;
  note: string;
  staleReason: string;
  status: string;
  version: number;
  voidReason?: string;
};
export type PreparationFormsWorkspace = {
  people: PreparationPerson[];
  forms: PreparationFormView[];
  returns: PreparationReturn[];
  packageVersion: number;
  preparationVersion: number;
};
