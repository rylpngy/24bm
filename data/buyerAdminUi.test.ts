import { describe, expect, it } from 'vitest';
import type { BuyerAdminModule } from './adminNavigation';
import { buildProcurementMvpModel, getBuyerWorkspace } from './procurementModel';
import {
  buildAuditLogRows,
  buildAuditLogDetailPanel,
  buildApprovalCardFacts,
  buildApprovalDetailPanel,
  buildApprovalQueueRows,
  buildDemandDetailPanel,
  buildDemandListRows,
  buildInvoicePaymentRows,
  buildInvoicePaymentDetailPanel,
  buildMaterialCatalogRows,
  buildMaterialDetailPanel,
  buildOrderDetailPanel,
  buildOrderFulfillmentRows,
  buildReceiptInspectionDetailPanel,
  buildReceiptInspectionRows,
  buildRfqDetailPanel,
  buildRfqListRows,
  buildSupplierDetailPanel,
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

  it('builds approval detail panels with business context and timeline', () => {
    const pending = buildWorkspaceApprovalQueue(workspace);

    expect(buildApprovalDetailPanel(
      workspace,
      pending,
      [],
      'approval-demand-dem-acme-2',
      '2026-06-18T08:00:00.000Z',
    )).toEqual({
      id: 'approval-demand-dem-acme-2',
      title: '集团办公耗材季度补充',
      typeLabel: '需求审批',
      status: '待审批',
      canReview: true,
      facts: [
        { label: '业务状态', value: '审批中' },
        { label: '优先级', value: 'P8' },
        { label: '提交人', value: '李后勤' },
        { label: '金额', value: '¥48,000' },
        { label: '已等待', value: '7 小时' },
      ],
      businessFacts: [
        { label: '业务单号', value: 'dem-acme-2' },
        { label: '当前状态', value: '审批中' },
        { label: '申请部门', value: '综合管理部' },
        { label: '申请人', value: '李后勤' },
        { label: '预算金额', value: '¥48,000' },
      ],
      contextRows: [
        {
          id: 'mat-acme-2',
          title: 'A4 复印纸',
          detail: '260 箱 · 参考 ¥41,600',
        },
      ],
      timelineRows: [
        { label: '提交审批', value: '06/18 09:00' },
        { label: '等待处理', value: '7 小时' },
      ],
    });

    expect(buildApprovalDetailPanel(
      workspace,
      pending,
      [],
      'approval-supplier-rel-acme-harbor',
      '2026-06-18T08:00:00.000Z',
    )?.businessFacts).toEqual([
      { label: '业务单号', value: 'rel-acme-harbor' },
      { label: '当前状态', value: '待准入' },
      { label: '供应商', value: '海港物流服务' },
      { label: '等级', value: 'C' },
      { label: '绩效', value: '76 分' },
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

  it('builds supplier detail panels with admission, category, RFQ, order, and invoice context', () => {
    expect(buildSupplierDetailPanel(workspace, 'rel-acme-orbit')).toEqual({
      id: 'rel-acme-orbit',
      supplierId: 'supplier-orbit',
      supplierName: '奥博智能设备',
      status: '已准入',
      level: 'A',
      facts: [
        { label: '所属行业', value: '智能硬件' },
        { label: '企业认证', value: '已认证' },
        { label: '授权品类', value: '智能终端 / 会议设备' },
        { label: '绩效评分', value: '94 分' },
      ],
      actionTitle: '可参与询价',
      riskLabel: '绩效优秀',
      collaborationRows: [
        { label: '参与询价', value: '1 个' },
        { label: '已提交报价', value: '1 条' },
        { label: '采购订单', value: '1 单' },
        { label: '发票金额', value: '¥216,000' },
      ],
      rfqRows: [
        {
          id: 'rfq-acme-1',
          title: '会议室升级设备询价',
          status: '已定标',
          quoteLabel: '已报价',
        },
      ],
      orderRows: [
        {
          id: 'po-acme-1',
          status: '待收货',
          amountLabel: '¥216,000',
        },
      ],
    });

    expect(buildSupplierDetailPanel(workspace, 'rel-acme-harbor')?.actionTitle).toBe('待提交准入');
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

  it('builds material detail panels with demand, RFQ, and supplier coverage context', () => {
    expect(buildMaterialDetailPanel(workspace, 'mat-acme-1')).toEqual({
      id: 'mat-acme-1',
      title: '视频会议一体机',
      status: '启用',
      facts: [
        { label: '物料编码', value: 'IT-1001' },
        { label: '品类', value: '智能终端' },
        { label: '单位', value: '台' },
        { label: '参考价', value: '¥18,000' },
      ],
      demandRows: [
        {
          id: 'dem-acme-1',
          title: '华东总部会议室升级',
          status: '已通过',
          quantityLabel: '12 台',
          referenceAmountLabel: '¥216,000',
        },
        {
          id: 'dem-acme-4',
          title: '销售培训设备采购',
          status: '审批中',
          quantityLabel: '3 台',
          referenceAmountLabel: '¥54,000',
        },
      ],
      rfqRows: [
        {
          id: 'rfq-acme-1',
          title: '会议室升级设备询价',
          status: '已定标',
          quoteLabel: '3/3 已报价',
        },
      ],
      supplierCoverageRows: [
        { id: 'rel-acme-orbit', supplierName: '奥博智能设备', status: '已准入', level: 'A' },
      ],
      usageSummary: [
        { label: '引用需求', value: '2 条' },
        { label: '关联询价', value: '1 个' },
        { label: '准入供应商', value: '1 家' },
        { label: '参考金额', value: '¥270,000' },
      ],
    });

    expect(buildMaterialDetailPanel(workspace, 'mat-acme-3')?.supplierCoverageRows).toEqual([]);
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

  it('builds RFQ detail panels with invited suppliers, quote ranking, and fulfillment context', () => {
    expect(buildRfqDetailPanel(workspace, 'rfq-acme-1')).toEqual({
      id: 'rfq-acme-1',
      title: '会议室升级设备询价',
      status: '已定标',
      facts: [
        { label: '负责人', value: '陈采购' },
        { label: '截止时间', value: '2026-06-28' },
        { label: '关联需求', value: '1 条' },
        { label: '报价响应', value: '3/3' },
      ],
      demandRows: [
        {
          id: 'dem-acme-1',
          title: '华东总部会议室升级',
          status: '已通过',
          budgetLabel: '¥320,000',
        },
      ],
      supplierRows: [
        { id: 'supplier-orbit', name: '奥博智能设备', status: '已报价' },
        { id: 'supplier-lumen', name: '流明办公科技', status: '已报价' },
        { id: 'supplier-harbor', name: '海港物流服务', status: '已报价' },
      ],
      quoteRows: [
        {
          id: 'quo-acme-1',
          supplierName: '奥博智能设备',
          amountLabel: '¥216,000',
          deliveryLabel: '14 天',
          taxLabel: '13%',
          status: '已提交',
          rankLabel: '第 1 名',
          recommended: true,
          awarded: true,
        },
        {
          id: 'quo-acme-2',
          supplierName: '流明办公科技',
          amountLabel: '¥228,000',
          deliveryLabel: '10 天',
          taxLabel: '13%',
          status: '已提交',
          rankLabel: '第 2 名',
          recommended: false,
          awarded: false,
        },
        {
          id: 'quo-acme-3',
          supplierName: '海港物流服务',
          amountLabel: '¥238,000',
          deliveryLabel: '18 天',
          taxLabel: '13%',
          status: '已提交',
          rankLabel: '第 3 名',
          recommended: false,
          awarded: false,
        },
      ],
      recommendedSupplierLabel: '推荐：奥博智能设备 ¥216,000',
      orderLabel: '已生成订单 po-acme-1',
      nextActionTitle: '待收货验收',
    });

    expect(buildRfqDetailPanel(workspace, 'rfq-acme-2')?.recommendedSupplierLabel).toBe('暂无可推荐报价');
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

  it('builds order detail panels with RFQ, delivery, invoice, and payment context', () => {
    expect(buildOrderDetailPanel(workspace, 'po-acme-1')).toEqual({
      id: 'po-acme-1',
      supplierName: '奥博智能设备',
      status: '待收货',
      amountLabel: '¥216,000',
      facts: [
        { label: '关联询价', value: '会议室升级设备询价' },
        { label: '预计到货', value: '2026-07-10' },
        { label: '物流状态', value: '运输中' },
        { label: '发票状态', value: '待付款' },
      ],
      delivery: {
        id: 'del-acme-1',
        carrier: '顺丰速运',
        trackingNo: 'SF88420115',
        status: '运输中',
      },
      invoice: {
        id: 'inv-acme-1',
        amountLabel: '¥216,000',
        paymentStatus: '待付款',
      },
      rfqLabel: '会议室升级设备询价',
      nextActionTitle: '待收货验收',
    });

    expect(buildOrderDetailPanel(workspace, 'po-acme-2')?.nextActionTitle).toBe('履约已完成');
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

  it('builds receipt inspection detail panels with logistics, invoice, and acceptance checks', () => {
    expect(buildReceiptInspectionDetailPanel(workspace, 'po-acme-1')).toEqual({
      id: 'po-acme-1',
      supplierName: '奥博智能设备',
      status: '待收货',
      amountLabel: '¥216,000',
      logisticsLabel: '顺丰速运 SF88420115',
      canRegisterReceipt: false,
      nextActionTitle: '待收货验收',
      facts: [
        { label: '供应商', value: '奥博智能设备' },
        { label: '订单金额', value: '¥216,000' },
        { label: '预计到货', value: '2026-07-10' },
        { label: '发票状态', value: '待付款' },
      ],
      logisticsFacts: [
        { label: '承运商', value: '顺丰速运' },
        { label: '物流单号', value: 'SF88420115' },
        { label: '物流状态', value: '运输中' },
      ],
      acceptanceChecks: [
        { label: '物流信息', value: '运输中' },
        { label: '订单状态', value: '待收货' },
        { label: '验收结果', value: '待登记' },
      ],
      relatedRows: [
        { id: 'rfq-acme-1', title: '询价项目', detail: '会议室升级设备询价 · 已定标' },
        { id: 'inv-acme-1', title: '发票付款', detail: '¥216,000 · 待付款' },
      ],
    });

    expect(buildReceiptInspectionDetailPanel(workspace, 'missing-order')).toBeUndefined();
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

  it('builds invoice payment detail panels with supplier, order, delivery, and payment context', () => {
    expect(buildInvoicePaymentDetailPanel(workspace, 'inv-acme-1')).toEqual({
      id: 'inv-acme-1',
      supplierName: '奥博智能设备',
      status: '待付款',
      amountLabel: '¥216,000',
      canRegisterPayment: true,
      nextActionTitle: '待登记付款',
      facts: [
        { label: '供应商', value: '奥博智能设备' },
        { label: '关联订单', value: 'po-acme-1' },
        { label: '发票金额', value: '¥216,000' },
        { label: '付款状态', value: '待付款' },
      ],
      orderFacts: [
        { label: '订单状态', value: '待收货' },
        { label: '订单金额', value: '¥216,000' },
        { label: '预计到货', value: '2026-07-10' },
        { label: '关联询价', value: '会议室升级设备询价' },
      ],
      relatedRows: [
        { id: 'del-acme-1', title: '物流信息', detail: '顺丰速运 SF88420115 · 运输中' },
        { id: 'rfq-acme-1', title: '询价项目', detail: '会议室升级设备询价 · 已定标' },
      ],
      paymentTimelineRows: [
        { label: '发票登记', value: 'inv-acme-1' },
        { label: '付款状态', value: '待付款' },
        { label: '下一步', value: '待登记付款' },
      ],
    });

    expect(buildInvoicePaymentDetailPanel(workspace, 'missing-invoice')).toBeUndefined();
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

  it('builds audit log detail panels with actor, target, and related business context', () => {
    expect(buildAuditLogDetailPanel(workspace, 'audit-acme-2')).toEqual({
      id: 'audit-acme-2',
      title: '供应商发货',
      actionCode: 'purchase_order.shipped',
      targetLabel: '订单 · po-acme-1',
      actorName: 'u-orbit-sales',
      timeLabel: '06/15 14:35',
      facts: [
        { label: '操作人', value: 'u-orbit-sales' },
        { label: '操作时间', value: '06/15 14:35' },
        { label: '对象类型', value: '订单' },
        { label: '对象编号', value: 'po-acme-1' },
      ],
      targetFacts: [
        { label: '供应商', value: '奥博智能设备' },
        { label: '订单金额', value: '¥216,000' },
        { label: '订单状态', value: '待收货' },
        { label: '关联询价', value: '会议室升级设备询价' },
      ],
      relatedRows: [
        { id: 'del-acme-1', title: '物流信息', detail: '顺丰速运 SF88420115 · 运输中' },
        { id: 'inv-acme-1', title: '发票付款', detail: '¥216,000 · 待付款' },
      ],
      timelineRows: [
        { label: '审计记录', value: '06/15 14:35' },
        { label: '业务动作', value: '供应商发货' },
      ],
    });

    expect(buildAuditLogDetailPanel(workspace, 'missing-log')).toBeUndefined();
  });
});
