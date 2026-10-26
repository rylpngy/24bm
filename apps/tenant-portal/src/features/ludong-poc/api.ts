import { axiosInstance, downloadReport } from '@24bid/api-client';

export interface LudongItem {
  materialId: string;
  materialCode: string;
  materialCategory: string;
  catalogSource: 'catalog' | 'custom';
  governmentMallCatalog: '' | '是' | '否';
  governmentMallCatalogMode: 'auto' | 'manual';
  governmentMallCatalogReason: string;
  governmentMallCatalogSystemValue: '' | '是' | '否';
  governmentMallCatalogSystemReason: string;
  unit: string;
  name: string;
  quantity: string;
  unitPrice: string;
  totalPrice: string;
  technicalParameters: string;
  referenceBrands: string;
  imported: string;
  importLeadTime: string;
  purpose: string;
  usageDirection: string;
  userName: string;
  installationLocation: string;
  coreProduct: '' | '是' | '否';
  standardUnitPrice: string;
  selectedBrand: string;
  selectedModel: string;
  selectedSupplier: string;
  supplierContact: string;
  supplierPhone: string;
  productLink: string;
  selectedParameters: string;
  selectedUnitPrice: string;
  selectionParticipants: string;
}

export interface LudongApplication {
  id: string;
  applicationNo: string;
  projectName: string;
  applicantUnit: string;
  departmentId?: string;
  budgetAmount: number;
  status: 'draft' | 'in_approval' | 'approved' | 'rejected' | 'archived';
  formData: Record<string, string>;
  items: LudongItem[];
  createdBy: string;
  submittedAt?: string;
  approvedAt?: string;
  archivedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LudongStats {
  total: number;
  drafts: number;
  inApproval: number;
  approved: number;
  archived: number;
  totalBudget: number;
}

export interface WorkflowTask {
  taskId: string;
  workflowInstanceId: string;
  businessType: string;
  businessId: string;
  taskName: string;
  taskDefinitionKey: string;
  candidateRoleIds?: string[];
  createdAt?: string;
}

export interface WorkflowEvent {
  id: string;
  flowableTaskId?: string;
  nodeName: string;
  nodeId: string;
  action: string;
  effective?: boolean;
  actorId?: string;
  actorName?: string;
  comment?: string;
  createdAt: string;
}

export interface WorkflowHistory {
  workflowInstanceId: string;
  businessType?: string;
  businessId?: string;
  status: string;
  definitionVersionId?: string;
  initiatorId?: string;
  initiatorName?: string;
  completedBy?: string;
  completedByName?: string;
  formData?: Record<string, unknown>;
  businessSnapshot?: Record<string, unknown>;
  currentTask?: WorkflowTask;
  createdAt?: string;
  completedAt?: string;
  events: WorkflowEvent[];
}

export interface WorkflowLedgerItem {
  workflowInstanceId: string;
  businessType: string;
  businessId: string;
  definitionVersionId?: string;
  status: string;
  initiatorId: string;
  initiatorName?: string;
  amount?: number;
  currentTask?: WorkflowTask;
  createdAt?: string;
  completedAt?: string;
  updatedAt?: string;
}

export interface LudongAiReviewFinding {
  findingId: string;
  level: 'passed' | 'warning' | 'risk';
  title: string;
  detail: string;
  evidence: string;
  evidenceReferences: LudongAiEvidenceReference[];
}

export interface LudongAiEvidenceReference {
  id: string;
  type: 'FIELD' | 'RULE' | 'PRIOR_APPROVAL';
  label: string;
  value: string;
  source: string;
  verificationStatus: string;
}

export interface LudongAiReviewResult {
  runId: string;
  analysisMode: 'AI_MODEL' | 'RULE_ASSISTED' | 'RULE_FALLBACK';
  modelName: string;
  knowledgeVersion: string;
  institutionalBasis: string;
  evidenceBoundary: string;
  institutionalDocuments: string[];
  generatedAt: string;
  nodeName: string;
  summary: string;
  recommendation: string;
  confidence: number;
  reviewFocus: string[];
  findings: LudongAiReviewFinding[];
  missingMaterials: string[];
  suggestedComment: string;
  accuracyNotice: string;
}

export interface LudongAiReviewMetrics {
  datasetVersion: string;
  fixedSampleCount: number;
  expectedRiskCount: number;
  detectedRiskCount: number;
  truePositiveCount: number;
  falsePositiveCount: number;
  riskRecall: number;
  riskPrecision: number;
  humanFeedbackCount: number;
  adoptedCount: number;
  humanFalsePositiveCount: number;
  adoptionRate: number;
}

interface Envelope<T> { success: boolean; data: T; message: string }

const unwrap = async <T>(promise: Promise<{ data: Envelope<T> }>) => (await promise).data.data;

export type LudongArchiveMaterialCategory =
  | 'project_attachment'
  | 'mall_confirmation'
  | 'supplementary_evidence';

export interface LudongArchiveMaterialCategoryMeta {
  id: LudongArchiveMaterialCategory;
  ownerType: string;
  label: string;
  required: boolean;
}

export interface LudongArchiveMaterial {
  id: string;
  ownerType: string;
  ownerId: string;
  fileName: string;
  uploadedBy: string;
  createdAt: string;
  category: LudongArchiveMaterialCategory;
}

export const ludongArchiveMaterialCategories: LudongArchiveMaterialCategoryMeta[] = [
  { id: 'project_attachment', ownerType: 'ludong_poc_project_attachment', label: '项目附件', required: true },
  { id: 'mall_confirmation', ownerType: 'ludong_poc_mall_confirmation', label: '商城确认材料', required: true },
  { id: 'supplementary_evidence', ownerType: 'ludong_poc_supplementary_evidence', label: '补充证明', required: false },
];

interface AttachmentPayload {
  id: string;
  ownerType: string;
  ownerId: string;
  fileName: string;
  uploadedBy: string;
  createdAt: string;
}

interface AttachmentUploadTicket {
  storageKey: string;
  uploadUrl: string;
}

async function listArchiveMaterials(applicationId: string): Promise<LudongArchiveMaterial[]> {
  const groups = await Promise.all(ludongArchiveMaterialCategories.map(async (category) => {
    const values = await unwrap<AttachmentPayload[]>(axiosInstance.get('/api/v1/buyer/attachments', {
      params: { ownerType: category.ownerType, ownerId: applicationId },
    }));
    return values.map((value) => ({ ...value, category: category.id }));
  }));
  return groups.flat().sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

async function uploadArchiveMaterial(
  applicationId: string,
  categoryId: LudongArchiveMaterialCategory,
  file: File,
): Promise<void> {
  const category = ludongArchiveMaterialCategories.find((item) => item.id === categoryId);
  if (!category) throw new Error('Unsupported archive material category');
  const ticket = await unwrap<AttachmentUploadTicket>(axiosInstance.post(
    '/api/v1/buyer/attachments/upload-ticket',
    {
      ownerType: category.ownerType,
      ownerId: applicationId,
      fileName: file.name,
      visibility: 'buyer_internal',
    },
  ));
  await axiosInstance.post(ticket.uploadUrl, await file.arrayBuffer(), {
    params: { contentType: file.type || 'application/octet-stream' },
    headers: { 'Content-Type': 'application/octet-stream' },
  });
  await axiosInstance.post('/api/v1/buyer/attachments', {
    ownerType: category.ownerType,
    ownerId: applicationId,
    fileName: file.name,
    storageKey: ticket.storageKey,
    visibility: 'buyer_internal',
  });
}

export const ludongApi = {
  list: () => unwrap<LudongApplication[]>(axiosInstance.get('/api/v1/buyer/ludong-poc/applications')),
  get: (id: string) => unwrap<LudongApplication>(axiosInstance.get(`/api/v1/buyer/ludong-poc/applications/${id}`)),
  stats: () => unwrap<LudongStats>(axiosInstance.get('/api/v1/buyer/ludong-poc/stats')),
  create: (data: Omit<LudongApplication, 'id' | 'applicationNo' | 'status' | 'createdBy' | 'createdAt' | 'updatedAt'>) =>
    unwrap<LudongApplication>(axiosInstance.post('/api/v1/buyer/ludong-poc/applications', data)),
  update: (id: string, data: Pick<LudongApplication, 'projectName' | 'applicantUnit' | 'departmentId' | 'budgetAmount' | 'formData' | 'items'>) =>
    unwrap<LudongApplication>(axiosInstance.put(`/api/v1/buyer/ludong-poc/applications/${id}`, data)),
  submit: (id: string) => unwrap<LudongApplication>(axiosInstance.post(`/api/v1/buyer/ludong-poc/applications/${id}/submit`)),
  tasks: () => unwrap<WorkflowTask[]>(axiosInstance.get('/api/v1/buyer/workflow/tasks')),
  processed: () => unwrap<WorkflowLedgerItem[]>(axiosInstance.get('/api/v1/buyer/workflow/instances', {
    params: { view: 'processed', limit: 100 },
  })),
  complete: (
    task: WorkflowTask,
    action: 'approve' | 'reject',
    comment: string,
    reviewData: Record<string, unknown>,
  ) => unwrap<WorkflowHistory>(axiosInstance.post(`/api/v1/buyer/ludong-poc/tasks/${task.taskId}/complete`, {
    applicationId: task.businessId,
    nodeId: task.taskDefinitionKey,
    action,
    comment,
    reviewData,
  })),
  aiReview: (applicationId: string, nodeId: string, currentReviewData: Record<string, unknown>) =>
    unwrap<LudongAiReviewResult>(axiosInstance.post(
      `/api/v1/buyer/ludong-poc/applications/${applicationId}/ai-review`,
      { nodeId, currentReviewData },
    )),
  aiReviewFeedback: (
    applicationId: string,
    runId: string,
    findingId: string,
    disposition: 'adopted' | 'false_positive' | 'noted',
  ) => unwrap<void>(axiosInstance.post(
    `/api/v1/buyer/ludong-poc/applications/${applicationId}/ai-review/${runId}/feedback`,
    { findingId, disposition },
  )),
  aiReviewMetrics: () => unwrap<LudongAiReviewMetrics>(
    axiosInstance.get('/api/v1/buyer/ludong-poc/ai-review/metrics')),
  listArchiveMaterials,
  uploadArchiveMaterial,
  downloadArchiveMaterial: (material: Pick<LudongArchiveMaterial, 'id' | 'fileName'>) =>
    downloadReport(`/api/v1/buyer/attachments/${material.id}/download`, material.fileName),
  history: async (id: string) => {
    const response = await axiosInstance.get<Envelope<WorkflowHistory | null>>(
      `/api/v1/buyer/workflow/instances/business/ludong_project_application/${id}/history`,
    );
    return response.data.data;
  },
  instances: (id: string, page: number) => unwrap<{items: WorkflowLedgerItem[]; total: number}>(axiosInstance.get(
    `/api/v1/buyer/workflow/instances/business/ludong_project_application/${id}/instances`, {params: {page, pageSize: 5}})),
  historyById: (id: string) => unwrap<WorkflowHistory>(axiosInstance.get(`/api/v1/buyer/workflow/instances/${id}/history`)),
  reviewRecords: (id: string, instanceId: string) => unwrap<{
    id: string; workflowTaskId: string; nodeId: string; reviewerId: string; decision: string;
    reviewDataJson: string; comment: string; reviewedAt: string;
  }[]>(axiosInstance.get(`/api/v1/buyer/ludong-poc/applications/${id}/approval-records`, {params: {instanceId}})),
  downloadDemand: (id: string) => downloadReport(
    `/api/v1/buyer/ludong-poc/applications/${id}/documents/demand.docx`, '采购需求表（货物类）.docx'),
  downloadApplication: (id: string) => downloadReport(
    `/api/v1/buyer/ludong-poc/applications/${id}/documents/application.docx`, '货物类项目采购及招标申请单、受理单.docx'),
  downloadArchive: (id: string) => downloadReport(
    `/api/v1/buyer/ludong-poc/applications/${id}/documents/archive.zip`, '鲁东大学货物类采购申报归档.zip'),
  downloadAnalyticsReport: (year: number, quarter?: number) => downloadReport(
    `/api/v1/buyer/ludong-poc/reports.xlsx?year=${year}${quarter ? `&quarter=${quarter}` : ''}`,
    `鲁东大学采购申报${year}年${quarter ? `第${quarter}季度` : '度'}统计报告.xlsx`,
  ),
};

export const emptyItem = (): LudongItem => ({
  materialId: '', materialCode: '', materialCategory: '', catalogSource: 'custom', governmentMallCatalog: '',
  governmentMallCatalogMode: 'auto', governmentMallCatalogReason: '', unit: '',
  governmentMallCatalogSystemValue: '', governmentMallCatalogSystemReason: '',
  name: '', quantity: '', unitPrice: '', totalPrice: '', technicalParameters: '', referenceBrands: '',
  imported: '', importLeadTime: '', purpose: '', usageDirection: '', userName: '', installationLocation: '',
  coreProduct: '', standardUnitPrice: '', selectedBrand: '', selectedModel: '', selectedSupplier: '', supplierContact: '',
  supplierPhone: '', productLink: '', selectedParameters: '', selectedUnitPrice: '', selectionParticipants: '',
});

export const domesticPaymentTerms = '国产设备合同签订生效，具备实施条件后 5 个工作日内支付预付款30%；设备到货经采购人验收合格且在中标人开出全额增值税专用发票后，采购人按合同约定付清余款。';
export const importPaymentTerms = '进口设备按人民币报价，免税工作由甲方指定的外贸代理机构（丙方）办理，报价为到用户（甲方）指定地点的最终价格（含外贸代理费），外贸代理费用包含但不限于办理对外开立信用证、付汇、核销、报关、检验检疫、提货、运输、送货、货物保险、仓库费及索赔费等费用。合同签订生效，具备实施条件后 5 个工作日内支付预付款30%；设备到货验收合格，凭丙方开具的进口设备增值税普通发票，付清余款。';

export const defaultFormData: Record<string, string> = {
  applicantUnitType: '',
  projectLeaderName: '',
  projectLeaderPhone: '',
  technicalLeaderName: '',
  technicalLeaderPhone: '',
  fundingSource: '',
  fundingProjectName: '',
  fundingProjectNo: '',
  requiresItReview: '',
  requiresAssetReview: '',
  requiresLabReview: '',
  mallSelectionApplicable: '',
  participants: '',
  purchaseReason: '',
  smeSuitable: '',
  microSuitable: '',
  procurementFunction: '',
  procurementGoal: '',
  mandatoryStandards: '',
  otherStandards: '',
  supplierQualifications: '',
  implementationLocation: '',
  installationReady: '',
  utilitiesReady: '',
  assetDisposalPlan: '',
  deliveryDays: '',
  coreProduct: '',
  packingRequirement: '',
  warrantyYears: '',
  domesticPaymentTerms,
  importPaymentTerms,
  afterSalesRequirement: '',
  acceptanceStandard: '',
  otherTechnicalRequirements: '',
  siteVisitRequired: '',
  siteVisitTime: '',
  siteVisitLocation: '',
  siteVisitContact: '',
  siteVisitPhone: '',
  sampleRequired: '',
  sampleRequirement: '',
  demoRequired: '',
  demoDuration: '',
  demoRequirement: '',
  otherNotes: '',
};
