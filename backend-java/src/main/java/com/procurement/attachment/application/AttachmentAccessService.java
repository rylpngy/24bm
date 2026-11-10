package com.procurement.attachment.application;

import com.procurement.common.tenant.PermissionDeniedException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;

@Service
public class AttachmentAccessService {
  private final Map<String, AttachmentOwnerAccess> owners = new HashMap<>();

  public AttachmentAccessService(List<AttachmentOwnerAccess> policies) {
    for (var policy : policies) {
      for (String type : policy.ownerTypes()) {
        if (owners.putIfAbsent(type, policy) != null) {
          throw new IllegalStateException("Duplicate attachment owner policy: " + type);
        }
      }
    }
  }

  public void validateUpload(String type,String id,String name,byte[] data) {
    var policy=owners.get(type);if(policy==null)throw new PermissionDeniedException("不支持的附件类型");
    policy.validateUpload(id,name,data);
  }
  public void requireDownloadAccess(String type,String id) {
    var policy=owners.get(type);
    if(policy==null||id==null||id.isBlank())throw new PermissionDeniedException("不支持的附件业务类型或业务记录");
    policy.requireDownloadAccess(id);
  }

  public void requireAccess(String type, String id, boolean write) {
    var policy = owners.get(type);
    if (policy == null || id == null || id.isBlank()) {
      throw new PermissionDeniedException("不支持的附件业务类型或业务记录");
    }
    policy.requireAccess(id, write);
  }
}
