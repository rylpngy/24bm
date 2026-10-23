package com.procurement.common.storage;

import io.minio.BucketExistsArgs;
import io.minio.GetObjectArgs;
import io.minio.GetObjectResponse;
import io.minio.MakeBucketArgs;
import io.minio.MinioClient;
import io.minio.PutObjectArgs;
import jakarta.annotation.PostConstruct;
import java.io.ByteArrayInputStream;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class MinioObjectStorageService implements ObjectStorageService {
  private static final Logger log = LoggerFactory.getLogger(MinioObjectStorageService.class);

  private final MinioClient minioClient;
  private final String bucket;

  public MinioObjectStorageService(MinioClient minioClient, MinioStorageProperties properties) {
    this.minioClient = minioClient;
    this.bucket = properties.bucket();
  }

  // 启动时确保桶存在；MinIO 不在场时降级为告警,不阻断应用与测试上下文。
  @PostConstruct
  void ensureBucket() {
    try {
      boolean exists = minioClient.bucketExists(BucketExistsArgs.builder().bucket(bucket).build());
      if (!exists) {
        minioClient.makeBucket(MakeBucketArgs.builder().bucket(bucket).build());
        log.info("已创建对象存储桶 {}", bucket);
      }
    } catch (Exception exception) {
      log.warn("无法确保对象存储桶 {}(MinIO 是否在场?):{}", bucket, exception.getMessage());
    }
  }

  @Override
  public void put(String storageKey, byte[] data, String contentType) {
    try {
      minioClient.putObject(
          PutObjectArgs.builder()
              .bucket(bucket)
              .object(storageKey)
              .stream(new ByteArrayInputStream(data), data.length, -1)
              .contentType(contentType == null || contentType.isBlank()
                  ? "application/octet-stream"
                  : contentType)
              .build());
    } catch (Exception exception) {
      throw new IllegalStateException("对象上传失败:" + storageKey, exception);
    }
  }

  @Override
  public StoredObject get(String storageKey) {
    try (GetObjectResponse response = minioClient.getObject(
        GetObjectArgs.builder().bucket(bucket).object(storageKey).build())) {
      byte[] data = response.readAllBytes();
      String contentType = response.headers().get("Content-Type");
      return new StoredObject(data, contentType);
    } catch (io.minio.errors.ErrorResponseException exception) {
      if ("NoSuchKey".equals(exception.errorResponse().code())) throw new StoredObjectMissingException(exception);
      throw new IllegalStateException("附件存储暂不可用，请联系管理员检查存储连接与授权", exception);
    } catch (Exception exception) {
      throw new IllegalStateException("附件存储暂不可用，请联系管理员检查存储连接与授权", exception);
    }
  }
}
