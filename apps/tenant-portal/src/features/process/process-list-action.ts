import type { WorkflowProcessDefinition } from '@24bid/api-client';

export type ProcessListPrimaryAction =
  | { type: 'configure'; processId: string }
  | { type: 'create' };

// 一个业务类型只保留一个逻辑定义；已存在时应进入该定义发布新版本。
export function resolveProcessListPrimaryAction(
  processes: WorkflowProcessDefinition[],
  businessType: string,
): ProcessListPrimaryAction {
  const existingProcess = processes.find((process) => process.businessType === businessType);
  return existingProcess?.id
    ? { type: 'configure', processId: existingProcess.id }
    : { type: 'create' };
}
