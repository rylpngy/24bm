import { baseUrl, requestJson, runLocalSmokeSql, sqlLiteral } from './java-smoke-support.mjs';

const marker = Date.now();
const tenantId = `tenant-workflow-routing-${marker}`;
const departmentId = `dept-workflow-routing-${marker}`;
const outsiderDepartmentId = `dept-workflow-routing-outsider-${marker}`;
const requesterId = `user-workflow-routing-requester-${marker}`;
const reviewerId = `user-workflow-routing-reviewer-${marker}`;
const managerId = `user-workflow-routing-manager-${marker}`;
const outsiderId = `user-workflow-routing-outsider-${marker}`;
const requesterRoleId = `role-workflow-routing-requester-${marker}`;
const reviewerRoleId = `role-workflow-routing-reviewer-${marker}`;
const managerRoleId = `role-workflow-routing-manager-${marker}`;
const highDemandId = `demand-workflow-routing-high-${marker}`;
const lowDemandId = `demand-workflow-routing-low-${marker}`;
const highAttachmentId = `attachment-workflow-routing-high-${marker}`;
const passwordHash = '$2y$10$HKSnHnokVMkEYDQUlfB/e..3beDCFeM8KKj9.ZpFHGPTQeTjIKP.O';

const login = (account) => requestJson('/api/v1/auth/login', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ account, password: 'demo123456', scope: 'BUYER', tenantId }),
});

const authHeaders = (session) => ({ authorization: `Bearer ${session.accessToken}` });

const expectRequestFailure = async (path, init, expectedStatus) => {
  try {
    await requestJson(path, init);
  } catch (error) {
    if (String(error.message).includes(`failed: ${expectedStatus}`)) return;
    throw error;
  }
  throw new Error(`Expected ${expectedStatus} from ${init.method ?? 'GET'} ${path}`);
};

const taskFor = async (headers, businessId, label) => {
  const tasks = await requestJson('/api/v1/buyer/workflow/tasks', { headers });
  const task = tasks.find((item) => item.businessType === 'purchase_demand' && item.businessId === businessId);
  if (!task) {
    throw new Error(`No actionable ${label} task for ${businessId}`);
  }
  return task;
};

const assertNoTaskFor = async (headers, businessId, label) => {
  const tasks = await requestJson('/api/v1/buyer/workflow/tasks', { headers });
  if (tasks.some((item) => item.businessType === 'purchase_demand' && item.businessId === businessId)) {
    throw new Error(`${label} unexpectedly received a task for ${businessId}`);
  }
};

const complete = (headers, task, action, comment) => requestJson(
  `/api/v1/buyer/workflow/tasks/${task.taskId}/complete`,
  {
    method: 'POST',
    headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify({ action, comment }),
  },
);

