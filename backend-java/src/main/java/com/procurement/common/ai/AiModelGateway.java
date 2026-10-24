package com.procurement.common.ai;

import com.procurement.common.ai.AiContracts.ModelResult;
import com.procurement.common.ai.AiContracts.Snapshot;

public interface AiModelGateway {
  ModelResult analyze(Snapshot snapshot);
}
