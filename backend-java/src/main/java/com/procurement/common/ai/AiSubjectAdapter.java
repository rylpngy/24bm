package com.procurement.common.ai;

import com.procurement.common.ai.AiContracts.Snapshot;

public interface AiSubjectAdapter {
  String subjectType();
  void authorize(String subjectId);
  Snapshot capture(String subjectId);
  default void authorizeSnapshot(String subjectId, Snapshot snapshot) { authorize(subjectId); }
}
