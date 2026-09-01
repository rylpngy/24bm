package com.procurement.ludongpoc.application;

final class LudongPocWorkflowDefinition {
  static final String BUSINESS_TYPE = "ludong_project_application";

  // 这里只保存发起时用于条件路由的事实。各审批节点填写项由 TaskFormCatalog 单独约束。
  static final String FORM_SCHEMA = """
      {"fields":[
        {"id":"sameFundingUnit","type":"select","label":"经费主管单位与申报单位相同","required":true,"options":["是","否"]},
        {"id":"requiresItReview","type":"select","label":"涉及信创产品审核","required":true,"options":["是","否"]},
        {"id":"requiresAssetReview","type":"select","label":"涉及办公设备或家具配置审核","required":true,"options":["是","否"]},
        {"id":"requiresLabReview","type":"select","label":"涉及大型仪器或实验室审核","required":true,"options":["是","否"]},
        {"id":"requiresSchoolLeader","type":"select","label":"达到分管校领导审核条件","required":true,"options":["是","否"]}
      ]}
      """;

  static final String FLOW_SCHEMA = """
      {"steps":[
        {"id":"argumentation_review","type":"approver","title":"购置必要性论证","assignment":{"type":"role","roleId":"role-ldu-argumentation"}},
        {"id":"technical_leader_review","type":"approver","title":"技术负责人确认","assignment":{"type":"role","roleId":"role-ldu-technical-leader"}},
        {"id":"compilation_participant_review","type":"approver","title":"参与编制人员确认","assignment":{"type":"role","roleId":"role-ldu-compilation-participant"}},
        {"id":"mall_selection_participant_review","type":"approver","title":"网上商城选型参与人确认","assignment":{"type":"role","roleId":"role-ldu-mall-selection-participant"}},
        {"id":"it_route","type":"condition","title":"信创产品审核路由","branches":[
          {"label":"涉及信创产品","condition":{"field":"requiresItReview","op":"==","value":"是"},"steps":[
            {"id":"it_review","type":"approver","title":"教育信息技术部审核","assignment":{"type":"role","roleId":"role-ldu-it-review"}}]},
          {"label":"不涉及","condition":null,"steps":[{"id":"it_skip","type":"auto","title":"无需信创审核"}]}
        ]},
        {"id":"unit_review","type":"approver","title":"申报单位负责人审核","assignment":{"type":"role","roleId":"role-ldu-unit-manager"}},
        {"id":"funding_route","type":"condition","title":"经费主管单位路由","branches":[
          {"label":"不同单位","condition":{"field":"sameFundingUnit","op":"==","value":"否"},"steps":[
            {"id":"funding_review","type":"approver","title":"经费主管单位负责人审核","assignment":{"type":"role","roleId":"role-ldu-funding-manager"}}]},
          {"label":"同一单位复用前序结论","condition":null,"steps":[{"id":"funding_skip","type":"auto","title":"经费主管单位审核自动复用"}]}
        ]},
        {"id":"asset_route","type":"condition","title":"办公设备及家具配置审核路由","branches":[
          {"label":"需要资产配置审核","condition":{"field":"requiresAssetReview","op":"==","value":"是"},"steps":[
            {"id":"asset_configuration_review","type":"approver","title":"资产处配置审核","assignment":{"type":"role","roleId":"role-ldu-asset-review"}},
            {"id":"asset_division_leader_review","type":"approver","title":"资产处分管领导审核","assignment":{"type":"role","roleId":"role-ldu-asset-division-leader"}},
            {"id":"asset_unit_leader_review","type":"approver","title":"资产处单位负责人审核","assignment":{"type":"role","roleId":"role-ldu-asset-unit-leader"}}]},
          {"label":"无需资产配置审核","condition":null,"steps":[{"id":"asset_skip","type":"auto","title":"无需资产配置审核"}]}
        ]},
        {"id":"lab_route","type":"condition","title":"实验室管理审核路由","branches":[
          {"label":"涉及大型仪器或实验室","condition":{"field":"requiresLabReview","op":"==","value":"是"},"steps":[
            {"id":"lab_equipment_review","type":"approver","title":"实验室管理处论证审核","assignment":{"type":"role","roleId":"role-ldu-lab-review"}},
            {"id":"lab_division_leader_review","type":"approver","title":"实验室管理处分管领导审核","assignment":{"type":"role","roleId":"role-ldu-lab-division-leader"}},
            {"id":"lab_unit_leader_review","type":"approver","title":"实验室管理处单位负责人审核","assignment":{"type":"role","roleId":"role-ldu-lab-unit-leader"}}]},
          {"label":"无需实验室审核","condition":null,"steps":[{"id":"lab_skip","type":"auto","title":"无需实验室审核"}]}
        ]},
        {"id":"leader_route","type":"condition","title":"分管校领导金额审核路由","branches":[
          {"label":"达到金额条件","condition":{"field":"requiresSchoolLeader","op":"==","value":"是"},"steps":[
            {"id":"school_leader_review","type":"approver","title":"分管校领导审核","assignment":{"type":"role","roleId":"role-ldu-school-leader"}}]},
          {"label":"未达到金额条件","condition":null,"steps":[{"id":"leader_skip","type":"auto","title":"未达到校领导审核金额条件"}]}
        ]},
        {"id":"finance_budget_review","type":"approver","title":"财务预算办公室审核","assignment":{"type":"role","roleId":"role-ldu-finance-budget"}},
        {"id":"procurement_budget_review","type":"approver","title":"采购预算办公室审核","assignment":{"type":"role","roleId":"role-ldu-procurement-budget"}},
        {"id":"handover_submit","type":"approver","title":"申请材料提交确认","assignment":{"type":"role","roleId":"role-ldu-handover-submitter"}},
        {"id":"handover_accept","type":"approver","title":"申请材料受理确认","assignment":{"type":"role","roleId":"role-ldu-handover"}},
        {"id":"procurement_method_review","type":"approver","title":"财经处采购方式审核","assignment":{"type":"role","roleId":"role-ldu-procurement-method"}},
        {"id":"finance_responsible_review","type":"approver","title":"财经处负责人终审","assignment":{"type":"role","roleId":"role-ldu-finance-responsible"}}
      ]}
      """;

  private LudongPocWorkflowDefinition() {
  }
}
