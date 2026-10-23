package com.procurement.common.storage;

public class StoredObjectMissingException extends IllegalStateException {
  public StoredObjectMissingException(Throwable cause) {
    super("附件文件缺失，请联系管理员核查备份，不要重复登记同一附件", cause);
  }
}
