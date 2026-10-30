import assert from 'node:assert/strict';

const base = process.env.JAVA_API_BASE_URL ?? 'http://127.0.0.1:18080';
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(base).hostname), 'Local walkthrough environment required');
const apply = process.argv.includes('--apply');
const tenantId = 'tenant-acme';
let token;
async function api(path, body, method = body === undefined ? 'GET' : 'POST') {
  const response = await fetch(`${base}/api/v1/${path}`, {
    method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(30_000),
  });
  const result = await response.json();
  assert.ok(response.ok && result.success !== false, `${method} ${path}: ${response.status} ${result.message ?? ''}`);
  return result.data;
}
const session = await api('auth/login', {
  account: process.env.JAVA_BUYER_ACCOUNT ?? 'buyer.owner@example.com',
  password: process.env.JAVA_BUYER_PASSWORD ?? 'demo123456', scope: 'BUYER', tenantId,
});
assert.equal(session.tenantId, tenantId);
token = session.accessToken;
const paths = ['projects', 'budgets', 'demands', 'rfqs', 'suppliers', 'supplier-invitations',
  'supplier-evaluation-templates', 'suppliers/qualification-ledger', 'materials', 'mall/products',
  'contracts', 'orders', 'receipts', 'invoices', 'payment-batches', 'funding', 'process-definitions',
  'departments', 'users', 'roles', 'ai/policies', 'contract-review/rule-sets', 'approvals/pending'];
async function inventory() {
  const result = {};
  for (const path of paths) {
    const data = await api(`buyer/${path}`);
    result[path] = Array.isArray(data) ? data.length : data.total ?? data.items?.length;
    assert.equal(typeof result[path], 'number', `Unknown list response: ${path}`);
  }
  const rfqs = await api('buyer/rfqs');
  result.procurementMethods = Object.fromEntries([...new Set(rfqs.map(row => row.method))]
    .map(method => [method, rfqs.filter(row => row.method === method).length]));
  return result;
}
console.log('BEFORE', JSON.stringify(await inventory()));
if (!apply) process.exit(0);

const role = (await api('buyer/roles')).find(row => row.permissions.includes('buyer:*'));
assert.ok(role, 'Existing buyer owner role required');
async function ensureWorkflow(type, name) {
  const definitions = await api('buyer/process-definitions');
  if (definitions.some(row => row.businessType === type && row.activeVersionId)) return;
  const title = `走查测试-${name}`;
  const definition = definitions.find(row => row.businessType === type && row.name === title)
    ?? await api('buyer/process-definitions', { name: title, businessType: type, icon: 'file-text' });
  await api(`buyer/process-definitions/${definition.id}`, {
    name: title, businessType: type, status: 'draft', formSchema: '{"fields":[]}',
    flowSchema: JSON.stringify({ steps: [{ id: 'review', type: 'approver', title: '测试业务复核',
      assignment: { type: 'role', roleId: role.id } }] }),
  }, 'PUT');
  await api(`buyer/process-definitions/${definition.id}/publish`, {});
}
const materials = await api('buyer/materials');
const samples = [
  ['RAW', '原材料', '聚丙烯颗粒', '吨', 7250, 'T30S 工业级'],
  ['SEMI', '半成品', '铝合金加工件', '件', 180, '6061 / 100 x 80 mm'],
  ['PACK', '包装材料', '五层瓦楞纸箱', '个', 4.2, '50 x 40 x 30 cm'],
  ['TOOL', '五金工具', '充电式电钻', '把', 280, '18V 双电池'],
  ['PPE', '劳保用品', '防静电手套', '双', 3.5, 'L 码'],
  ['OIL', '润滑油脂', '工业液压油', '桶', 420, 'L-HM 46 / 18L'],
  ['IT', 'IT 设备', '商务笔记本电脑', '台', 6200, '16GB / 512GB SSD'],
  ['OFFICE', '办公耗材', 'A4 复印纸', '箱', 125, '80g / 5包'],
];
for (const [code, category, name, unit, referencePrice, specification] of samples) {
  for (let index = 1; index <= 2; index++) {
    const materialCode = `WT-${code}-${String(index).padStart(2, '0')}`;
    if (materials.some(row => row.code === materialCode)) continue;
    materials.push(await api('buyer/materials', { code: materialCode, name: `【走查】${name}${index === 2 ? '（增强型）' : ''}`,
      category, unit, referencePrice: referencePrice * index, specification, brand: '测试品牌',
      governmentMallCatalog: false, taxRate: 13, description: '系统功能走查专用测试物料，可用于新建项目、需求与计划。' }));
  }
}

