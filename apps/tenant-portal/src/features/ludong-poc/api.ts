import { axiosInstance, downloadReport } from '@24bid/api-client';

export interface LudongItem {
  materialId: string;
  materialCode: string;
  materialCategory: string;
  catalogSource: 'catalog' | 'custom';
  governmentMallCatalog: '是' | '否';
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
  configurationLimit: string;
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
  nodeName: string;
  nodeId: string;
  action: string;
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
  | 'configuration_standard'
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
  { id: 'configuration_standard', ownerType: 'ludong_poc_configuration_standard', label: '配置标准', required: true },
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
  await axiosInstance.post('/api/v1/buyer/attachments/upload-sink', await file.arrayBuffer(), {
    params: { storageKey: ticket.storageKey, contentType: file.type || 'application/octet-stream' },
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
  materialId: '', materialCode: '', materialCategory: '', catalogSource: 'custom', governmentMallCatalog: '否', unit: '',
  name: '', quantity: '1', unitPrice: '', totalPrice: '', technicalParameters: '', referenceBrands: '',
  imported: '否', importLeadTime: '', purpose: '', usageDirection: '教学', userName: '', installationLocation: '',
  configurationLimit: '', selectedBrand: '', selectedModel: '', selectedSupplier: '', supplierContact: '',
  supplierPhone: '', productLink: '', selectedParameters: '', selectedUnitPrice: '', selectionParticipants: '',
});

export const defaultFormData: Record<string, string> = {
  applicantUnitType: '学院',
  projectLeaderName: '',
  projectLeaderPhone: '',
  technicalLeaderName: '',
  technicalLeaderPhone: '',
  fundingSource: '',
  fundingProjectName: '',
  fundingProjectNo: '',
  sameFundingUnit: '是',
  requiresItReview: '否',
  requiresAssetReview: '否',
  requiresLabReview: '否',
  mallSelectionApplicable: '是',
  participants: '',
  smeSuitable: '是',
  microSuitable: '否',
  procurementFunction: '',
  procurementGoal: '',
  mandatoryStandards: '符合国家现行强制性标准及相关安全、节能、环保要求。',
  otherStandards: '符合采购文件、产品技术规范及学校使用管理要求。',
  supplierQualifications: '符合政府采购法律法规及采购文件规定的资格条件。',
  implementationLocation: '',
  installationReady: '是',
  utilitiesReady: '是',
  assetDisposalPlan: '不涉及现有资产处置。',
  deliveryDays: '30',
  coreProduct: '',
  packingRequirement: '采用符合运输和设备防护要求的包装，运输、装卸过程造成的损坏由供应商负责。',
  warrantyYears: '3',
  domesticPaymentTerms: '货物安装调试并验收合格后，按合同约定办理付款。',
  importPaymentTerms: '不涉及进口设备。',
  afterSalesRequirement: '供应商应提供明确的售后服务方案、响应时限和技术支持联系方式。',
  acceptanceStandard: '货物安装调试完成并正常运行后，依据合同、采购文件及响应文件组织验收。',
  otherTechnicalRequirements: '符合国家关于国产设备、节能环保及信息安全的相关要求。',
  siteVisitRequired: '否',
  siteVisitTime: '',
  siteVisitLocation: '',
  siteVisitContact: '',
  siteVisitPhone: '',
  sampleRequired: '否',
  sampleRequirement: '不要求提供样品。',
  demoRequired: '否',
  demoDuration: '',
  demoRequirement: '不要求现场演示。',
  otherNotes: '无。',
};
