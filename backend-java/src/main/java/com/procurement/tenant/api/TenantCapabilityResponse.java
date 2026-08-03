package com.procurement.tenant.api;

import java.util.List;

/**
 * 租户能力(M-0):前端据此渲染导航与创建向导——与后端门禁同一份口径。
 *
 * @param methods 已开通的采购方式
 * @param moduleIds 已开通方式对应的工作台模块 id
 * @param methodGatedModuleIds 受方式开关管辖的全部模块 id;不在此列的模块与方式无关,
 *     仍由权限门禁决定可见性(前端不该把它们一并过滤掉)
 */
public record TenantCapabilityResponse(
    List<MethodCapability> methods,
    List<String> moduleIds,
    List<String> methodGatedModuleIds) {

  public record MethodCapability(String code, String label, boolean inCreateWizard) {}
}
