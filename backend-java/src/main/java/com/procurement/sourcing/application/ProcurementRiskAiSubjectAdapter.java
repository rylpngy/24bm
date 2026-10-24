package com.procurement.sourcing.application;

import com.procurement.common.ai.*;
import com.procurement.common.ai.AiContracts.*;
import org.springframework.stereotype.Component;

@Component
public class ProcurementRiskAiSubjectAdapter implements AiSubjectAdapter {
  private final ProcurementExecutionApplicationService execution;
  public ProcurementRiskAiSubjectAdapter(ProcurementExecutionApplicationService execution) { this.execution=execution; }
  public String subjectType() { return "procurement_risk"; }
  public void authorize(String id) { execution.authorizeAiEvidence(id,null); }
  public Snapshot capture(String id) { return execution.captureAiEvidence(id); }
  public void authorizeSnapshot(String id,Snapshot snapshot) { execution.authorizeAiEvidence(id,snapshot); }
}
