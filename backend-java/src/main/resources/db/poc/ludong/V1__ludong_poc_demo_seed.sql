-- 鲁东大学 POC 演示租户。仅在 POC 环境显式执行，不属于生产 Flyway migration。
insert into tenants (id, name, plan, status, enabled_features, user_limit)
values ('tenant-ludong-poc', '鲁东大学采购申报 POC', 'POC', 'active', '["workflow","ludong-poc"]'::jsonb, 50)
on conflict (id) do update set name = excluded.name, status = excluded.status, updated_at = now();

insert into departments (id, tenant_id, name, parent_id, status)
values
  ('dept-ldu-org-admin', 'tenant-ludong-poc', '党政管理与教辅机构', null, 'active'),
  ('dept-ldu-org-academic', 'tenant-ludong-poc', '教学科研单位', null, 'active')
on conflict (id) do update set name = excluded.name, parent_id = excluded.parent_id,
  status = excluded.status, updated_at = now();

-- 机构名称取自鲁东大学官网公开组织机构/院部设置页面，仅作为 POC 组织主数据。
insert into departments (id, tenant_id, name, parent_id, status)
values
  ('dept-ldu-applicant', 'tenant-ludong-poc', '教务处', 'dept-ldu-org-admin', 'active'),
  ('dept-ldu-finance', 'tenant-ludong-poc', '财经处', 'dept-ldu-org-admin', 'active'),
  ('dept-ldu-assets', 'tenant-ludong-poc', '资产处', 'dept-ldu-org-admin', 'active'),
  ('dept-ldu-it', 'tenant-ludong-poc', '教育信息技术部（网络中心）', 'dept-ldu-org-admin', 'active'),
  ('dept-ldu-lab', 'tenant-ludong-poc', '实验室管理处', 'dept-ldu-org-admin', 'active'),
  ('dept-ldu-library', 'tenant-ludong-poc', '图书馆（档案馆）', 'dept-ldu-org-admin', 'active'),
  ('dept-ldu-graduate', 'tenant-ludong-poc', '研究生处', 'dept-ldu-org-admin', 'active'),
  ('dept-ldu-student', 'tenant-ludong-poc', '学生工作处', 'dept-ldu-org-admin', 'active'),
  ('dept-ldu-science', 'tenant-ludong-poc', '科学技术处', 'dept-ldu-org-admin', 'active'),
  ('dept-ldu-logistics', 'tenant-ludong-poc', '后勤处', 'dept-ldu-org-admin', 'active'),
  ('dept-ldu-csai', 'tenant-ludong-poc', '计算机与人工智能学院', 'dept-ldu-org-academic', 'active'),
  ('dept-ldu-math', 'tenant-ludong-poc', '数学与统计科学学院', 'dept-ldu-org-academic', 'active'),
  ('dept-ldu-physics', 'tenant-ludong-poc', '物理与光电工程学院', 'dept-ldu-org-academic', 'active'),
  ('dept-ldu-life', 'tenant-ludong-poc', '生命科学学院', 'dept-ldu-org-academic', 'active'),
  ('dept-ldu-transport', 'tenant-ludong-poc', '交通学院', 'dept-ldu-org-academic', 'active'),
  ('dept-ldu-civil', 'tenant-ludong-poc', '水利土木学院', 'dept-ldu-org-academic', 'active'),
  ('dept-ldu-education', 'tenant-ludong-poc', '教育学院', 'dept-ldu-org-academic', 'active'),
  ('dept-ldu-foreign', 'tenant-ludong-poc', '外国语学院', 'dept-ldu-org-academic', 'active'),
  ('dept-ldu-food', 'tenant-ludong-poc', '食品工程学院', 'dept-ldu-org-academic', 'active'),
  ('dept-ldu-energy', 'tenant-ludong-poc', '能源动力与电气工程学院', 'dept-ldu-org-academic', 'active'),
  ('dept-ldu-chip', 'tenant-ludong-poc', '集成电路学院', 'dept-ldu-org-academic', 'active')
on conflict (id) do update set name = excluded.name, parent_id = excluded.parent_id,
  status = excluded.status, updated_at = now();

insert into materials (
  id, tenant_id, code, name, category, unit, reference_price,
  specification, brand, tax_rate, description)
