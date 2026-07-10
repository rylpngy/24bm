package com.procurement.common.storage;

/** 对象存储抽象：附件字节的存取(当前由 MinIO 实现)。 */
public interface ObjectStorageService {

  void put(String storageKey, byte[] data, String contentType);

  StoredObject get(String storageKey);

  record StoredObject(byte[] data, String contentType) {
  }
}
