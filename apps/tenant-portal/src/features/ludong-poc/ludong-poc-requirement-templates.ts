export const acceptanceStandardTemplate = [
  '货物安装完成正常运行后，由供货商提出验收申请，项目单位同意后，按照学校验收的权限，相关部门及人员形成验收小组，验收小组根据采购文件、投标文件、合同等项目文件约定内容对项目进行综合运行验收。',
  '如验收达不到规定要求，采购人有权要求更换货物或拒绝付款，成交供应商若违约，采购人将依法追究相应法律责任。',
] as const;

export const otherTechnicalRequirementsTemplate =
  '符合国家关于国产设备节能要求、强制采购要求和优先采购要求。';

export function requirementSupplement(template: readonly string[] | string, supplement?: string) {
  const fixed = typeof template === 'string' ? [template] : template;
  let additional = supplement?.trim() ?? '';
  fixed.forEach((line) => { additional = additional.replace(line, '').trim(); });
  return additional.replace(/^申报补充：/, '').trim();
}

export function requirementText(template: readonly string[] | string, supplement?: string) {
  const fixed = typeof template === 'string' ? [template] : template;
  const additional = requirementSupplement(fixed, supplement);
  return additional ? [...fixed, `申报补充：${additional}`].join('\n') : fixed.join('\n');
}