values
  ('mat-ldu-compute-workstation', 'tenant-ludong-poc', 'LDU-IT-001', '高性能计算工作站', '计算机设备', '台', 36000,
    '国产处理器，32GB 内存，1TB 固态硬盘，独立显卡', '联想、浪潮或同等档次', 13, '教学科研计算与数据处理'),
  ('mat-ldu-teaching-terminal', 'tenant-ludong-poc', 'LDU-IT-002', '教学办公终端', '计算机设备', '台', 6500,
    '国产处理器，16GB 内存，512GB 固态硬盘，23.8 英寸显示器', '联想、清华同方或同等档次', 13, '日常教学与办公终端'),
  ('mat-ldu-application-server', 'tenant-ludong-poc', 'LDU-IT-003', '应用服务器', '服务器设备', '台', 68000,
    '双路处理器，128GB 内存，企业级固态硬盘，冗余电源', '浪潮、曙光或同等档次', 13, '校内业务应用部署'),
  ('mat-ldu-projector', 'tenant-ludong-poc', 'LDU-AV-001', '教学投影设备', '教学设备', '套', 12800,
    '亮度不低于 5000 流明，支持高清输入与网络控制', '爱普生、松下或同等档次', 13, '多媒体教室建设'),
  ('mat-ldu-lab-instrument', 'tenant-ludong-poc', 'LDU-LAB-001', '实验数据采集仪', '实验仪器', '套', 85000,
    '多通道同步采集，配套分析软件，支持开放数据接口', '国产主流品牌或同等档次', 13, '实验教学与科研数据采集')
on conflict (tenant_id, code) do update set
  name = excluded.name,
  category = excluded.category,
  unit = excluded.unit,
  reference_price = excluded.reference_price,
  specification = excluded.specification,
  brand = excluded.brand,
  tax_rate = excluded.tax_rate,
  description = excluded.description;

insert into users (id, tenant_id, supplier_id, name, mobile, email, status, department_id, password_hash)
values
  ('user-ldu-applicant', 'tenant-ludong-poc', null, '项目申报人', '13810001001', 'ldu.applicant@example.com', 'active', 'dept-ldu-csai', '$2y$10$HKSnHnokVMkEYDQUlfB/e..3beDCFeM8KKj9.ZpFHGPTQeTjIKP.O'),
  ('user-ldu-reviewer', 'tenant-ludong-poc', null, '综合审批办理人', '13810001002', 'ldu.reviewer@example.com', 'active', 'dept-ldu-finance', '$2y$10$HKSnHnokVMkEYDQUlfB/e..3beDCFeM8KKj9.ZpFHGPTQeTjIKP.O'),
  ('user-ldu-admin', 'tenant-ludong-poc', null, 'POC 管理员', '13810001003', 'ldu.admin@example.com', 'active', 'dept-ldu-finance', '$2y$10$HKSnHnokVMkEYDQUlfB/e..3beDCFeM8KKj9.ZpFHGPTQeTjIKP.O')
on conflict (id) do update set name = excluded.name, email = excluded.email, status = excluded.status,
  department_id = excluded.department_id, password_hash = excluded.password_hash, updated_at = now();

