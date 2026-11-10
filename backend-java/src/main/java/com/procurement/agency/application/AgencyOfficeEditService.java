package com.procurement.agency.application;

import com.fasterxml.jackson.databind.JsonNode;
import com.procurement.agency.domain.AgencyConflictException;
import com.procurement.agency.domain.AgencyExecutionRecords.Revision;
import com.procurement.agency.domain.AgencyOfficeEditRecords.*;
import com.procurement.agency.infrastructure.AgencyOfficeEditMapper;
import com.procurement.common.tenant.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.*;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AgencyOfficeEditService {
  final AgencyExecutionSupport s;
  final AgencyDocumentService documents;
  final AgencyDocumentBasis basis;
  final AgencyOfficeEditMapper data;
  final AgencyOfficeTransport transport;
  final AgencyDirectory directory;

  public AgencyOfficeEditService(
      AgencyExecutionSupport s,
      AgencyDocumentService documents,
      AgencyDocumentBasis basis,
      AgencyOfficeEditMapper data,
      AgencyOfficeTransport transport,
      AgencyDirectory directory) {
    this.s = s;
    this.documents = documents;
    this.basis = basis;
    this.data = data;
    this.transport = transport;
    this.directory = directory;
  }

  String t() {
    return s.guard.tenant();
  }

  String hash(String x) {
    return s.json.bytesHash(x.getBytes(StandardCharsets.UTF_8));
  }

  Session row(String tenant, String id) {
    var r = data.session(tenant, id);
    if (r == null) throw new PermissionDeniedException("在线编辑会话不存在或无权访问");
    return r;
  }

  SessionView view(Session r) {
    String error = r.lastError();
    var d = s.data.document(r.tenantId(), r.documentId());
    if (Set.of("active", "ready").contains(r.state())
        && (!Objects.equals(d.version(), r.baseVersion())
            || !hash(d.basisJson()).equals(r.basisHash())
            || !Objects.equals(d.currentRevisionId(), r.sourceRevisionId())))
      error = "源稿或项目依据已变化，已保存副本保留，不能覆盖新稿";
    return new SessionView(
        r.id(),
        r.state(),
        r.version(),
        r.sourceRevisionId(),
        r.sourceHash(),
        r.baseVersion(),
        r.expiresAt(),
        error,
        r.adoptedRevisionId(),
        r.createdBy(),
        data.saves(r.tenantId(), r.id()));
  }

  void access(String doc, boolean write) {
    documents.require(doc, write);
    s.guard
        .permissions()
        .require(write ? "buyer:agency:office:edit" : "buyer:agency:document:read");
  }

  public Workspace workspace(String doc) {
    access(doc, false);
    return new Workspace(
        transport.configured(),
        transport.configured() ? transport.publicUrl + "/web-apps/apps/api/documents/api.js" : null,
        data.sessions(t(), doc).stream().map(this::view).toList());
  }

  void current(Session r) {
    var d = documents.require(r.documentId(), true);
    s.guard.permissions().require("buyer:agency:office:edit");
    if (directory.people().stream().noneMatch(p -> p.id().equals(s.guard.actor())))
      throw new PermissionDeniedException("编辑账号已停用");
    if (!d.packageId().equals(r.packageId())
        || d.version() != r.baseVersion()
        || !Objects.equals(d.currentRevisionId(), r.sourceRevisionId())
        || !hash(d.basisJson()).equals(r.basisHash())
        || basis.stale(t(), r.packageId(), d.basisJson())
        || d.status().equals("reviewing"))
      throw new AgencyConflictException("Office源版本、公共要素或审核状态已变化，旧回调和采纳不能覆盖新稿");
  }

  void owner(Session r) {
    if (!r.createdBy().equals(s.guard.actor()))
      throw new PermissionDeniedException("仅本会话发起人可编辑、结束或采纳；其他人员可按原权限读取版本");
  }

  @Transactional
  public Open start(String doc, Start d) {
    transport.ready();
    access(doc, true);
    if (d == null || !d.reviewed()) throw new IllegalArgumentException("须先核对当前整稿、版本及Office编辑范围");
    s.text(d.reason(), 2000, true, "编辑依据");
    s.text(d.idempotencyKey(), 100, true, "幂等键");
    String k = "office-start:" + d.idempotencyKey(), h = s.begin(k, Arrays.asList(doc, d));
    var cached = s.remembered(k);
    if (cached != null) return config(row(t(), s.json.tree(cached).path("sessionId").asText()));
    var source = documents.require(doc, true);
    s.expected(source.version(), d.expectedVersion());
    if (source.status().equals("reviewing")
        || basis.stale(t(), source.packageId(), source.basisJson()))
      throw new IllegalStateException("审核中或公共要素过期的稿件不能在线编辑");
    var revision = s.data.revision(t(), d.sourceRevisionId());
    if (revision == null
        || !revision.documentId().equals(doc)
        || !Objects.equals(source.currentRevisionId(), revision.id())
        || !Set.of("candidate", "draft", "approved", "rejected").contains(revision.status()))
      throw new IllegalArgumentException("须选择当前精确且不在审核中的整稿版本");
    var file = s.source(revision.fileVersionId(), source.packageId());
    if (!file.name().toLowerCase(Locale.ROOT).endsWith(".docx")
        || !file.hash().equals(revision.hash()))
      throw new IllegalStateException("Office源DOCX实际字节不一致");
    data.expire(t(), doc);
    var active =
        data.sessions(t(), doc).stream()
            .filter(r -> Set.of("active", "ready").contains(r.state()))
            .findFirst();
    if (active.isPresent()) throw new AgencyConflictException("此稿已有在线编辑或待采纳会话，请先结束或处理保存版本");
    String id = "agency-office-" + UUID.randomUUID(), key = "24bm-" + UUID.randomUUID();
    var r =
        new Session(
            id,
            t(),
            source.packageId(),
            doc,
            revision.id(),
            revision.fileVersionId(),
            revision.hash(),
            source.version(),
            hash(source.basisJson()),
            key,
            hash(transport.ticket(t(), id, key)),
            "active",
            1,
            OffsetDateTime.now().plusHours(2),
            "",
            null,
            s.guard.actor(),
            null);
    data.create(r);
    s.event(
        source.packageId(),
        "office_started",
        id,
        null,
        Map.of("sourceHash", r.sourceHash(), "baseVersion", r.baseVersion()),
        d.reason());
    s.remember(k, h, Map.of("sessionId", id));
    return config(data.session(t(), id));
  }

  Open config(Session r) {
    owner(r);
    if (!r.state().equals("active") || r.expiresAt().isBefore(OffsetDateTime.now()))
      return new Open(view(r), null, Map.of());
    current(r);
    String url =
        transport.bridgeUrl + "/api/v1/buyer/agency/office-bridge/" + r.tenantId() + "/" + r.id();
    Map<String, Object> config = new LinkedHashMap<>();
    config.put("documentType", "word");
    config.put("type", "desktop");
    config.put("width", "100%");
    config.put("height", "100%");
    config.put(
        "document",
        Map.of(
            "fileType",
            "docx",
            "key",
            r.documentKey(),
            "title",
            "采购文件在线编辑.docx",
            "url",
            url + "/source?ticket=" + transport.ticket(r.tenantId(), r.id(), r.documentKey()),
            "permissions",
            Map.of("edit", true, "download", true, "print", true)));
    config.put(
        "editorConfig",
        Map.of(
            "mode",
            "edit",
            "lang",
            "zh-CN",
            "callbackUrl",
            url + "/callback",
            "user",
            Map.of(
                "id",
                r.createdBy(),
                "name",
                directory.people().stream()
                    .filter(p -> p.id().equals(r.createdBy()))
                    .findFirst()
                    .orElseThrow()
                    .name()),
            "customization",
            Map.of("forcesave", true, "plugins", false)));
    config.put("token", transport.sign(config, r.expiresAt()));
    return new Open(view(r), transport.publicUrl + "/web-apps/apps/api/documents/api.js", config);
  }

  @Transactional
  public Open resume(String doc, String id) {
    access(doc, true);
    var r = row(t(), id);
    if (!r.documentId().equals(doc)) throw new PermissionDeniedException("编辑会话不属于本稿");
    return config(r);
  }

  public Map<String, Object> force(String doc, String id) {
    access(doc, true);
    var r = row(t(), id);
    owner(r);
    if (!r.documentId().equals(doc)
        || !r.state().equals("active")
        || r.expiresAt().isBefore(OffsetDateTime.now()))
      throw new IllegalStateException("编辑会话不允许请求保存");
    current(r);
    return transport.force(r.documentKey());
  }

  @Transactional
  public Revision adopt(String doc, String id, Command d) {
    access(doc, true);
    var r = data.lock(t(), id);
    if (r == null || !r.documentId().equals(doc)) throw new PermissionDeniedException("会话不属于本稿");
    owner(r);
    if (d == null || !d.reviewed()) throw new IllegalArgumentException("须人工核对在线稿正文、结构化字段及影响章节");
    s.text(d.reason(), 2000, true, "整稿核对说明");
    s.text(d.idempotencyKey(), 100, true, "幂等键");
    if (r.state().equals("adopted")) {
      var prior = s.data.revision(t(), r.adoptedRevisionId());
      if (data.saves(t(), id).stream()
          .noneMatch(
              v -> v.id().equals(d.saveId()) && v.fileVersionId().equals(prior.fileVersionId())))
        throw new AgencyConflictException("已采纳其他保存版本");
      return prior;
    }
    s.expected(r.version(), d.expectedVersion());
    if (!r.state().equals("ready"))
      throw new IllegalStateException("须先结束在线编辑并等待最终保存回调，不能把请求保存当作已保存");
    current(r);
    var saves = data.saves(t(), id);
    if (saves.isEmpty() || !saves.getFirst().id().equals(d.saveId()))
      throw new AgencyConflictException("须核对最新实际保存版本");
    var result =
        documents.importWhole(
            doc,
            r.baseVersion(),
            saves.getFirst().fileVersionId(),
            true,
            d.reason(),
            d.idempotencyKey());
    if (data.state(t(), id, r.version(), "adopted", "", result.id()) != 1)
      throw new AgencyConflictException("在线会话版本变化");
    s.event(
        r.packageId(),
        "office_adopted",
        id,
        null,
        Map.of("revisionId", result.id(), "hash", result.hash()),
        d.reason());
    return result;
  }

  @Transactional
  public SessionView cancel(String doc, String id, Command d) {
    access(doc, true);
    var r = data.lock(t(), id);
    if (r == null || !r.documentId().equals(doc)) throw new PermissionDeniedException("会话不属于本稿");
    owner(r);
    if (d == null || !d.reviewed()) throw new IllegalArgumentException("须确认保留已保存副本并放弃采纳当前会话");
    s.text(d.reason(), 2000, true, "结束依据");
    s.expected(r.version(), d.expectedVersion());
    if (!Set.of("active", "ready", "expired").contains(r.state()))
      throw new IllegalStateException("会话已结束");
    data.state(t(), id, r.version(), "cancelled", d.reason(), null);
    s.event(
        r.packageId(),
        "office_cancelled",
        id,
        null,
        Map.of("savedCopies", data.saves(t(), id).size()),
        d.reason());
    return view(data.session(t(), id));
  }

  <T> T bound(Session r, java.util.function.Supplier<T> f) {
    String tenant = TenantContext.tenantId(),
        supplier = TenantContext.supplierId(),
        actor = TenantContext.userId();
    TenantContext.set(r.tenantId(), null, r.createdBy());
    try {
      return f.get();
    } finally {
      TenantContext.clear();
      if (tenant != null || supplier != null || actor != null)
        TenantContext.set(tenant, supplier, actor);
    }
  }

  @Transactional
  public byte[] source(String tenant, String id, String ticket) {
    var r = row(tenant, id);
    if (ticket == null
        || !MessageDigest.isEqual(
            hash(ticket).getBytes(StandardCharsets.UTF_8),
            r.sourceTicketHash().getBytes(StandardCharsets.UTF_8))
        || !r.state().equals("active")
        || r.expiresAt().isBefore(OffsetDateTime.now()))
      throw new PermissionDeniedException("Office文件访问票据无效或已过期");
    return bound(
        r,
        () -> {
          current(r);
          var file = s.source(r.sourceFileVersionId(), r.packageId());
          if (!file.hash().equals(r.sourceHash())) throw new IllegalStateException("Office源文件哈希变化");
          return file.bytes();
        });
  }

  @Transactional
  public Map<String, Integer> callback(String tenant, String id, JsonNode body, String auth) {
    String token =
        auth != null && auth.startsWith("Bearer ")
            ? auth.substring(7)
            : body.path("token").asText();
    var signed = transport.verify(token);
    for (String k : List.of("key", "status", "url"))
      if (body.has(k) && !body.path(k).equals(signed.path(k)))
        throw new PermissionDeniedException("Office回调正文与签名不一致");
    var r = row(tenant, id);
    if (!body.path("key").asText().equals(r.documentKey()) || !body.path("status").isInt())
      throw new PermissionDeniedException("Office回调不属于当前会话");
    return bound(r, () -> saveCallback(r, body));
  }

  Map<String, Integer> saveCallback(Session first, JsonNode body) {
    s.packages.lock(t(), first.packageId());
    var r = data.lock(t(), first.id());
    String eventHash =
        s.json.hash(
            Arrays.asList(
                body.path("key").asText(), body.path("status").asInt(), body.path("url").asText()));
    if (data.seen(t(), r.id(), eventHash) > 0) return Map.of("error", 0);
    if (!Set.of("active", "ready").contains(r.state())
        || r.expiresAt().isBefore(OffsetDateTime.now()))
      throw new AgencyConflictException("在线会话已结束或过期，拒绝旧回调");
    current(r);
    int status = body.path("status").asInt();
    if (!Set.of(1, 2, 3, 4, 6, 7).contains(status))
      throw new IllegalArgumentException("Office回调状态未知");
    String next = r.state(), error = "";
    if (status == 2 || status == 6) {
      var bytes = transport.download(body.path("url").asText());
      String hash = s.json.bytesHash(bytes);
      var old = data.saves(t(), r.id());
      if (old.isEmpty() || !old.getFirst().fileHash().equals(hash)) {
        var artifact =
            s.artifact(
                r.packageId(), "在线编辑保存-" + r.id() + "-V" + (old.size() + 1) + ".docx", bytes);
        data.save(
            new Save(
                "agency-office-save-" + UUID.randomUUID(),
                t(),
                r.id(),
                old.size() + 1,
                artifact.id(),
                artifact.hash(),
                eventHash,
                status,
                null));
      }
      if (status == 2) next = "ready";
    } else if (status == 3 || status == 7) error = "文档服务报告保存失败，尚未形成新的已保存版本，请保留客户端内容并重试";
    else if (status == 4) next = data.saves(t(), r.id()).isEmpty() ? "cancelled" : "ready";
    data.event(
        t(),
        "agency-office-event-" + UUID.randomUUID(),
        r.id(),
        eventHash,
        status,
        error.isBlank() ? "已收到签名回调；生成保存副本不等于人工采纳或通过审核" : error);
    if (data.state(t(), r.id(), r.version(), next, error, null) != 1)
      throw new AgencyConflictException("Office回调版本冲突");
    return Map.of("error", 0);
  }
}
