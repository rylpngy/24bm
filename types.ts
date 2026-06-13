
export enum SupplierStatus {
  POTENTIAL = '潜在',
  VERIFIED = '已准入',
  QUALIFIED = '合格',
  BLACKLISTED = '黑名单'
}

export enum ProcurementMethod {
  INQUIRY = '询比价',
  BIDDING = '竞价',
  MALL = '商城直采'
}

export enum ApprovalStatus {
  DRAFT = '草稿',
  PENDING = '审批中',
  APPROVED = '已通过',
  REJECTED = '已驳回'
}

export interface Supplier {
  id: string;
  name: string;
  category: string;
  creditScore: number;
  status: SupplierStatus;
  location: string;
  tags: string[];
}

export interface ProcurementProject {
  id: string;
  title: string;
  budget: number;
  method: ProcurementMethod;
  status: ApprovalStatus;
  createTime: string;
}

export interface AnalyticsMetric {
  name: string;
  value: number;
  trend: number;
  unit: string;
}