-- 各审批岗位使用独立账号，避免一个综合账号掩盖真实串行流转。
insert into users (id, tenant_id, supplier_id, name, mobile, email, status, department_id, password_hash)
values
  ('user-ldu-argumentation', 'tenant-ludong-poc', null, '购置必要性论证人', '13810001101', 'ldu.argumentation@example.com', 'active', 'dept-ldu-csai', '$2y$10$HKSnHnokVMkEYDQUlfB/e..3beDCFeM8KKj9.ZpFHGPTQeTjIKP.O'),
  ('user-ldu-it-review', 'tenant-ludong-poc', null, '教育信息技术部审核人', '13810001102', 'ldu.it@example.com', 'active', 'dept-ldu-it', '$2y$10$HKSnHnokVMkEYDQUlfB/e..3beDCFeM8KKj9.ZpFHGPTQeTjIKP.O'),
  ('user-ldu-unit-manager', 'tenant-ludong-poc', null, '申报单位负责人', '13810001103', 'ldu.unit.manager@example.com', 'active', 'dept-ldu-csai', '$2y$10$HKSnHnokVMkEYDQUlfB/e..3beDCFeM8KKj9.ZpFHGPTQeTjIKP.O'),
  ('user-ldu-funding-manager', 'tenant-ludong-poc', null, '经费主管单位负责人', '13810001104', 'ldu.funding.manager@example.com', 'active', 'dept-ldu-finance', '$2y$10$HKSnHnokVMkEYDQUlfB/e..3beDCFeM8KKj9.ZpFHGPTQeTjIKP.O'),
  ('user-ldu-asset-review', 'tenant-ludong-poc', null, '资产处配置审核人', '13810001105', 'ldu.asset.reviewer@example.com', 'active', 'dept-ldu-assets', '$2y$10$HKSnHnokVMkEYDQUlfB/e..3beDCFeM8KKj9.ZpFHGPTQeTjIKP.O'),
  ('user-ldu-asset-division', 'tenant-ludong-poc', null, '资产处分管领导', '13810001106', 'ldu.asset.division@example.com', 'active', 'dept-ldu-assets', '$2y$10$HKSnHnokVMkEYDQUlfB/e..3beDCFeM8KKj9.ZpFHGPTQeTjIKP.O'),
  ('user-ldu-asset-unit', 'tenant-ludong-poc', null, '资产处单位负责人', '13810001107', 'ldu.asset.unit@example.com', 'active', 'dept-ldu-assets', '$2y$10$HKSnHnokVMkEYDQUlfB/e..3beDCFeM8KKj9.ZpFHGPTQeTjIKP.O'),
  ('user-ldu-lab-review', 'tenant-ludong-poc', null, '实验室管理处审核人', '13810001108', 'ldu.lab.reviewer@example.com', 'active', 'dept-ldu-lab', '$2y$10$HKSnHnokVMkEYDQUlfB/e..3beDCFeM8KKj9.ZpFHGPTQeTjIKP.O'),
  ('user-ldu-lab-division', 'tenant-ludong-poc', null, '实验室管理处分管领导', '13810001109', 'ldu.lab.division@example.com', 'active', 'dept-ldu-lab', '$2y$10$HKSnHnokVMkEYDQUlfB/e..3beDCFeM8KKj9.ZpFHGPTQeTjIKP.O'),
  ('user-ldu-lab-unit', 'tenant-ludong-poc', null, '实验室管理处单位负责人', '13810001110', 'ldu.lab.unit@example.com', 'active', 'dept-ldu-lab', '$2y$10$HKSnHnokVMkEYDQUlfB/e..3beDCFeM8KKj9.ZpFHGPTQeTjIKP.O'),
  ('user-ldu-school-leader', 'tenant-ludong-poc', null, '分管校领导', '13810001111', 'ldu.school.leader@example.com', 'active', 'dept-ldu-finance', '$2y$10$HKSnHnokVMkEYDQUlfB/e..3beDCFeM8KKj9.ZpFHGPTQeTjIKP.O'),
  ('user-ldu-finance-budget', 'tenant-ludong-poc', null, '财务预算办公室审核人', '13810001112', 'ldu.finance.budget@example.com', 'active', 'dept-ldu-finance', '$2y$10$HKSnHnokVMkEYDQUlfB/e..3beDCFeM8KKj9.ZpFHGPTQeTjIKP.O'),
  ('user-ldu-procurement-budget', 'tenant-ludong-poc', null, '采购预算办公室审核人', '13810001113', 'ldu.procurement.budget@example.com', 'active', 'dept-ldu-finance', '$2y$10$HKSnHnokVMkEYDQUlfB/e..3beDCFeM8KKj9.ZpFHGPTQeTjIKP.O'),
  ('user-ldu-handover', 'tenant-ludong-poc', null, '采购申请受理人', '13810001114', 'ldu.handover@example.com', 'active', 'dept-ldu-finance', '$2y$10$HKSnHnokVMkEYDQUlfB/e..3beDCFeM8KKj9.ZpFHGPTQeTjIKP.O'),
  ('user-ldu-method', 'tenant-ludong-poc', null, '财经处采购方式经办人', '13810001115', 'ldu.method@example.com', 'active', 'dept-ldu-finance', '$2y$10$HKSnHnokVMkEYDQUlfB/e..3beDCFeM8KKj9.ZpFHGPTQeTjIKP.O'),
  ('user-ldu-finance-responsible', 'tenant-ludong-poc', null, '财经处负责人', '13810001116', 'ldu.finance.responsible@example.com', 'active', 'dept-ldu-finance', '$2y$10$HKSnHnokVMkEYDQUlfB/e..3beDCFeM8KKj9.ZpFHGPTQeTjIKP.O')
