package com.procurement.attachment.application;

import java.util.Set;

/** Each business module owns the authorization of its attachment records. */
public interface AttachmentOwnerAccess {
  Set<String> ownerTypes();
  void requireAccess(String ownerId, boolean write);
  default void validateUpload(String ownerId,String fileName,byte[] data) {}
  default void requireDownloadAccess(String ownerId) { requireAccess(ownerId, false); }
}
