package com.procurement.agency.application;

import com.procurement.agency.domain.AgencyFinanceRecords.*;
import com.procurement.agency.infrastructure.AgencyFinanceMapper;
import com.procurement.common.tenant.PermissionDeniedException;
import com.procurement.workflow.domain.WorkflowBusinessInstance;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AgencyFinanceProjector {
  final AgencyExecutionSupport s;
  final AgencyFinanceMapper data;

  public AgencyFinanceProjector(AgencyExecutionSupport s, AgencyFinanceMapper data) {
    this.s = s;
    this.data = data;
  }

  record Binding(
      String pkg,
      String id,
      String kind,
      long version,
      String hash,
      String creator,
      Account account,
      Entry entry) {}

  Binding valid(WorkflowBusinessInstance i) {
    var snap = s.json.tree(i.businessSnapshot());
    boolean entry = snap.path("objectKind").asText().equals("entry");
    var e = entry ? data.entry(i.tenantId(), i.businessId()) : null;
    var a =
        entry
            ? (e == null ? null : data.account(i.tenantId(), e.accountId()))
            : data.account(i.tenantId(), i.businessId());
    if (a == null || entry && e == null) throw new IllegalStateException("财务审批对象不存在");
    s.packages.lock(i.tenantId(), a.packageId());
    String status = entry ? e.status() : a.status(),
        wf = entry ? e.workflowId() : a.workflowId(),
        hash = entry ? e.frozenHash() : a.frozenHash(),
        raw = entry ? e.snapshotJson() : a.snapshotJson();
    long version = entry ? e.version() : a.version();
    String amount = (entry ? e.amount() : a.requested()).toPlainString();
    if (!status.equals("reviewing")
        || !i.id().equals(wf)
        || !i.businessId().equals(snap.path("objectId").asText())
        || version != snap.path("version").asLong()
        || !hash.equals(snap.path("snapshotHash").asText())
        || new java.math.BigDecimal(amount)
                .compareTo(new java.math.BigDecimal(snap.path("amount").asText()))
            != 0
        || !s.json.hash(s.json.read(raw, Map.class)).equals(hash))
      throw new IllegalStateException("财务审批冻结范围不一致");
    return new Binding(
        a.packageId(),
        i.businessId(),
        entry ? "entry" : "account",
        version,
        hash,
        entry ? e.createdBy() : a.createdBy(),
        a,
        e);
  }

  @Transactional
  public void validate(WorkflowBusinessInstance i, boolean approved) {
    var b = valid(i);
    s.guard.permissions().require("buyer:agency:finance:approve");
    s.guard.require(b.pkg(), false);
    if (b.creator().equals(s.guard.actor())) throw new PermissionDeniedException("不得自行核定费用或财务调整");
    if (b.account().category().equals("expert"))
      s.guard.permissions().require("buyer:agency:finance:expert");
    if (approved) {
      s.guard.requireApproved(b.pkg());
      String file =
          b.entry() != null
              ? b.entry().evidenceVersionId()
              : s.json
                  .tree(b.account().snapshotJson())
                  .path(b.account().kind().equals("receivable") ? "calculation" : "cost")
                  .path("evidenceVersionId")
                  .asText();
      String expected =
          s.json
              .tree(b.entry() != null ? b.entry().snapshotJson() : b.account().snapshotJson())
              .path("evidenceHash")
              .asText();
      if (!s.source(file, b.pkg()).hash().equals(expected))
        throw new IllegalStateException("财务凭证字节变化");
      if (b.entry() != null) {
        if (!b.account().status().equals("approved")) throw new IllegalStateException("关联账户状态变化");
        var draft =
            s.json.read(
                s.json.tree(b.entry().snapshotJson()).path("entry").toString(), EntryDraft.class);
        AgencyFinancePolicy.validateEntry(b.account(), data.entries(i.tenantId(), b.pkg()), draft);
      } else if (b.account().kind().equals("receivable")) {
        String previous = s.json.tree(b.account().snapshotJson()).path("agreementHash").asText();
        if (!s.json
            .hash(
                s.json.tree(s.packages.find(i.tenantId(), b.pkg()).dataJson()).path("feeAgreement"))
            .equals(previous)) throw new IllegalStateException("立项收费约定已变化，须重新核对计费");
      }
    }
  }

  @Transactional
  public void complete(WorkflowBusinessInstance i, String status, String actor, String note) {
    var snap = s.json.tree(i.businessSnapshot());
    boolean entry = snap.path("objectKind").asText().equals("entry");
    var oldE = entry ? data.entry(i.tenantId(), i.businessId()) : null;
    var oldA = entry ? null : data.account(i.tenantId(), i.businessId());
    if (entry && oldE != null && oldE.status().equals(status) && oldE.workflowId() == null
        || !entry && oldA != null && oldA.status().equals(status) && oldA.workflowId() == null)
      return;
    var b = valid(i);
    if (status.equals("draft")) {
      if (!actor.equals(i.initiatorId())) throw new PermissionDeniedException("仅发起人可撤回");
      if (entry) status = "rejected";
    } else validate(i, status.equals("approved"));
    int count =
        entry
            ? data.entryState(i.tenantId(), b.id(), b.version(), "reviewing", status, null)
            : data.state(
                i.tenantId(),
                b.id(),
                b.version(),
                "reviewing",
                status,
                null,
                status.equals("approved") ? b.account().requested() : null);
    if (count != 1) throw new IllegalStateException("财务审批回写冲突");
    data.reopen(i.tenantId(), b.pkg());
    s.event(
        b.pkg(),
        "finance_review_" + status,
        b.id(),
        null,
        Map.of("hash", b.hash(), "workflowId", i.id()),
        Objects.toString(note, ""));
  }
}
