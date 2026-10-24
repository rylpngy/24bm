package com.procurement.dictionary.application;

import com.procurement.dictionary.api.DictionaryAdminEntryResponse;
import com.procurement.dictionary.api.DictionaryEntryResponse;
import com.procurement.dictionary.api.DictionaryTypeSummaryResponse;
import com.procurement.dictionary.api.SaveDictionaryEntryRequest;
import com.procurement.dictionary.domain.DictionaryEntry;
import com.procurement.dictionary.domain.DictionaryPolicy;
import com.procurement.dictionary.infrastructure.DictionaryMapper;
import com.procurement.audit.application.AuditLogApplicationService;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.core.JsonProcessingException;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class DictionaryApplicationService {
  private final DictionaryMapper dictionaryMapper;
  private final AuditLogApplicationService audit;
  private final ObjectMapper json;

  public DictionaryApplicationService(DictionaryMapper dictionaryMapper, AuditLogApplicationService audit, ObjectMapper json) {
    this.dictionaryMapper = dictionaryMapper;
    this.audit = audit;
    this.json = json;
  }

  public List<DictionaryEntryResponse> listByType(String type) {
    return dictionaryMapper.listActiveByType(type).stream()
        .map(this::toResponse)
        .toList();
  }

  // ── 平台运营维护(D-4) ───────────────────────────────────
  public List<DictionaryTypeSummaryResponse> listTypeSummaries() {
    return dictionaryMapper.listTypeSummaries().stream()
        .map(s -> new DictionaryTypeSummaryResponse(s.type(), s.entryCount(), s.activeCount(), DictionaryPolicy.extensible(s.type())))
        .toList();
  }

  public List<DictionaryAdminEntryResponse> listAllByType(String type) {
    return dictionaryMapper.listAllByType(type).stream()
        .map(e -> new DictionaryAdminEntryResponse(
            e.type(), e.code(), e.label(), e.sortOrder(), e.status()))
        .toList();
  }

  /** 新增字典条目:type/code 校验并去重,状态默认启用。 */
  @Transactional
  public DictionaryAdminEntryResponse create(SaveDictionaryEntryRequest request) {
    String type = request.type().trim();
    String code = request.code().trim();
    DictionaryPolicy.requireValidKey(type, "字典类型");
    DictionaryPolicy.requireValidKey(code, "条目编码");
    DictionaryPolicy.requireSupportedCode(type, code);
    DictionaryPolicy.requireValidLabel(request.label());
    String status = DictionaryPolicy.normalizeStatus(request.status());
    DictionaryPolicy.requireAbsent(dictionaryMapper.find(type, code), type, code);
    int sortOrder = request.sortOrder() == null ? 0 : request.sortOrder();
    dictionaryMapper.insert(type, code, request.label().trim(), sortOrder, status);
    recordChange("dictionary.created", type, code, null,
        new DictionaryEntry(type, code, request.label().trim(), sortOrder, status));
    return new DictionaryAdminEntryResponse(type, code, request.label().trim(), sortOrder, status);
  }

  /** 维护条目:type/code 为主键不可改,仅名称/排序/状态可更新(引用安全)。 */
  @Transactional
  public DictionaryAdminEntryResponse update(String type, String code, SaveDictionaryEntryRequest request) {
    DictionaryPolicy.requireValidKey(type, "字典类型");
    DictionaryPolicy.requireValidKey(code, "条目编码");
    DictionaryPolicy.requireSupportedCode(type, code);
    if (!type.equals(request.type()) || !code.equals(request.code())) {
      throw new IllegalArgumentException("字典类型与编码不可修改，须与路径一致");
    }
    DictionaryEntry existing = dictionaryMapper.lock(type, code);
    DictionaryPolicy.requirePresent(existing, type, code);
    DictionaryPolicy.requireValidLabel(request.label());
    String status = request.status() == null || request.status().isBlank()
        ? existing.status() : DictionaryPolicy.normalizeStatus(request.status());
    int sortOrder = request.sortOrder() == null ? existing.sortOrder() : request.sortOrder();
    if (dictionaryMapper.update(type, code, request.label().trim(), sortOrder, status) != 1) {
      throw new IllegalStateException("字典已变更，请刷新后重试");
    }
    recordChange("dictionary.updated", type, code, existing,
        new DictionaryEntry(type, code, request.label().trim(), sortOrder, status));
    return new DictionaryAdminEntryResponse(type, code, request.label().trim(), sortOrder, status);
  }

  public List<DictionaryEntryResponse> listWithHistory(String type) {
    return dictionaryMapper.listAllByType(type).stream().map(this::toResponse).toList();
  }

  private void recordChange(String action, String type, String code, DictionaryEntry before, DictionaryEntry after) {
    try {
      var detail = new java.util.LinkedHashMap<String, Object>();
      detail.put("before", before);
      detail.put("after", after);
      audit.recordTenantAction(null, action, "dictionary", type + "/" + code, json.writeValueAsString(detail));
    } catch (JsonProcessingException e) { throw new IllegalStateException("字典审计序列化失败", e); }
  }

  private DictionaryEntryResponse toResponse(DictionaryEntry entry) {
    return new DictionaryEntryResponse(
        entry.type(),
        entry.code(),
        entry.label(),
        entry.sortOrder());
  }
}