const installFixture = () => {
  const requesterEmail = `workflow.requester.${marker}@example.com`;
  const reviewerEmail = `workflow.reviewer.${marker}@example.com`;
  const managerEmail = `workflow.manager.${marker}@example.com`;
  const outsiderEmail = `workflow.outsider.${marker}@example.com`;
  runLocalSmokeSql(`
    insert into tenants (id, name, plan, status)
    values (${sqlLiteral(tenantId)}, ${sqlLiteral('工作流组合验收企业')}, 'starter', 'active');

    insert into departments (id, tenant_id, name, parent_id, status)
    values
      (${sqlLiteral(departmentId)}, ${sqlLiteral(tenantId)}, ${sqlLiteral('采购中心')}, null, 'active'),
      (${sqlLiteral(outsiderDepartmentId)}, ${sqlLiteral(tenantId)}, ${sqlLiteral('外部部门')}, null, 'active');

    insert into users (id, tenant_id, name, email, status, department_id, password_hash)
    values
      (${sqlLiteral(requesterId)}, ${sqlLiteral(tenantId)}, ${sqlLiteral('路由申请人')}, ${sqlLiteral(requesterEmail)}, 'active', ${sqlLiteral(departmentId)}, ${sqlLiteral(passwordHash)}),
      (${sqlLiteral(reviewerId)}, ${sqlLiteral(tenantId)}, ${sqlLiteral('路由财务复核人')}, ${sqlLiteral(reviewerEmail)}, 'active', ${sqlLiteral(departmentId)}, ${sqlLiteral(passwordHash)}),
      (${sqlLiteral(managerId)}, ${sqlLiteral(tenantId)}, ${sqlLiteral('路由部门主管')}, ${sqlLiteral(managerEmail)}, 'active', ${sqlLiteral(departmentId)}, ${sqlLiteral(passwordHash)}),
      (${sqlLiteral(outsiderId)}, ${sqlLiteral(tenantId)}, ${sqlLiteral('路由跨部门候选人')}, ${sqlLiteral(outsiderEmail)}, 'active', ${sqlLiteral(outsiderDepartmentId)}, ${sqlLiteral(passwordHash)});

    update departments
    set manager_id = ${sqlLiteral(managerId)}
    where tenant_id = ${sqlLiteral(tenantId)} and id = ${sqlLiteral(departmentId)};

    insert into roles (id, tenant_id, scope, name, permissions, data_scope)
    values
      (${sqlLiteral(requesterRoleId)}, ${sqlLiteral(tenantId)}, 'buyer', ${sqlLiteral('路由申请角色')}, '["buyer:*"]'::jsonb, 'self'),
      (${sqlLiteral(reviewerRoleId)}, ${sqlLiteral(tenantId)}, 'buyer', ${sqlLiteral('路由复核角色')}, '["buyer:*"]'::jsonb, 'department'),
      (${sqlLiteral(managerRoleId)}, ${sqlLiteral(tenantId)}, 'buyer', ${sqlLiteral('路由主管角色')}, '["buyer:*"]'::jsonb, 'department');

    insert into user_roles (user_id, role_id)
    values
      (${sqlLiteral(requesterId)}, ${sqlLiteral(requesterRoleId)}),
      (${sqlLiteral(reviewerId)}, ${sqlLiteral(reviewerRoleId)}),
      (${sqlLiteral(managerId)}, ${sqlLiteral(managerRoleId)}),
      (${sqlLiteral(outsiderId)}, ${sqlLiteral(reviewerRoleId)});

    insert into purchase_demands (id, tenant_id, title, department_id, requester_id, budget, status)
    values
      (${sqlLiteral(highDemandId)}, ${sqlLiteral(tenantId)}, ${sqlLiteral('工作流组合验收大额需求')}, ${sqlLiteral(departmentId)}, ${sqlLiteral(requesterId)}, 120000, '草稿'),
      (${sqlLiteral(lowDemandId)}, ${sqlLiteral(tenantId)}, ${sqlLiteral('工作流组合验收常规需求')}, ${sqlLiteral(departmentId)}, ${sqlLiteral(requesterId)}, 50000, '草稿');

    insert into attachments
      (id, tenant_id, owner_type, owner_id, file_name, storage_key, uploaded_by, visibility, status)
    values
      (${sqlLiteral(highAttachmentId)}, ${sqlLiteral(tenantId)}, 'purchase_demand', ${sqlLiteral(highDemandId)},
       ${sqlLiteral('大额需求技术说明.pdf')}, ${sqlLiteral(`smoke/${highAttachmentId}.pdf`)},
       ${sqlLiteral(requesterId)}, 'buyer_internal', 'active');
  `);
  return { requesterEmail, reviewerEmail, managerEmail, outsiderEmail };
};

const formSchema = JSON.stringify({
  fields: [
    { id: 'reason', type: 'text', label: '申请说明', required: true, options: [] },
    { id: 'urgency', type: 'select', label: '紧急程度', required: true, options: ['高', '普通'] },
  ],
});

const flowSchema = JSON.stringify({
  steps: [{
    id: 'amount_route',
    type: 'condition',
    title: '金额路由',
    branches: [
      {
        label: '大额采购',
        condition: { field: '$amount', op: '>=', value: '100000' },
        steps: [
          {
            id: 'finance_review',
            type: 'approver',
            title: '财务复核',
            assignment: { type: 'role', roleId: reviewerRoleId },
          },
          {
            id: 'manager_review',
            type: 'approver',
            title: '部门主管复核',
            assignment: { type: 'initiator_department_manager' },
          },
        ],
      },
      {
        label: '常规采购',
        condition: null,
        steps: [{
          id: 'manager_only',
          type: 'approver',
          title: '部门主管审批',
          assignment: { type: 'initiator_department_manager' },
        }],
      },
    ],
  }],
});