on conflict (id) do update set name = excluded.name, email = excluded.email, status = excluded.status,
  department_id = excluded.department_id, password_hash = excluded.password_hash, updated_at = now();

update departments set manager_id = case id
  when 'dept-ldu-applicant' then 'user-ldu-unit-manager'
  when 'dept-ldu-finance' then 'user-ldu-finance-responsible'
  when 'dept-ldu-assets' then 'user-ldu-asset-unit'
  when 'dept-ldu-it' then 'user-ldu-it-review'
  when 'dept-ldu-lab' then 'user-ldu-lab-unit'
  when 'dept-ldu-csai' then 'user-ldu-unit-manager'
  else manager_id end
where tenant_id = 'tenant-ludong-poc'
  and id in ('dept-ldu-applicant', 'dept-ldu-finance', 'dept-ldu-assets', 'dept-ldu-it', 'dept-ldu-lab', 'dept-ldu-csai');

insert into roles (id, tenant_id, scope, name, permissions, data_scope)
values
  ('role-ldu-applicant', 'tenant-ludong-poc', 'buyer', 'POC 项目申报人',
    '["buyer:ludong-poc:read","buyer:ludong-poc:write","buyer:ludong-poc:review","buyer:ludong-poc:export","buyer:workflow:read","buyer:workflow:review","buyer:material:read"]'::jsonb, 'all'),
  ('role-ldu-reviewer-base', 'tenant-ludong-poc', 'buyer', 'POC 审批办理权限',
    '["buyer:ludong-poc:read","buyer:ludong-poc:review","buyer:ludong-poc:export","buyer:workflow:read","buyer:workflow:review","buyer:material:read"]'::jsonb, 'all'),
  ('role-ldu-admin', 'tenant-ludong-poc', 'buyer', 'POC 管理员', '["buyer:*"]'::jsonb, 'all'),
  ('role-ldu-argumentation', 'tenant-ludong-poc', 'buyer', '购置必要性论证人', '[]'::jsonb, 'all'),
  ('role-ldu-unit-manager', 'tenant-ludong-poc', 'buyer', '申报单位负责人', '[]'::jsonb, 'all'),
  ('role-ldu-funding-manager', 'tenant-ludong-poc', 'buyer', '经费主管单位负责人', '[]'::jsonb, 'all'),
  ('role-ldu-it-review', 'tenant-ludong-poc', 'buyer', '教育信息技术部审核人', '[]'::jsonb, 'all'),
  ('role-ldu-asset-review', 'tenant-ludong-poc', 'buyer', '资产处配置审核人', '[]'::jsonb, 'all'),
  ('role-ldu-asset-division-leader', 'tenant-ludong-poc', 'buyer', '资产处分管领导', '[]'::jsonb, 'all'),
  ('role-ldu-asset-unit-leader', 'tenant-ludong-poc', 'buyer', '资产处单位负责人', '[]'::jsonb, 'all'),
  ('role-ldu-lab-review', 'tenant-ludong-poc', 'buyer', '实验室管理处审核人', '[]'::jsonb, 'all'),
  ('role-ldu-lab-division-leader', 'tenant-ludong-poc', 'buyer', '实验室管理处分管领导', '[]'::jsonb, 'all'),
  ('role-ldu-lab-unit-leader', 'tenant-ludong-poc', 'buyer', '实验室管理处单位负责人', '[]'::jsonb, 'all'),
  ('role-ldu-school-leader', 'tenant-ludong-poc', 'buyer', '分管校领导', '[]'::jsonb, 'all'),
  ('role-ldu-finance-budget', 'tenant-ludong-poc', 'buyer', '财务预算审核人', '[]'::jsonb, 'all'),
  ('role-ldu-procurement-budget', 'tenant-ludong-poc', 'buyer', '采购预算审核人', '[]'::jsonb, 'all'),
  ('role-ldu-handover-submitter', 'tenant-ludong-poc', 'buyer', '采购申请提交人', '[]'::jsonb, 'all'),
  ('role-ldu-handover', 'tenant-ludong-poc', 'buyer', '采购申请受理人', '[]'::jsonb, 'all'),
  ('role-ldu-procurement-method', 'tenant-ludong-poc', 'buyer', '采购方式审核人', '[]'::jsonb, 'all'),
  ('role-ldu-finance-responsible', 'tenant-ludong-poc', 'buyer', '财经处负责人', '[]'::jsonb, 'all')
