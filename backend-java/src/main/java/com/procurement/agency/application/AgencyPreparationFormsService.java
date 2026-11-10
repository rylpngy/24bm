package com.procurement.agency.application;

import com.procurement.agency.domain.AgencyConflictException;
import com.procurement.agency.domain.AgencyExecutionRecords.*;
import com.procurement.agency.domain.AgencyRecords.*;
import com.procurement.common.tenant.PermissionDeniedException;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AgencyPreparationFormsService {
  private static final ZoneId ZONE = ZoneId.of("Asia/Shanghai");
  private final AgencyExecutionSupport s;
  private final AgencyPreparationFormComposer composer;

  public AgencyPreparationFormsService(
      AgencyExecutionSupport s, AgencyPreparationFormComposer composer) {
    this.s = s;
    this.composer = composer;
  }

  private PackageRow access(String pkg, boolean write) {
    s.guard.permissions().require("buyer:agency:preparation:confidential");
    return write
        ? s.write(pkg, "buyer:agency:preparation:manage")
        : s.read(pkg, "buyer:agency:preparation:read");
  }

  private boolean fileVisible(String id, String pkg) {
    try {
      s.sourceVersion(id, pkg);
      return true;
    } catch (PermissionDeniedException denied) {
      return false;
    }
  }

  public PreparationForms workspace(String pkg) {
    var p = access(pkg, false);
    var prep = s.data.preparation(s.guard.tenant(), pkg);
    var forms =
        s.data.preparationForms(s.guard.tenant(), pkg).stream()
            .filter(f -> fileVisible(f.fileVersionId(), pkg))
            .map(this::view)
            .toList();
    var formIds =
        forms.stream().map(f -> f.form().id()).collect(java.util.stream.Collectors.toSet());
    var returns =
        s.data.preparationReturns(s.guard.tenant(), pkg).stream()
            .filter(r -> formIds.contains(r.formId()) && fileVisible(r.fileVersionId(), pkg))
            .toList();
    return new PreparationForms(
        s.data.preparationPeople(s.guard.tenant(), pkg),
        forms,
        returns,
        p.version(),
        prep == null ? 0 : prep.version());
  }

  @Transactional
  public PreparationPerson person(String pkg, String id, PreparationPersonDraft d) {
    access(pkg, true);
    if (d == null) throw new IllegalArgumentException("缺少人员记录");
    s.text(d.name(), 100, true, "姓名");
    s.text(d.organization(), 300, false, "单位");
    s.text(d.reason(), 1000, true, "人员维护原因");
    if (d.role() == null
        || !AgencyPreparationFormComposer.ROLES.containsKey(d.role())
        || d.status() == null
        || !Set.of("active", "removed").contains(d.status()))
      throw new IllegalArgumentException("准备职责或人员状态不合法");
    var normalized =
        new PreparationPersonDraft(
            d.expectedVersion(),
            d.name().strip(),
            s.str(d.organization()),
            d.role(),
            d.status(),
            d.reason().strip());
    PreparationPerson old = null;
    if (id == null) {
      if (s.data.preparationPeople(s.guard.tenant(), pkg).stream()
              .filter(v -> v.status().equals("active"))
              .count()
          >= 100) throw new IllegalStateException("每包最多100名有效准备人员");
      id = "agency-person-" + UUID.randomUUID();
      s.data.preparationPersonCreate(s.guard.tenant(), pkg, id, normalized, s.guard.actor());
    } else {
      old = s.data.preparationPerson(s.guard.tenant(), id);
      if (old == null || !pkg.equals(old.packageId()))
        throw new IllegalArgumentException("准备人员不存在");
      s.expected(old.version(), d.expectedVersion());
      if (old.status().equals("removed")
          && d.status().equals("active")
          && s.data.preparationPeople(s.guard.tenant(), pkg).stream()
                  .filter(v -> v.status().equals("active"))
                  .count()
              >= 100) throw new IllegalStateException("每包最多100名有效准备人员");
      if (s.data.preparationPersonUpdate(s.guard.tenant(), id, old.version(), normalized) != 1)
        throw new AgencyConflictException("人员版本冲突");
    }
    var result = s.data.preparationPerson(s.guard.tenant(), id);
    s.event(pkg, "preparation_person", id, old, result, d.reason());
    return result;
  }

  private List<PreparationPerson> people(String raw) {
    return Arrays.asList(s.json.read(raw, PreparationPerson[].class));
  }

  private Map<String, Object> basis(String pkg, List<String> ids) {
    var p = s.packages.find(s.guard.tenant(), pkg);
    var draft = s.json.read(p.dataJson(), Draft.class);
    var prep = s.data.preparation(s.guard.tenant(), pkg);
    Map<String, String> fields = new TreeMap<>();
    fields.put("projectTitle", p.title());
    fields.put("projectNumber", s.str(p.number()));
    fields.put("procurementMethod", s.str(p.procurementMethod()));
    fields.put("purchaserName", draft.purchaser().getOrDefault("name", ""));
    fields.put("venue", prep == null ? "" : prep.venue());
    fields.put(
        "scheduledAt",
        prep == null || prep.scheduledAt() == null
            ? ""
            : prep.scheduledAt()
                .atZoneSameInstant(ZONE)
                .format(DateTimeFormatter.ofPattern("yyyy年M月d日 HH:mm")));
    List<PreparationPerson> roster = new ArrayList<>();
    for (String id : ids) {
      var person = s.data.preparationPerson(s.guard.tenant(), id);
      if (person == null || !pkg.equals(person.packageId()))
        throw new IllegalArgumentException("人员不属于当前采购包");
      roster.add(person);
    }
    return Map.of("fields", fields, "people", roster, "layoutVersion", "PREPARATION-FORMS-1");
  }

  private boolean stale(PreparationForm f) {
    var ids = people(f.peopleJson()).stream().map(PreparationPerson::id).toList();
    return !f.basisHash().equals(s.json.hash(basis(f.packageId(), ids)))
        || f.ordinal() != s.data.preparationFormOrdinal(s.guard.tenant(), f.groupId());
  }

  private PreparationFormView view(PreparationForm f) {
    return new PreparationFormView(
        f,
        people(f.peopleJson()),
        stale(f),
        s.data.preparationSignedPeople(s.guard.tenant(), f.id()));
  }

  private PreparationForm requireForm(String pkg, String id, boolean write) {
    access(pkg, write);
    var f = s.data.preparationForm(s.guard.tenant(), id);
    if (f == null || !pkg.equals(f.packageId())) throw new IllegalArgumentException("表单不存在");
    s.sourceVersion(f.fileVersionId(), pkg);
    return f;
  }

  @Transactional
  public PreparationFormView generate(String pkg, PreparationFormDraft d) {
    var p = access(pkg, true);
    s.guard.permissions().require("buyer:agency:file:manage");
    s.guard.permissions().require("buyer:agency:file:read");
    if (d == null || !d.contentReviewed()) throw new IllegalArgumentException("须人工核对表单内容和人员信息后生成");
    s.text(d.title(), 120, true, "表单标题");
    s.text(d.body(), 8000, false, "适用正文");
    if (d.kind() == null || !AgencyPreparationFormComposer.KINDS.containsKey(d.kind()))
      throw new IllegalArgumentException("表单类型不合法");
    if (d.peopleIds() == null
        || d.peopleIds().isEmpty()
        || d.peopleIds().size() > 30
        || new HashSet<>(d.peopleIds()).size() != d.peopleIds().size()
        || d.peopleIds().stream().anyMatch(Objects::isNull))
      throw new IllegalArgumentException("每张表单须选择1至30名不同人员");
    if (!d.kind().equals("attendance")) {
      if (d.peopleIds().size() != 1) throw new IllegalArgumentException("个人声明或承诺表须选择一名人员");
      s.text(d.body(), 8000, true, "经复核的适用正文");
    }
    String fp = s.begin(d.idempotencyKey(), Arrays.asList("preparation-form", pkg, d));
    String prior = s.remembered(d.idempotencyKey());
    if (prior != null) return s.json.read(prior, PreparationFormView.class);
    s.expected(p.version(), d.expectedPackageVersion());
    var prep = s.data.preparation(s.guard.tenant(), pkg);
    s.expected(prep == null ? 0 : prep.version(), d.expectedPreparationVersion());
    var basis = basis(pkg, d.peopleIds());
    var roster =
        d.peopleIds().stream().map(id -> s.data.preparationPerson(s.guard.tenant(), id)).toList();
    for (var person : roster) {
      if (!"active".equals(person.status())) throw new IllegalArgumentException("生成表单只能选择当前有效人员");
      s.expected(
          person.version(),
          d.peopleVersions() == null ? null : d.peopleVersions().get(person.id()));
    }
    String id = "agency-pform-" + UUID.randomUUID(), group = id;
    int ordinal = 1;
    if (d.newVersionOf() != null && !d.newVersionOf().isBlank()) {
      var old = requireForm(pkg, d.newVersionOf(), false);
      if (!old.kind().equals(d.kind())) throw new IllegalArgumentException("新版本不能改变表单类型");
      if (old.ordinal() != s.data.preparationFormOrdinal(s.guard.tenant(), old.groupId()))
        throw new AgencyConflictException("请选择当前最新表单版本生成下一版");
      group = old.groupId();
      ordinal = old.ordinal() + 1;
    }
    String code =
        "PF"
            + LocalDate.now(ZONE).format(DateTimeFormatter.BASIC_ISO_DATE)
            + "-"
            + UUID.randomUUID()
                .toString()
                .replace("-", "")
                .substring(0, 12)
                .toUpperCase(Locale.ROOT);
    @SuppressWarnings("unchecked")
    var fields = (Map<String, String>) basis.get("fields");
    byte[] bytes = composer.compose(d.title(), code, d.kind(), roster, fields, s.str(d.body()));
    var file =
        s.restrictedFormArtifact(
            pkg, AgencyPreparationFormComposer.KINDS.get(d.kind()) + "-" + code + ".docx", bytes);
    var form =
        new PreparationForm(
            id,
            s.guard.tenant(),
            pkg,
            group,
            ordinal,
            d.kind(),
            code,
            d.title(),
            s.json.write(roster),
            s.json.write(basis),
            s.json.hash(basis),
            s.str(d.body()),
            file.id(),
            file.hash(),
            "generated",
            1,
            d.newVersionOf() == null || d.newVersionOf().isBlank() ? null : d.newVersionOf(),
            s.guard.actor(),
            null,
            null);
    s.data.preparationFormCreate(form);
    var result = view(s.data.preparationForm(s.guard.tenant(), id));
    s.event(
        pkg,
        "preparation_form_created",
        id,
        null,
        Map.of("formId", id, "ordinal", ordinal, "fileVersionId", file.id(), "hash", file.hash()),
        "生成未签署表单，未自动登记到场或签署");
    s.remember(d.idempotencyKey(), fp, result);
    return result;
  }

  @Transactional
  public PreparationForm voidForm(String pkg, String id, Long expected, String reason) {
    var f = requireForm(pkg, id, true);
    s.expected(f.version(), expected);
    s.text(reason, 1000, true, "作废原因");
    if (s.data.voidPreparationForm(s.guard.tenant(), id, f.version(), reason) != 1)
      throw new IllegalStateException("仅生成状态的表单可以作废");
    s.event(
        pkg,
        "preparation_form_voided",
        id,
        null,
        Map.of("id", id, "reason", reason),
        "作废表单，历史文件与回传件保留");
    return s.data.preparationForm(s.guard.tenant(), id);
  }

  @Transactional
  public PreparationReturn recordReturn(String pkg, String formId, PreparationReturnDraft d) {
    var f = requireForm(pkg, formId, true);
    if (d == null || !d.manuallyConfirmed())
      throw new IllegalArgumentException("须人工核对签署件、人员和原表单关联");
    s.text(d.note(), 2000, true, "签署件核对说明");
    s.text(d.staleReason(), 2000, false, "旧版本适用性说明");
    s.sourceVersion(d.fileVersionId(), pkg);
    String fp = s.begin(d.idempotencyKey(), Arrays.asList("preparation-return", pkg, formId, d));
    var prior = s.remembered(d.idempotencyKey());
    if (prior != null) return s.json.read(prior, PreparationReturn.class);
    if (!f.status().equals("generated")) throw new IllegalStateException("已作废表单不能登记新回传件");
    if (d.signedOn() == null
        || d.signedOn().isAfter(LocalDate.now(ZONE))
        || d.signedOn().isBefore(f.createdAt().atZoneSameInstant(ZONE).toLocalDate()))
      throw new IllegalArgumentException("签署日期须为表单生成之日起至今天之间的已发生日期");
    var allowed =
        people(f.peopleJson()).stream()
            .map(PreparationPerson::id)
            .collect(java.util.stream.Collectors.toSet());
    if (d.peopleIds() == null
        || d.peopleIds().isEmpty()
        || d.peopleIds().size() > 30
        || new HashSet<>(d.peopleIds()).size() != d.peopleIds().size()
        || !allowed.containsAll(d.peopleIds()))
      throw new IllegalArgumentException("仅可选择原表单快照中实际已签署的人员");
    if (stale(f)) s.text(d.staleReason(), 2000, true, "原表单信息已变化或已有新版本，须填写旧表适用性说明");
    var existing = s.data.preparationSignedPeople(s.guard.tenant(), formId);
    if (d.peopleIds().stream().anyMatch(existing::contains))
      throw new IllegalStateException("所选人员已有当前回传记录，请先说明原因作废旧记录，再登记新件");
    var source = s.source(d.fileVersionId(), pkg);
    var file = s.packages.file(s.guard.tenant(), source.version().fileId());
    if (!file.category().equals("preparation_signed") || !file.visibility().equals("restricted"))
      throw new IllegalArgumentException("签署件须从人员签署件类别的受限封存版本选择");
    String name = source.name().toLowerCase(Locale.ROOT);
    if (!name.endsWith(".pdf")
        && !name.endsWith(".docx")
        && !name.endsWith(".png")
        && !name.endsWith(".jpg")
        && !name.endsWith(".jpeg")) throw new IllegalArgumentException("签署件仅支持PDF、DOCX、PNG或JPEG");
    String id = "agency-preturn-" + UUID.randomUUID();
    var r =
        new PreparationReturn(
            id,
            s.guard.tenant(),
            pkg,
            formId,
            s.json.write(d.peopleIds()),
            source.version().id(),
            source.hash(),
            d.signedOn(),
            d.note(),
            s.str(d.staleReason()),
            "recorded",
            1,
            s.guard.actor(),
            null,
            null);
    s.data.preparationReturnCreate(r);
    for (String person : d.peopleIds())
      s.data.preparationReturnPerson(s.guard.tenant(), formId, person, id);
    var result = s.data.preparationReturn(s.guard.tenant(), id);
    s.event(
        pkg,
        "preparation_return_recorded",
        id,
        null,
        Map.of(
            "id",
            id,
            "formId",
            formId,
            "fileVersionId",
            source.version().id(),
            "hash",
            source.hash(),
            "count",
            d.peopleIds().size()),
        "人工核对后记录签署件，不代表电子签名验证或评审授权");
    s.remember(d.idempotencyKey(), fp, result);
    return result;
  }

  @Transactional
  public PreparationReturn voidReturn(String pkg, String id, Long expected, String reason) {
    access(pkg, true);
    var r = s.data.preparationReturn(s.guard.tenant(), id);
    if (r == null || !pkg.equals(r.packageId())) throw new IllegalArgumentException("回传记录不存在");
    s.sourceVersion(r.fileVersionId(), pkg);
    s.expected(r.version(), expected);
    s.text(reason, 1000, true, "回传作废原因");
    if (s.data.voidPreparationReturn(s.guard.tenant(), id, r.version(), reason) != 1)
      throw new IllegalStateException("该回传记录已作废");
    s.data.clearPreparationReturnPeople(s.guard.tenant(), id);
    s.event(
        pkg,
        "preparation_return_voided",
        id,
        null,
        Map.of("id", id, "reason", reason),
        "作废关联记录，原签署文件保留");
    return s.data.preparationReturn(s.guard.tenant(), id);
  }

  public Map<String, String> artifact(String pkg, String id, boolean signature) {
    access(pkg, false);
    s.guard.permissions().require("buyer:agency:file:download");
    String fv;
    if (signature) {
      var r = s.data.preparationReturn(s.guard.tenant(), id);
      if (r == null || !pkg.equals(r.packageId())) throw new IllegalArgumentException("回传记录不存在");
      fv = r.fileVersionId();
    } else fv = requireForm(pkg, id, false).fileVersionId();
    var source = s.source(fv, pkg);
    return Map.of("attachmentId", source.version().attachmentId(), "name", source.name());
  }
}
