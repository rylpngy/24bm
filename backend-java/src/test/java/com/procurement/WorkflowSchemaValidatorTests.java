package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatIllegalArgumentException;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.procurement.identity.infrastructure.BuyerUserMapper;
import com.procurement.workflow.definition.WorkflowDefinitionSchema;
import com.procurement.workflow.definition.WorkflowSchemaValidator;
import java.math.BigDecimal;
import java.util.Map;
import org.junit.jupiter.api.Test;

class WorkflowSchemaValidatorTests {
  private final BuyerUserMapper buyerUserMapper = mock(BuyerUserMapper.class);
  private final WorkflowSchemaValidator validator =
      new WorkflowSchemaValidator(new ObjectMapper(), buyerUserMapper);

  @Test
  void acceptsStructuredRoleAssignmentAndControlledAmountCondition() {
    when(buyerUserMapper.existsBuyerRoleByTenantAndId("tenant-1", "role-finance")).thenReturn(true);

    WorkflowDefinitionSchema schema = validator.validate("tenant-1", """
        {"fields":[{"id":"reason","type":"text","label":"申请理由","required":true}]}
        """, """
        {"steps":[{"id":"amount_route","type":"condition","branches":[
          {"label":"大额","condition":{"field":"$amount","op":">=","value":"100000"},"steps":[
            {"id":"finance_review","type":"approver","title":"财务复核","assignment":{"type":"role","roleId":"role-finance"}}]},
          {"label":"其他","steps":[
            {"id":"normal_review","type":"approver","title":"常规审批","assignment":{"type":"initiator_department_manager"}}]}]}]}
        """);

    assertThat(schema.steps()).hasSize(1);
    assertThat(validator.validateStartData(schema, Map.of("reason", "办公设备采购")))
        .containsEntry("reason", "办公设备采购");
  }

  @Test
  void rejectsAConditionalPathThatCanEndWithoutHumanApproval() {
    when(buyerUserMapper.existsBuyerRoleByTenantAndId("tenant-1", "role-finance")).thenReturn(true);

    assertThatIllegalArgumentException().isThrownBy(() -> validator.validate("tenant-1", "{\"fields\":[]}", """
        {"steps":[{"id":"amount_route","type":"condition","branches":[
          {"label":"自动结束","condition":{"field":"$amount","op":"<","value":"100000"},"steps":[
            {"id":"auto_done","type":"auto","title":"自动流转"}]},
          {"label":"人工审批","steps":[
            {"id":"finance_review","type":"approver","title":"财务复核","assignment":{"type":"role","roleId":"role-finance"}}]}]}]}
        """))
        .withMessageContaining("Every executable workflow path");
  }

  @Test
  void normalizesDynamicFormValuesAndRejectsUnknownFields() {
    when(buyerUserMapper.existsBuyerRoleByTenantAndId("tenant-1", "role-finance")).thenReturn(true);
    WorkflowDefinitionSchema schema = validator.validate("tenant-1", """
        {"fields":[
          {"id":"amount_note","type":"money","label":"补充金额","required":true},
          {"id":"source","type":"select","label":"采购来源","options":["计划内","计划外"]}]}
        """, """
        {"steps":[{"id":"review","type":"approver","title":"审批","assignment":{"type":"role","roleId":"role-finance"}}]}
        """);

    assertThat(validator.validateStartData(schema, Map.of("amount_note", "100.50", "source", "计划内")))
        .containsEntry("amount_note", new BigDecimal("100.50"))
        .containsEntry("source", "计划内");
    assertThatIllegalArgumentException()
        .isThrownBy(() -> validator.validateStartData(schema, Map.of("amount_note", "1", "unexpected", "x")))
        .withMessageContaining("Unknown workflow form field");
  }
}