on conflict (id) do update set name = excluded.name, permissions = excluded.permissions, data_scope = excluded.data_scope;

insert into user_roles (user_id, role_id)
values
  ('user-ldu-applicant', 'role-ldu-applicant'),
  ('user-ldu-reviewer', 'role-ldu-reviewer-base'),
  ('user-ldu-reviewer', 'role-ldu-unit-manager'),
  ('user-ldu-reviewer', 'role-ldu-funding-manager'),
  ('user-ldu-reviewer', 'role-ldu-it-review'),
  ('user-ldu-reviewer', 'role-ldu-asset-review'),
  ('user-ldu-reviewer', 'role-ldu-lab-review'),
  ('user-ldu-reviewer', 'role-ldu-school-leader'),
  ('user-ldu-reviewer', 'role-ldu-finance-budget'),
  ('user-ldu-reviewer', 'role-ldu-procurement-budget'),
  ('user-ldu-reviewer', 'role-ldu-handover'),
  ('user-ldu-reviewer', 'role-ldu-procurement-method'),
  ('user-ldu-admin', 'role-ldu-admin')
on conflict (user_id, role_id) do nothing;

-- 将早期手工演示数据归一到当前 POC 组织主数据，避免单位名称与 department_id 不一致。
update ludong_poc_applications
set applicant_unit = '计算机与人工智能学院', department_id = 'dept-ldu-csai', updated_at = updated_at
where tenant_id = 'tenant-ludong-poc' and applicant_unit = '计算机学院';

update ludong_poc_applications
set applicant_unit = '能源动力与电气工程学院', department_id = 'dept-ldu-energy', updated_at = updated_at
where tenant_id = 'tenant-ludong-poc' and applicant_unit = '信息与电气工程学院';

update ludong_poc_applications
set applicant_unit = '资产处', department_id = 'dept-ldu-assets', updated_at = updated_at
where tenant_id = 'tenant-ludong-poc' and applicant_unit = '资产管理处';

-- 公开采购场景的脱敏仿真数据。项目名称、金额和负责人均为 POC 构造，不代表学校真实在办项目。
insert into ludong_poc_applications (
  id, tenant_id, application_no, project_name, applicant_unit, department_id,
  budget_amount, status, form_data, items, created_by, created_at, updated_at)
