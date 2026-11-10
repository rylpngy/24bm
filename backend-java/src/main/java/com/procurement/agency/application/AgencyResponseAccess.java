package com.procurement.agency.application;

import com.procurement.agency.domain.AgencyEvaluationRecords.*;
import com.procurement.agency.domain.AgencyEvaluationRecords.Member;
import com.procurement.agency.domain.AgencyOpeningRecords.Manifest;
import com.procurement.agency.domain.AgencyRecords.*;
import com.procurement.agency.infrastructure.*;
import com.procurement.common.tenant.PermissionDeniedException;
import java.util.*;
import org.springframework.stereotype.Component;

@Component
public class AgencyResponseAccess {
  private final AgencyOpeningMapper data;
  private final AgencyEvaluationMapper rounds;
  private final AgencyGuard guard;
  private final AgencyJson json;
  private final AgencyEvaluationControls controls;

  public AgencyResponseAccess(
      AgencyOpeningMapper data,
      AgencyEvaluationMapper rounds,
      AgencyGuard guard,
      AgencyJson json,
      AgencyEvaluationControls controls) {
    this.data = data;
    this.rounds = rounds;
    this.guard = guard;
    this.json = json;
    this.controls = controls;
  }

  private Config config(String round) {
    var row = rounds.round(guard.tenant(), round);
    if (row != null
        && row.frozenJson() != null
        && !json.bytesHash(
                json.write(json.read(row.frozenJson(), java.util.Map.class))
                    .getBytes(java.nio.charset.StandardCharsets.UTF_8))
            .equals(row.frozenHash())) return null;
    return row == null || row.frozenJson() == null
        ? null
        : json.read(json.tree(row.frozenJson()).path("config").toString(), Config.class);
  }

  private Member member(String round) {
    var config = config(round);
    return config == null
        ? null
        : config.members().stream()
            .filter(m -> m.userId().equals(guard.actor()))
            .findFirst()
            .orElse(null);
  }

  public boolean custodian(String round) {
    var m = member(round);
    return m != null
        && (m.roles().contains("organizer") || m.roles().contains("leader"))
        && guard.permissions().currentUserHas("buyer:agency:evaluation:receipt:manage")
        && guard.permissions().currentUserHas("buyer:agency:evaluation:confidential");
  }

  public boolean readable(FileRow file) {
    var receipt = data.receiptFile(guard.tenant(), file.id());
    if (receipt == null) return false;
    var m = member(receipt.roundId());
    if (m == null
        || !guard.permissions().currentUserHas("buyer:agency:evaluation:response:read")
        || !guard.permissions().currentUserHas("buyer:agency:evaluation:confidential"))
      return false;
    var opening = data.opening(guard.tenant(), receipt.roundId());
    if (opening == null) return false;
    if (!json.hash(Arrays.asList(json.read(opening.manifestJson(), Manifest[].class)))
        .equals(opening.manifestHash())) return false;
    return Arrays.stream(json.read(opening.manifestJson(), Manifest[].class))
        .anyMatch(
            f ->
                f.fileId().equals(file.id())
                    && f.readerRoles().stream().anyMatch(m.roles()::contains));
  }

  public boolean visible(FileRow file) {
    var r = data.receiptFile(guard.tenant(), file.id());
    return r != null && (custodian(r.roundId()) || readable(file));
  }

  public void write(FileRow file) {
    var r = data.receiptFile(guard.tenant(), file.id());
    if (r == null || !custodian(r.roundId()))
      throw new PermissionDeniedException("仅冻结的有权接收人员可上传响应材料");
    controls.requireWritable(r.roundId());
    var round = rounds.round(guard.tenant(), r.roundId());
    if (round == null || !round.status().equals("frozen"))
      throw new IllegalStateException("评审轮次已作废");
    var p = data.plan(guard.tenant(), r.roundId());
    if (p == null || !p.status().equals("intake") || !r.status().equals("received"))
      throw new IllegalStateException("接收已关闭或登记已撤回");
  }

  public void read(FileRow file, FileVersion version) {
    if (!readable(file)) throw new PermissionDeniedException("响应材料尚未正式开启或不属于当前职责的开放范围");
    var r = data.receiptFile(guard.tenant(), file.id());
    var o = data.opening(guard.tenant(), r.roundId());
    if (Arrays.stream(json.read(o.manifestJson(), Manifest[].class))
        .noneMatch(
            f ->
                f.fileId().equals(file.id())
                    && f.fileVersionId().equals(version.id())
                    && f.hash().equals(version.hash())))
      throw new PermissionDeniedException("文件版本不在正式开启快照中");
  }
}
