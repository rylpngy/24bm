package com.procurement.workflow.application;

import com.procurement.workflow.domain.WorkflowBusinessInstance;

// 业务回调边界：流程引擎只负责状态和任务，具体采购业务的状态变更由对应处理器完成。
public interface WorkflowBusinessCompletionHandler {
  String businessType();

  void onCompleted(WorkflowBusinessInstance instance, WorkflowCompletion completion);
}
