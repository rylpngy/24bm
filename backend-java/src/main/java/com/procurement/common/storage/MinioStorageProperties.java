package com.procurement.common.storage;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "procurement.storage.minio")
public record MinioStorageProperties(
    String endpoint,
    String accessKey,
    String secretKey,
    String bucket) {
}