values
  ('ldu-poc-demo-csai', 'tenant-ludong-poc', 'LDU-POC-2026-001',
    '人工智能实验室计算节点更新项目', '计算机与人工智能学院', 'dept-ldu-csai', 288000, 'draft',
    '{"applicantUnitType":"学院","projectLeaderName":"王老师","projectLeaderPhone":"13800002001","technicalLeaderName":"赵老师","technicalLeaderPhone":"13800002002","fundingSource":"学科建设经费","fundingUnitId":"dept-ldu-csai","fundingUnitName":"计算机与人工智能学院","fundingProjectName":"人工智能学科平台建设专项","fundingProjectNo":"POC-XK-2026-01","sameFundingUnit":"是","requiresItReview":"是","requiresAssetReview":"否","requiresLabReview":"是","pocDataNotice":"官网公开场景脱敏仿真，不代表真实在办项目"}'::jsonb,
    '[{"name":"高性能计算工作站","quantity":"4","purpose":"人工智能实验教学与模型训练"},{"name":"应用服务器","quantity":"2","purpose":"实验数据和模型服务部署"}]'::jsonb, 'user-ldu-applicant', now() - interval '5 days', now() - interval '5 days'),
  ('ldu-poc-demo-library', 'tenant-ludong-poc', 'LDU-POC-2026-002',
    '数字资源访问终端更新项目', '图书馆（档案馆）', 'dept-ldu-library', 128000, 'draft',
    '{"applicantUnitType":"其他单位","projectLeaderName":"刘老师","projectLeaderPhone":"13800002003","technicalLeaderName":"陈老师","technicalLeaderPhone":"13800002004","fundingSource":"信息化建设经费","fundingUnitId":"dept-ldu-finance","fundingUnitName":"财经处","fundingProjectName":"图书馆数字资源服务保障专项","fundingProjectNo":"POC-XXH-2026-02","sameFundingUnit":"否","requiresItReview":"是","requiresAssetReview":"是","requiresLabReview":"否","pocDataNotice":"官网公开场景脱敏仿真，不代表真实在办项目"}'::jsonb,
    '[{"name":"数字资源访问终端","quantity":"12","purpose":"读者数字资源检索与移动阅读服务"}]'::jsonb, 'user-ldu-applicant', now() - interval '4 days', now() - interval '4 days'),
  ('ldu-poc-demo-physics', 'tenant-ludong-poc', 'LDU-POC-2026-003',
    '光电实验数据采集设备购置项目', '物理与光电工程学院', 'dept-ldu-physics', 420000, 'draft',
    '{"applicantUnitType":"学院","projectLeaderName":"孙老师","projectLeaderPhone":"13800002005","technicalLeaderName":"周老师","technicalLeaderPhone":"13800002006","fundingSource":"实验室建设经费","fundingUnitId":"dept-ldu-physics","fundingUnitName":"物理与光电工程学院","fundingProjectName":"光电实验教学条件提升专项","fundingProjectNo":"POC-SYS-2026-03","sameFundingUnit":"是","requiresItReview":"否","requiresAssetReview":"否","requiresLabReview":"是","pocDataNotice":"官网公开场景脱敏仿真，不代表真实在办项目"}'::jsonb,
    '[{"name":"实验数据采集仪","quantity":"5","purpose":"光电实验信号同步采集与分析"}]'::jsonb, 'user-ldu-applicant', now() - interval '3 days', now() - interval '3 days'),
  ('ldu-poc-demo-it', 'tenant-ludong-poc', 'LDU-POC-2026-004',
    '校内业务应用服务器扩容项目', '教育信息技术部（网络中心）', 'dept-ldu-it', 204000, 'draft',
    '{"applicantUnitType":"其他单位","projectLeaderName":"郑老师","projectLeaderPhone":"13800002007","technicalLeaderName":"吴老师","technicalLeaderPhone":"13800002008","fundingSource":"信息化建设经费","fundingUnitId":"dept-ldu-finance","fundingUnitName":"财经处","fundingProjectName":"校园信息化基础设施专项","fundingProjectNo":"POC-XXH-2026-04","sameFundingUnit":"否","requiresItReview":"是","requiresAssetReview":"否","requiresLabReview":"否","pocDataNotice":"官网公开场景脱敏仿真，不代表真实在办项目"}'::jsonb,
    '[{"name":"应用服务器","quantity":"3","purpose":"校内业务系统和数据库运行"}]'::jsonb, 'user-ldu-applicant', now() - interval '2 days', now() - interval '2 days'),
  ('ldu-poc-demo-jwc', 'tenant-ludong-poc', 'LDU-POC-2026-005',
    '多媒体教室教学投影设备更新项目', '教务处', 'dept-ldu-applicant', 192000, 'draft',
    '{"applicantUnitType":"其他单位","projectLeaderName":"冯老师","projectLeaderPhone":"13800002009","technicalLeaderName":"褚老师","technicalLeaderPhone":"13800002010","fundingSource":"年度教学经费","fundingUnitId":"dept-ldu-applicant","fundingUnitName":"教务处","fundingProjectName":"本科教学条件改善专项","fundingProjectNo":"POC-JX-2026-05","sameFundingUnit":"是","requiresItReview":"否","requiresAssetReview":"是","requiresLabReview":"否","pocDataNotice":"官网公开场景脱敏仿真，不代表真实在办项目"}'::jsonb,
    '[{"name":"教学投影设备","quantity":"15","purpose":"多媒体教室教学展示"}]'::jsonb, 'user-ldu-applicant', now() - interval '1 day', now() - interval '1 day')
on conflict (id) do nothing;

