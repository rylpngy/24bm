package com.procurement.common.ai;

import com.procurement.common.ai.AiContracts.ModelResult;
import com.procurement.common.ai.AiContracts.Snapshot;

public interface AiModelGateway {
  default boolean configured() { return false; }
  ModelResult analyze(Snapshot snapshot);
}
