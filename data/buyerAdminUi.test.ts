import { describe, expect, it } from 'vitest';
import type { BuyerAdminModule } from './adminNavigation';
import { buildProcurementMvpModel, getBuyerWorkspace } from './procurementModel';
import {
  buildAuditLogRows,
  buildApprovalCardFacts,
  buildApprovalQueueRows,
  buildDemandDetailPanel,
  buildDemandListRows,
  buildInvoicePaymentRows,
  buildMaterialCatalogRows,
  buildOrderFulfillmentRows,
  buildReceiptInspectionRows,
  buildRfqListRows,
  buildSupplierRelationRows,
  buildWorkspaceApprovalQueue,
  buildBuyerModuleFacts,
  describeSupplierRelationAction,
} from './buyerAdminUi';

describe('buyer admin UI helpers', () => {
  const workspace = getBuyerWorkspace(buildProcurementMvpModel(), 'tenant-acme');
  const pendingApprovals = [
    { id: 'approval-1' },
    { id: 'approval-2' },
  ];

  it('provides compact summary facts for every buyer admin module except the dashboard', () => {
    const modules: BuyerAdminModule[] = [
      'demands',
      'approvals',
      'suppliers',
      'materials',
      'rfqs',
      'quotes',
      'orders',
      'receipts',
      'invoices',
      'audit',
    ];

    modules.forEach((module) => {
      const facts = buildBuyerModuleFacts(module, workspace, pendingApprovals);
      expect(facts.length, module).toBeGreaterThanOrEqual(3);
      expect(facts.every((fact) => fact.label.trim() && fact.value.trim()), module).toBe(true);
    });
  });

  it('highlights actionable fulfillment and finance counts for buyer operations', () => {
    expect(buildBuyerModuleFacts('receipts', workspace, pendingApprovals)).toEqual([
      { label: '待收货', value: '1 单' },
      { label: '已有物流', value: '2 条' },
      { label: '本期到货金额', value: '¥216,000' },
    ]);

    expect(buildBuyerModuleFacts('invoices', workspace, pendingApprovals)).toEqual([
      { label: '发票数量', value: '2 张' },
      { label: '待付款', value: '1 张' },
      { label: '待付金额', value: '¥216,000' },
    ]);
  });

  it('formats approval cards with business context and elapsed time', () => {
    expect(buildApprovalCardFacts({
      id: 'approval-1',
      bizType: 'purchase_demand',
      bizId: 'dem-001',
      summaryTitle: '办公设备采购',
      businessStatus: '审批中',
      priority: 8,
      submittedByName: '陈采购',
      amount: 68000,
      counterpartyName: '流明办公科技',
      status: '待审批',
      createdAt: '2026-06-18T08:00:00+08:00',
    }, '2026-06-18T14:30:00+08:00')).toEqual([
      { label: '业务状态', value: '审批中' },
      { label: '优先级', value: 'P8' },
      { label: '提交人', value: '陈采购' },
      { label: '相关方', value: '流明办公科技' },
      { label: '金额', value: '¥68,000' },
      { label: '已等待', value: '6.5 小时' },
    ]);
  });

  it('summarizes approval queue rows with type, facts, and available decisions', () => {
    expect(buildApprovalQueueRows(buildWorkspaceApprovalQueue(workspace), '2026-06-18T08:00:00.000Z')
      .slice(0, 2)
      .map((row) => ({
        id: row.id,
        title: row.title,
        typeLabel: row.typeLabel,
        facts: row.facts,
        canReview: row.canReview,
      }))).toEqual([
      {
        id: 'approval-demand-dem-acme-2',
        title: '集团办公耗材季度补充',
        typeLabel: '需求审批',
        facts: [
          { label: '业务状态', value: '审批中' },
          { label: '优先级', value: 'P8' },
          { label: '提交人', value: '李后勤' },
          { label: '金额', value: '¥48,000' },
          { label: '已等待', value: '7 小时' },
        ],
        canReview: true,
      },
      {
        id: 'approval-demand-dem-acme-3',
        title: '区域仓储配送服务',
        typeLabel: '需求审批',
        facts: [
          { label: '业务状态', value: '审批中' },
          { label: '优先级', value: 'P7' },
          { label: '提交人', value: '赵运营' },
          { label: '金额', value: '¥90,000' },
          { label: '已等待', value: '6 小时' },
        ],
        canReview: true,
      },
    ]);
  });

  it('builds a fallback approval queue from buyer workspace data', () => {
    expect(buildWorkspaceApprovalQueue(workspace).map((approval) => ({
      id: approval.id,
      bizType: approval.bizType,
      title: approval.summaryTitle,
      status: approval.businessStatus,
    }))).toEqual([
      {
        id: 'approval-demand-dem-acme-2',
        bizType: 'purchase_demand',
        title: '集团办公耗材季度补充',
        status: '审批中',
      },
      {
        id: 'approval-demand-dem-acme-3',
        bizType: 'purchase_demand',
        title: '区域仓储配送服务',
        status: '审批中',
      },
      {
        id: 'approval-demand-dem-acme-4',
        bizType: 'purchase_demand',
        title: '销售培训设备采购',
        status: '审批中',
      },
      {
        id: 'approval-supplier-rel-acme-harbor',
        bizType: 'buyer_supplier_admission',
        title: '海港物流服务',
        status: '待准入',
      },
    ]);
  });

  it('describes supplier relation actions for admission and performance review', () => {
    const pendingRelation = workspace.privateSupplierRelations.find((relation) => relation.status === '待准入');
    const admittedRelation = workspace.privateSupplierRelations.find((relation) => relation.status === '已准入');

    expect(pendingRelation && describeSupplierRelationAction(pendingRelation)).toEqual({
      title: '待提交准入',
      detail: '补齐准入资料后提交审批，通过后才能参与采购协同。',
      tone: 'blue',
      riskLabel: '绩效 76 分',
    });

    expect(admittedRelation && describeSupplierRelationAction(admittedRelation)).toEqual({
      title: '可参与询价',
      detail: '供应商已准入，可按授权品类邀请参与询价。',
      tone: 'emerald',
      riskLabel: '绩效优秀',
    });
  });

  it('summarizes supplier relation rows with private status and platform profile context', () => {
    expect(buildSupplierRelationRows(workspace).map((row) => ({
      id: row.id,
      supplierName: row.supplierName,
      status: row.status,
      level: row.level,
      categoryLabel: row.categoryLabel,
      facts: row.facts,
      actionTitle: row.action.title,
    }))).toEqual([
      {
        id: 'rel-acme-orbit',
        supplierName: '奥博智能设备',
        status: '已准入',
        level: 'A',
        categoryLabel: '智能终端 / 会议设备',
        facts: [
          { label: '授权品类', value: '2 类' },
          { label: '绩效评分', value: '94 分' },
          { label: '企业认证', value: '已认证' },
          { label: '所属行业', value: '智能硬件' },
        ],
        actionTitle: '可参与询价',
      },
      {
        id: 'rel-acme-lumen',
        supplierName: '流明办公科技',
        status: '已准入',
        level: 'B',
        categoryLabel: '办公设备 / 耗材',
        facts: [
          { label: '授权品类', value: '2 类' },
          { label: '绩效评分', value: '88 分' },
          { label: '企业认证', value: '已认证' },
          { label: '所属行业', value: '办公设备' },
        ],
        actionTitle: '可参与询价',
      },
      {
        id: 'rel-acme-harbor',
        supplierName: '海港物流服务',
        status: '待准入',
        level: 'C',
        categoryLabel: '物流服务',
        facts: [
          { label: '授权品类', value: '1 类' },
          { label: '绩效评分', value: '76 分' },
          { label: '企业认证', value: '待认证' },
          { label: '所属行业', value: '物流服务' },
        ],
        actionTitle: '待提交准入',
      },
    ]);
  });

  it('summarizes material catalog usage for buyer list pages', () => {
    expect(buildMaterialCatalogRows(workspace).map((row) => ({
      id: row.id,
      title: row.title,
      facts: row.facts,
      usageLabel: row.usageLabel,
    }))).toEqual([
      {
        id: 'mat-acme-1',
        title: '视频会议一体机',
        facts: [
          { label: '物料编码', value: 'IT-1001' },
          { label: '品类', value: '智能终端' },
          { label: '单位', value: '台' },
          { label: '参考价', value: '¥18,000' },
        ],
        usageLabel: '2 个需求引用',
      },
      {
        id: 'mat-acme-2',
        title: 'A4 复印纸',
        facts: [
          { label: '物料编码', value: 'OA-2040' },
          { label: '品类', value: '办公耗材' },
          { label: '单位', value: '箱' },
          { label: '参考价', value: '¥160' },
        ],
        usageLabel: '1 个需求引用',
      },
      {
        id: 'mat-acme-3',
        title: '年度物流服务',
        facts: [
          { label: '物料编码', value: 'SV-3100' },
          { label: '品类', value: '服务采购' },
          { label: '单位', value: '项' },
          { label: '参考价', value: '¥80,000' },
        ],
        usageLabel: '1 个需求引用',
      },
    ]);
  });

  it('summarizes RFQ list rows with demand and quote response context', () => {
    expect(buildRfqListRows(workspace).map((row) => ({
      id: row.id,
      title: row.title,
      demandLabel: row.demandLabel,
      supplierLabel: row.supplierLabel,
      quoteLabel: row.quoteLabel,
      status: row.status,
    }))).toEqual([
      {
        id: 'rfq-acme-1',
        title: '会议室升级设备询价',
        demandLabel: '华东总部会议室升级',
        supplierLabel: '3 家已邀请',
        quoteLabel: '3/3 已报价',
        status: '已定标',
      },
      {
        id: 'rfq-acme-2',
        title: '区域仓储配送服务询价',
        demandLabel: '区域仓储配送服务',
        supplierLabel: '1 家已邀请',
        quoteLabel: '0/1 已报价',
        status: '报价中',
      },
    ]);
  });

  it('summarizes demand list rows with catalog and RFQ readiness context', () => {
    expect(buildDemandListRows(workspace).slice(0, 2).map((row) => ({
      id: row.id,
      title: row.title,
      facts: row.facts,
      materialSummary: row.materialSummary,
      nextActionTitle: row.nextAction.title,
    }))).toEqual([
      {
        id: 'dem-acme-1',
        title: '华东总部会议室升级',
        facts: [
          { label: '申请部门', value: '行政部' },
          { label: '申请人', value: '许行政' },
          { label: '预算', value: '¥320,000' },
          { label: '物料行', value: '1 行' },
        ],
        materialSummary: '视频会议一体机 x 12 台',
        nextActionTitle: '已关联询价项目',
      },
      {
        id: 'dem-acme-2',
        title: '集团办公耗材季度补充',
        facts: [
          { label: '申请部门', value: '综合管理部' },
          { label: '申请人', value: '李后勤' },
          { label: '预算', value: '¥48,000' },
          { label: '物料行', value: '1 行' },
        ],
        materialSummary: 'A4 复印纸 x 260 箱',
        nextActionTitle: '等待需求审批',
      },
    ]);
  });

  it('builds demand detail panels with line items, linked RFQs, and approval context', () => {
    expect(buildDemandDetailPanel(workspace, 'dem-acme-1')).toEqual({
      id: 'dem-acme-1',
      title: '华东总部会议室升级',
      status: '已通过',
      facts: [
        { label: '申请部门', value: '行政部' },
        { label: '申请人', value: '许行政' },
        { label: '预算', value: '¥320,000' },
        { label: '物料行', value: '1 行' },
      ],
      lineItems: [
        {
          id: 'dem-acme-1:mat-acme-1',
          name: '视频会议一体机',
          category: '智能终端',
          quantityLabel: '12 台',
          referenceAmountLabel: '¥216,000',
        },
      ],
      linkedRfqs: [
        {
          id: 'rfq-acme-1',
          title: '会议室升级设备询价',
          status: '已定标',
          quoteLabel: '3/3 已报价',
        },
      ],
      approvalLabel: '暂无待审批',
      nextActionTitle: '已关联询价项目',
    });

    expect(buildDemandDetailPanel(workspace, 'dem-acme-2')?.approvalLabel).toBe('待审批：需求审批');
  });

  it('summarizes order fulfillment rows with supplier, logistics, invoice, and next action context', () => {
    expect(buildOrderFulfillmentRows(workspace).map((row) => ({
      id: row.id,
      supplierName: row.supplierName,
      amountLabel: row.amountLabel,
      status: row.status,
      facts: row.facts,
      nextActionTitle: row.nextAction.title,
      canRegisterReceipt: row.canRegisterReceipt,
    }))).toEqual([
      {
        id: 'po-acme-1',
        supplierName: '奥博智能设备',
        amountLabel: '¥216,000',
        status: '待收货',
        facts: [
          { label: '预计到货', value: '2026-07-10' },
          { label: '物流单号', value: '顺丰速运 SF88420115' },
          { label: '发票状态', value: '待付款' },
        ],
        nextActionTitle: '待收货验收',
        canRegisterReceipt: false,
      },
      {
        id: 'po-acme-2',
        supplierName: '海港物流服务',
        amountLabel: '¥70,000',
        status: '已完成',
        facts: [
          { label: '预计到货', value: '2026-07-18' },
          { label: '物流单号', value: '海港专线 HG20260602' },
          { label: '发票状态', value: '已付款' },
        ],
        nextActionTitle: '履约已完成',
        canRegisterReceipt: false,
      },
    ]);
  });

  it('summarizes receipt inspection rows for orders waiting on buyer acceptance', () => {
    expect(buildReceiptInspectionRows(workspace).map((row) => ({
      id: row.id,
      supplierName: row.supplierName,
      status: row.status,
      logisticsLabel: row.logisticsLabel,
      nextActionTitle: row.nextAction.title,
      canRegisterReceipt: row.canRegisterReceipt,
    }))).toEqual([
      {
        id: 'po-acme-1',
        supplierName: '奥博智能设备',
        status: '待收货',
        logisticsLabel: '顺丰速运 SF88420115',
        nextActionTitle: '待收货验收',
        canRegisterReceipt: false,
      },
    ]);
  });

  it('summarizes invoice payment rows with supplier, order, amount, and payment action context', () => {
    expect(buildInvoicePaymentRows(workspace).map((row) => ({
      id: row.id,
      supplierName: row.supplierName,
      orderLabel: row.orderLabel,
      amountLabel: row.amountLabel,
      status: row.status,
      nextActionTitle: row.nextAction.title,
      canRegisterPayment: row.canRegisterPayment,
    }))).toEqual([
      {
        id: 'inv-acme-1',
        supplierName: '奥博智能设备',
        orderLabel: '订单 po-acme-1',
        amountLabel: '¥216,000',
        status: '待付款',
        nextActionTitle: '待登记付款',
        canRegisterPayment: true,
      },
      {
        id: 'inv-acme-2',
        supplierName: '海港物流服务',
        orderLabel: '订单 po-acme-2',
        amountLabel: '¥70,000',
        status: '已付款',
        nextActionTitle: '付款已完成',
        canRegisterPayment: false,
      },
    ]);
  });

  it('formats audit log rows with action, target, actor, and time', () => {
    expect(buildAuditLogRows(workspace).map((row) => ({
      id: row.id,
      title: row.title,
      targetLabel: row.targetLabel,
      actorName: row.actorName,
      timeLabel: row.timeLabel,
    }))).toEqual([
      {
        id: 'audit-acme-2',
        title: '供应商发货',
        targetLabel: '订单 · po-acme-1',
        actorName: 'u-orbit-sales',
        timeLabel: '06/15 14:35',
      },
      {
        id: 'audit-acme-1',
        title: '订单创建',
        targetLabel: '订单 · po-acme-1',
        actorName: '陈采购',
        timeLabel: '06/15 10:20',
      },
    ]);
  });
});