-- 仅为仍为空的 POC 固定草稿补入拟采购设备，避免覆盖演示人员已经编辑的内容。
update ludong_poc_applications set
  form_data = form_data || case id
    when 'ldu-poc-demo-csai' then '{"fundingUnitId":"dept-ldu-csai","fundingUnitName":"计算机与人工智能学院"}'::jsonb
    when 'ldu-poc-demo-library' then '{"fundingUnitId":"dept-ldu-finance","fundingUnitName":"财经处"}'::jsonb
    when 'ldu-poc-demo-physics' then '{"fundingUnitId":"dept-ldu-physics","fundingUnitName":"物理与光电工程学院"}'::jsonb
    when 'ldu-poc-demo-it' then '{"fundingUnitId":"dept-ldu-finance","fundingUnitName":"财经处"}'::jsonb
    when 'ldu-poc-demo-jwc' then '{"fundingUnitId":"dept-ldu-applicant","fundingUnitName":"教务处"}'::jsonb
    else '{}'::jsonb end,
  items = case id
    when 'ldu-poc-demo-csai' then '[{"name":"高性能计算工作站","quantity":"4","purpose":"人工智能实验教学与模型训练"},{"name":"应用服务器","quantity":"2","purpose":"实验数据和模型服务部署"}]'::jsonb
    when 'ldu-poc-demo-library' then '[{"name":"数字资源访问终端","quantity":"12","purpose":"读者数字资源检索与移动阅读服务"}]'::jsonb
    when 'ldu-poc-demo-physics' then '[{"name":"实验数据采集仪","quantity":"5","purpose":"光电实验信号同步采集与分析"}]'::jsonb
    when 'ldu-poc-demo-it' then '[{"name":"应用服务器","quantity":"3","purpose":"校内业务系统和数据库运行"}]'::jsonb
    when 'ldu-poc-demo-jwc' then '[{"name":"教学投影设备","quantity":"15","purpose":"多媒体教室教学展示"}]'::jsonb
    else items end
where tenant_id = 'tenant-ludong-poc'
  and id in ('ldu-poc-demo-csai', 'ldu-poc-demo-library', 'ldu-poc-demo-physics', 'ldu-poc-demo-it', 'ldu-poc-demo-jwc')
  and jsonb_array_length(items) = 0;

-- 固定演示草稿预置可解释判断快照；后续在页面保存时会按最新表单重新计算。
update ludong_poc_applications set form_data = form_data || case id
  when 'ldu-poc-demo-csai' then '{"sameFundingUnitMode":"auto","sameFundingUnitSystemValue":"是","sameFundingUnitReason":"申报单位：计算机与人工智能学院；经费主管单位：计算机与人工智能学院；两个组织 ID 一致","requiresItReviewMode":"auto","requiresItReviewSystemValue":"是","requiresItReviewReason":"申报单位命中“计算机”；项目名称命中“人工智能”；设备清单命中“服务器”","requiresAssetReviewMode":"auto","requiresAssetReviewSystemValue":"否","requiresAssetReviewReason":"申报单位、项目名称和设备清单均未命中当前规则关键词","requiresLabReviewMode":"auto","requiresLabReviewSystemValue":"是","requiresLabReviewReason":"项目名称命中“实验室”；设备清单命中“工作站”"}'::jsonb
  when 'ldu-poc-demo-library' then '{"sameFundingUnitMode":"auto","sameFundingUnitSystemValue":"否","sameFundingUnitReason":"申报单位：图书馆（档案馆）；经费主管单位：财经处；两个组织 ID 不一致","requiresItReviewMode":"auto","requiresItReviewSystemValue":"是","requiresItReviewReason":"项目名称命中“终端”；设备清单命中“终端”","requiresAssetReviewMode":"auto","requiresAssetReviewSystemValue":"是","requiresAssetReviewReason":"项目名称命中“终端”；设备清单命中“终端”","requiresLabReviewMode":"auto","requiresLabReviewSystemValue":"否","requiresLabReviewReason":"申报单位、项目名称和设备清单均未命中当前规则关键词"}'::jsonb
  when 'ldu-poc-demo-physics' then '{"sameFundingUnitMode":"auto","sameFundingUnitSystemValue":"是","sameFundingUnitReason":"申报单位：物理与光电工程学院；经费主管单位：物理与光电工程学院；两个组织 ID 一致","requiresItReviewMode":"auto","requiresItReviewSystemValue":"否","requiresItReviewReason":"申报单位、项目名称和设备清单均未命中当前规则关键词","requiresAssetReviewMode":"auto","requiresAssetReviewSystemValue":"否","requiresAssetReviewReason":"申报单位、项目名称和设备清单均未命中当前规则关键词","requiresLabReviewMode":"auto","requiresLabReviewSystemValue":"是","requiresLabReviewReason":"项目名称命中“实验”；项目名称命中“光电”；设备清单命中“采集”"}'::jsonb
  when 'ldu-poc-demo-it' then '{"sameFundingUnitMode":"auto","sameFundingUnitSystemValue":"否","sameFundingUnitReason":"申报单位：教育信息技术部（网络中心）；经费主管单位：财经处；两个组织 ID 不一致","requiresItReviewMode":"auto","requiresItReviewSystemValue":"是","requiresItReviewReason":"申报单位命中“网络”；项目名称命中“服务器”；设备清单命中“服务器”；设备清单命中“系统”；设备清单命中“数据库”","requiresAssetReviewMode":"auto","requiresAssetReviewSystemValue":"否","requiresAssetReviewReason":"申报单位、项目名称和设备清单均未命中当前规则关键词","requiresLabReviewMode":"auto","requiresLabReviewSystemValue":"否","requiresLabReviewReason":"申报单位、项目名称和设备清单均未命中当前规则关键词"}'::jsonb
  when 'ldu-poc-demo-jwc' then '{"sameFundingUnitMode":"auto","sameFundingUnitSystemValue":"是","sameFundingUnitReason":"申报单位：教务处；经费主管单位：教务处；两个组织 ID 一致","requiresItReviewMode":"auto","requiresItReviewSystemValue":"否","requiresItReviewReason":"申报单位、项目名称和设备清单均未命中当前规则关键词","requiresAssetReviewMode":"auto","requiresAssetReviewSystemValue":"是","requiresAssetReviewReason":"项目名称命中“投影”；设备清单命中“投影”","requiresLabReviewMode":"auto","requiresLabReviewSystemValue":"否","requiresLabReviewReason":"申报单位、项目名称和设备清单均未命中当前规则关键词"}'::jsonb
  else '{}'::jsonb end
