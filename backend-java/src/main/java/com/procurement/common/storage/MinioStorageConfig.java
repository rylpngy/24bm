package com.procurement.common.storage;

import io.minio.MinioClient;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties(MinioStorageProperties.class)
public class MinioStorageConfig {

  // MinioClient 的构建是离线的(仅持有配置,不建立连接),因此不依赖 MinIO 在场即可装配上下文。
  @Bean
  public MinioClient minioClient(MinioStorageProperties properties) {
    return MinioClient.builder()
        .endpoint(properties.endpoint())
        .credentials(properties.accessKey(), properties.secretKey())
        .build();
  }
}