const options = await api('buyer/projects/options');
const departments = options.departments.filter(dept => options.users.some(user => user.departmentId === dept.id));
assert.ok(departments.length);
await ensureWorkflow('project_initiation', '项目立项审批');
const year = new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: 'Asia/Shanghai' }).format(new Date());
const projectSamples = [
  ['办公终端更新', 'draft'], ['机房基础设施改造', 'draft'], ['季度办公耗材补充', 'submitted'],
  ['生产安全防护用品', 'submitted'], ['工业工具集中采购', 'submitted'], ['包装材料年度采购', 'draft'],
  ['原材料储备计划', 'withdrawn'], ['液压润滑用品采购', 'draft'],
];
const projectMaterialCodes = ['IT', 'IT', 'OFFICE', 'PPE', 'TOOL', 'PACK', 'RAW', 'OIL'];
const existingProjects = (await api('buyer/projects?pageSize=100')).items;
for (const [index, [name, target]] of projectSamples.entries()) {
  const title = `【走查】${year}年${name}项目`;
  const dept = departments[index % departments.length];
  const owner = options.users.find(user => user.departmentId === dept.id);
  const material = materials.find(row => row.code === `WT-${projectMaterialCodes[index]}-01`);
  const draft = { title, departmentId: dept.id, ownerId: owner.id, period: year,
    fundingSource: '年度企业自有资金（走查测试）', purpose: `用于${name}功能走查，验证立项、审批、需求关联与执行跟踪；仅为合成测试记录。`,
    lines: [{ materialId: material.id, quantity: (index + 1) * 5, unitPrice: material.referencePrice, purpose: name }], revision: 0 };
  let detail = existingProjects.some(row => row.title === title)
    ? await api(`buyer/projects/${existingProjects.find(row => row.title === title).id}`)
    : await api('buyer/projects', draft);
  if (detail.lines[0]?.materialId !== material.id) {
    if (detail.project.status === 'submitted') detail = await api(`buyer/projects/${detail.project.id}/withdraw`, {
      revision: detail.project.revision, reason: '走查测试：核对项目名称与采购物料。',
    });
    assert.ok(['draft', 'withdrawn', 'rejected'].includes(detail.project.status), 'Do not edit approved test projects');
    detail = await api(`buyer/projects/${detail.project.id}`, { ...draft, revision: detail.project.revision }, 'PUT');
  }
  if (target !== 'draft' && ['draft', 'withdrawn'].includes(detail.project.status) && target !== detail.project.status) detail = await api(`buyer/projects/${detail.project.id}/submit`, {
    revision: detail.project.revision, reason: '走查测试：提交立项审批', formData: {},
  });
  if (detail.project.status === 'submitted') {
    if (target === 'withdrawn') await api(`buyer/projects/${detail.project.id}/withdraw`, {
      revision: detail.project.revision, reason: '走查测试：申请人调整采购范围，撤回后继续编辑。',
    });
  }
  console.log('PROJECT', title, (await api(`buyer/projects/${detail.project.id}`)).project.status);
}

const templates = await api('buyer/supplier-evaluation-templates');
for (const [name, qualityWeight, deliveryWeight, priceWeight, serviceWeight] of [
  ['【走查】物资供应商季度考核', 40, 30, 20, 10], ['【走查】服务供应商年度考核', 30, 20, 20, 30],
]) if (!templates.some(row => row.name === name)) await api('buyer/supplier-evaluation-templates', {
  name, qualityWeight, deliveryWeight, priceWeight, serviceWeight,
});

await ensureWorkflow('funding_change', '专款资金额度审批');
let funds = (await api('buyer/funding')).items;
const fundingChanges = (await api('buyer/funding/changes?pageSize=100')).items;
for (const [index, dept] of departments.slice(0, 3).entries()) {
  const code = `WT-${year}-${index + 1}`;
  let fund = funds.find(row => row.code === code) ?? await api('buyer/funding', {
    departmentId: dept.id, period: year, code, name: `【走查】${dept.name}年度采购专项资金`,
  });
  if (fund.totalAmount === 0 && !fundingChanges.some(change => change.requestKey === `walkthrough-limit-${fund.id}`)) {
    await api('buyer/funding/changes', { requestKey: `walkthrough-limit-${fund.id}`,
      kind: 'fund_limit', fundId: fund.id, revision: fund.revision, amount: 500000,
      reason: '走查测试：建立专项资金额度，非实际资金支付。', formData: {},
    });
  }
}

if (!(await api('buyer/ai/policies')).length) await api('buyer/ai/policies', {
  policyKey: 'walkthrough-procurement', title: '【走查】采购合规核对示例（非正式制度）',
  subjectTypes: ['demand', 'supplier', 'procurement_risk'], expectedLatestVersion: 0,
  clauses: [{ id: 'budget', title: '预算与需求核对', text: '测试示例：需求应明确物料、数量及预算来源，审批结论由授权人员复核。' }],
});
if (!(await api('buyer/contract-review/rule-sets')).length) await api('buyer/contract-review/rule-sets', {
  name: '【走查】合同条款复核示例（非正式规则）', expectedRevision: 0,
  rules: [{ id: 'prepayment', title: '预付款条款核对', type: 'KEYWORD', perspective: 'BUYER', severity: 'MEDIUM',
    matchMode: 'ANY', keywords: ['预付款', '全额预付'], sourceName: '走查测试规则', clause: '付款条款',
    basis: '核对预付款比例及履约保障，仅供测试展示。', suggestion: '明确付款条件、验收节点和履约保障，交由人工复核。' }],
});
console.log('AFTER', JSON.stringify(await inventory()));
