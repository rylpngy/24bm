package com.procurement.workflow.api;

import java.time.OffsetDateTime;

public record WorkflowTaskEventResponse(
    String id,
    String flowableTaskId,
    String nodeId,
    String nodeName,
    String action,
    String actorId,
    String actorName,
    String comment,
    OffsetDateTime createdAt,
    boolean effective) {
  public WorkflowTaskEventResponse(String id, String flowableTaskId, String nodeId, String nodeName,
      String action, String actorId, String actorName, String comment, OffsetDateTime createdAt) {
    this(id,flowableTaskId,nodeId,nodeName,action,actorId,actorName,comment,createdAt,true);
  }

  public WorkflowTaskEventResponse superseded() {
    return new WorkflowTaskEventResponse(id,flowableTaskId,nodeId,nodeName,action,actorId,actorName,comment,createdAt,false);
  }
}
