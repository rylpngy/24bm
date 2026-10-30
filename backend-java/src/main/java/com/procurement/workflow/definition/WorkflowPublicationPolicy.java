package com.procurement.workflow.definition;

/** Business modules validate their own versioned configuration before deployment. */
public interface WorkflowPublicationPolicy {
  void validate(String businessType, String formSchema, String flowSchema);
}
