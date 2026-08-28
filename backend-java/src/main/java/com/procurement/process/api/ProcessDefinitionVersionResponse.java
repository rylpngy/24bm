package com.procurement.process.api;

import java.time.OffsetDateTime;

/** 已发布 Flowable 流程版本在流程定义管理接口中的只读视图。 */
public record ProcessDefinitionVersionResponse(
    String id,
    String businessType,
    int versionNo,
    String status,
    String flowableProcessDefinitionId,
    OffsetDateTime publishedAt,
    String publishedBy) {
}
