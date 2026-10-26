package com.procurement.ludongpoc.application;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.procurement.workflow.definition.WorkflowPublicationPolicy;
import org.springframework.stereotype.Component;

@Component
public record LudongWorkflowPublicationPolicy(ObjectMapper json) implements WorkflowPublicationPolicy {
  public void validate(String businessType, String formSchema, String flowSchema) {
    if (!LudongPocWorkflowDefinition.BUSINESS_TYPE.equals(businessType)) return;
    try { LudongPocArchiveMaterialCatalog.parse(json.readTree(formSchema)); }
    catch (com.fasterxml.jackson.core.JsonProcessingException exception) {
      throw new IllegalArgumentException("附件配置格式错误", exception);
    }
  }
}
