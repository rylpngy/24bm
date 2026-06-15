package com.procurement.platform.domain;

public record PlatformTenant(
    String id,
    String name,
    String plan,
    String status,
    String enabledFeaturesJson,
    Integer userLimit) {
}