const main = async () => {
  const accounts = installFixture();
  const [requester, reviewer, manager, outsider] = await Promise.all([
    login(accounts.requesterEmail),
    login(accounts.reviewerEmail),
    login(accounts.managerEmail),
    login(accounts.outsiderEmail),
  ]);
  const requesterHeaders = authHeaders(requester);
  const reviewerHeaders = authHeaders(reviewer);
  const managerHeaders = authHeaders(manager);
  const outsiderHeaders = authHeaders(outsider);

  const createdDefinition = await requestJson('/api/v1/buyer/process-definitions', {
    method: 'POST',
    headers: { ...reviewerHeaders, 'content-type': 'application/json' },
    body: JSON.stringify({
      name: '工作流组合路由验收',
      description: '真实 HTTP 验收多级、金额、部门主管、候选角色和数据范围。',
      icon: 'git-branch',
      businessType: 'purchase_demand',
    }),
  });
  const savedDefinition = await requestJson(`/api/v1/buyer/process-definitions/${createdDefinition.id}`, {
    method: 'PUT',
    headers: { ...reviewerHeaders, 'content-type': 'application/json' },
    body: JSON.stringify({
      name: createdDefinition.name,
      description: createdDefinition.description,
      status: 'draft',
      formSchema,
      flowSchema,
      businessType: 'purchase_demand',
    }),
  });
  const publishedDefinition = await requestJson(
    `/api/v1/buyer/process-definitions/${savedDefinition.id}/publish`,
    { method: 'POST', headers: reviewerHeaders },
  );
  if (!publishedDefinition.activeVersionId) {
    throw new Error('Workflow routing smoke could not publish its Flowable definition');
  }

  const formData = { reason: '工作流组合路由验收', urgency: '高' };
  await requestJson(`/api/v1/buyer/demands/${highDemandId}/submit`, {
    method: 'POST',
    headers: { ...requesterHeaders, 'content-type': 'application/json' },
    body: JSON.stringify({ formData }),
  });

  const reviewerNotifications = await requestJson('/api/v1/buyer/notifications', { headers: reviewerHeaders });
  if (!reviewerNotifications.some((notice) => notice.title === '待审批任务' && notice.content.includes(highDemandId))) {
    throw new Error('Candidate role user did not receive the new workflow task notification');
  }
  const outsiderNotifications = await requestJson('/api/v1/buyer/notifications', { headers: outsiderHeaders });
  if (outsiderNotifications.some((notice) => notice.title === '待审批任务' && notice.content.includes(highDemandId))) {
    throw new Error('Cross-department role user received a task notification outside data scope');
  }

  const businessHistory = await requestJson(
    `/api/v1/buyer/workflow/instances/business/purchase_demand/${highDemandId}/history`,
    { headers: requesterHeaders },
  );
  if (businessHistory.formData?.reason !== '工作流组合路由验收'
      || businessHistory.businessSnapshot?.title !== '工作流组合验收大额需求'
      || !businessHistory.attachments?.some((attachment) => attachment.id === highAttachmentId)) {
    throw new Error('Workflow business history did not return form data, business snapshot, and attachments');
  }
  const initiated = await requestJson('/api/v1/buyer/workflow/instances?view=initiated', { headers: requesterHeaders });
  if (!initiated.some((item) => item.businessId === highDemandId)) {
    throw new Error('Initiated workflow ledger did not include the submitted demand');
  }
  const pending = await requestJson('/api/v1/buyer/workflow/instances?view=pending', { headers: reviewerHeaders });
  if (!pending.some((item) => item.businessId === highDemandId)) {
    throw new Error('Pending workflow ledger did not include the candidate task');
  }

  const highFinanceTask = await taskFor(reviewerHeaders, highDemandId, 'finance reviewer');
  if (highFinanceTask.taskName !== '财务复核' || !highFinanceTask.candidateRoleIds.includes(reviewerRoleId)) {
    throw new Error('High-value demand did not route to the configured candidate role');
  }
  await assertNoTaskFor(outsiderHeaders, highDemandId, 'cross-department candidate');
  await expectRequestFailure(
    `/api/v1/buyer/workflow/tasks/${highFinanceTask.taskId}/complete`,
    {
      method: 'POST',
      headers: { ...outsiderHeaders, 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'approve', comment: '跨部门越权办理' }),
    },
    403,
  );

  const highFirstHistory = await complete(
    reviewerHeaders,
    highFinanceTask,
    'approve',
    '财务复核通过，进入部门主管节点',
  );
  if (highFirstHistory.status !== 'processing') {
    throw new Error(`High-value demand did not advance to the second approval level: ${highFirstHistory.status}`);
  }
  const highManagerTask = await taskFor(managerHeaders, highDemandId, 'department manager');
  if (highManagerTask.taskName !== '部门主管复核' || highManagerTask.assigneeId !== managerId) {
    throw new Error('High-value demand did not assign its second level to the initiator department manager');
  }
  const managerNotifications = await requestJson('/api/v1/buyer/notifications', { headers: managerHeaders });
  if (!managerNotifications.some((notice) => notice.title === '待审批任务' && notice.content.includes(highDemandId))) {
    throw new Error('Assigned department manager did not receive the second-level task notification');
  }
  const highFinalHistory = await complete(
    managerHeaders,
    highManagerTask,
    'approve',
    '部门主管复核通过',
  );
  if (highFinalHistory.status !== 'approved') {
    throw new Error(`High-value demand did not complete after the second approval level: ${highFinalHistory.status}`);
  }
  const highActions = highFinalHistory.events.map((event) => event.action);
  if (highActions.filter((action) => action === 'approved').length !== 2) {
    throw new Error('High-value demand history did not retain both approvers');
  }
  const processed = await requestJson('/api/v1/buyer/workflow/instances?view=processed', { headers: reviewerHeaders });
  if (!processed.some((item) => item.businessId === highDemandId)) {
    throw new Error('Processed workflow ledger did not retain the reviewer action');
  }
  const allInstances = await requestJson('/api/v1/buyer/workflow/instances?view=all', { headers: managerHeaders });
  if (!allInstances.some((item) => item.businessId === highDemandId && item.status === 'approved')) {
    throw new Error('All workflow instances ledger did not include the completed demand');
  }

  await requestJson(`/api/v1/buyer/demands/${lowDemandId}/submit`, {
    method: 'POST',
    headers: { ...requesterHeaders, 'content-type': 'application/json' },
    body: JSON.stringify({ formData: { ...formData, urgency: '普通' } }),
  });
  await assertNoTaskFor(reviewerHeaders, lowDemandId, 'candidate role on the default branch');
  const lowManagerTask = await taskFor(managerHeaders, lowDemandId, 'department manager default branch');
  if (lowManagerTask.taskName !== '部门主管审批' || lowManagerTask.assigneeId !== managerId) {
    throw new Error('Low-value demand did not route to the default department manager branch');
  }
  const lowHistory = await complete(managerHeaders, lowManagerTask, 'approve', '常规采购审批通过');
  if (lowHistory.status !== 'approved') {
    throw new Error(`Low-value demand did not complete on the default branch: ${lowHistory.status}`);
  }

  const managerDemands = await requestJson('/api/v1/buyer/demands?keyword=工作流组合验收', {
    headers: managerHeaders,
  });
  const approvedDemandIds = new Set(
    managerDemands.filter((demand) => demand.status === '已通过').map((demand) => demand.id),
  );
  if (!approvedDemandIds.has(highDemandId) || !approvedDemandIds.has(lowDemandId)) {
    throw new Error('Workflow routing smoke did not apply final approval callbacks to both demands');
  }

  console.log(`Java workflow routing smoke passed at ${baseUrl}`);
  console.log(`Published Flowable version ${publishedDefinition.activeVersionId} for tenant ${tenantId}`);
  console.log(`Verified high-value ${highDemandId}: role candidate -> department manager -> approved`);
  console.log(`Verified low-value ${lowDemandId}: default department manager -> approved`);
  console.log(`Verified cross-department candidate ${outsider.userId} cannot view or complete the high-value task`);
  console.log('Verified workflow context, four ledgers, scoped task notifications, and complete approval history');
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
