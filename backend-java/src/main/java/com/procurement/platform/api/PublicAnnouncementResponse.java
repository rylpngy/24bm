package com.procurement.platform.api;

import java.time.OffsetDateTime;

// 公开门户公告:生效中的平台公告(标题/正文/受众/时间)。
public record PublicAnnouncementResponse(
    String id,
    String title,
    String content,
    String audience,
    OffsetDateTime createdAt) {
}