where tenant_id = 'tenant-ludong-poc'
  and id in ('ldu-poc-demo-csai', 'ldu-poc-demo-library', 'ldu-poc-demo-physics', 'ldu-poc-demo-it', 'ldu-poc-demo-jwc')
  and coalesce(form_data ->> 'sameFundingUnitMode', '') = '';

-- 清除旧版“综合审批人承担全部角色”的映射，再按真实岗位一人一角分配。
delete from user_roles
where user_id = 'user-ldu-reviewer'
  and role_id not in ('role-ldu-reviewer-base');

insert into user_roles (user_id, role_id)
values
  ('user-ldu-argumentation', 'role-ldu-reviewer-base'), ('user-ldu-argumentation', 'role-ldu-argumentation'),
  ('user-ldu-it-review', 'role-ldu-reviewer-base'), ('user-ldu-it-review', 'role-ldu-it-review'),
  ('user-ldu-unit-manager', 'role-ldu-reviewer-base'), ('user-ldu-unit-manager', 'role-ldu-unit-manager'),
  ('user-ldu-funding-manager', 'role-ldu-reviewer-base'), ('user-ldu-funding-manager', 'role-ldu-funding-manager'),
  ('user-ldu-asset-review', 'role-ldu-reviewer-base'), ('user-ldu-asset-review', 'role-ldu-asset-review'),
  ('user-ldu-asset-division', 'role-ldu-reviewer-base'), ('user-ldu-asset-division', 'role-ldu-asset-division-leader'),
  ('user-ldu-asset-unit', 'role-ldu-reviewer-base'), ('user-ldu-asset-unit', 'role-ldu-asset-unit-leader'),
  ('user-ldu-lab-review', 'role-ldu-reviewer-base'), ('user-ldu-lab-review', 'role-ldu-lab-review'),
  ('user-ldu-lab-division', 'role-ldu-reviewer-base'), ('user-ldu-lab-division', 'role-ldu-lab-division-leader'),
  ('user-ldu-lab-unit', 'role-ldu-reviewer-base'), ('user-ldu-lab-unit', 'role-ldu-lab-unit-leader'),
  ('user-ldu-school-leader', 'role-ldu-reviewer-base'), ('user-ldu-school-leader', 'role-ldu-school-leader'),
  ('user-ldu-finance-budget', 'role-ldu-reviewer-base'), ('user-ldu-finance-budget', 'role-ldu-finance-budget'),
  ('user-ldu-procurement-budget', 'role-ldu-reviewer-base'), ('user-ldu-procurement-budget', 'role-ldu-procurement-budget'),
  ('user-ldu-applicant', 'role-ldu-handover-submitter'),
  ('user-ldu-handover', 'role-ldu-reviewer-base'), ('user-ldu-handover', 'role-ldu-handover'),
  ('user-ldu-method', 'role-ldu-reviewer-base'), ('user-ldu-method', 'role-ldu-procurement-method'),
  ('user-ldu-finance-responsible', 'role-ldu-reviewer-base'), ('user-ldu-finance-responsible', 'role-ldu-finance-responsible')
on conflict (user_id, role_id) do nothing;
