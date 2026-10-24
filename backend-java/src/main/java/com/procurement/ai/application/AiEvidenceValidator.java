package com.procurement.ai.application;

import com.procurement.common.ai.AiContracts.*;
import com.procurement.common.ai.AiSupport;
import java.util.*;

public final class AiEvidenceValidator {
  private AiEvidenceValidator() {}
  public static void validate(Snapshot snapshot) {
    AiSupport.bounded(snapshot.sourceRevision(),128,"Source revision");
    if(snapshot.evidence().size()>300 || snapshot.findings().size()>100 || snapshot.accessTargets().size()>300)
      throw new IllegalArgumentException("AI case file exceeds supported evidence limits");
    Set<String> evidence=new HashSet<>();
    for(var e:snapshot.evidence()) {
      AiSupport.bounded(e.id(),180,"Evidence ID"); AiSupport.bounded(e.locator(),240,"Evidence locator");
      AiSupport.bounded(e.label(),500,"Evidence label"); AiSupport.bounded(e.sourceId(),180,"Evidence source");
      if(!List.of("FIELD","ATTACHMENT","BUSINESS","POLICY").contains(e.kind()) || !evidence.add(e.id())
          || e.value()==null || e.value().length()>4000) throw new IllegalArgumentException("Invalid or duplicate evidence");
      if("POLICY".equals(e.kind()) && (e.policyVersion()==null || e.sourceHash()==null))
        throw new IllegalArgumentException("Policy evidence requires a version and content hash");
    }
    Set<String> findings=new HashSet<>();
    for(var f:snapshot.findings()) {
      AiSupport.bounded(f.id(),160,"Finding ID"); AiSupport.bounded(f.title(),240,"Finding title");
      AiSupport.bounded(f.detail(),2000,"Finding detail");
      if(!findings.add(f.id()) || !List.of("risk","warning","info").contains(f.severity())
          || f.evidenceIds().isEmpty() || !evidence.containsAll(f.evidenceIds()))
        throw new IllegalArgumentException("Finding has invalid or forged evidence references");
    }
    if(snapshot.limitations().size()>30 || snapshot.limitations().stream().anyMatch(s -> s==null || s.length()>2000))
      throw new IllegalArgumentException("AI limitations exceed supported limits");
  }
}
