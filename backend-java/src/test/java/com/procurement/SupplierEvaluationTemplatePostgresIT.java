package com.procurement;

import static org.assertj.core.api.Assertions.*;
import com.procurement.common.tenant.TenantContext;
import com.procurement.common.tenant.PermissionDeniedException;
import com.procurement.supplier.api.*;
import com.procurement.supplier.api.PerformanceTaskRequests.*;
import com.procurement.supplier.api.SupplierEvaluationTemplateRequests.Definition;
import com.procurement.supplier.application.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@SpringBootTest
@Testcontainers
@org.springframework.test.annotation.DirtiesContext
class SupplierEvaluationTemplatePostgresIT {
  @Container static final PostgreSQLContainer<?> DB = new PostgreSQLContainer<>("postgres:16-alpine");
  @DynamicPropertySource static void properties(DynamicPropertyRegistry r) {
    r.add("spring.datasource.url", DB::getJdbcUrl);
    r.add("spring.datasource.username", DB::getUsername);
    r.add("spring.datasource.password", DB::getPassword);
    r.add("keycloak.enabled", () -> false);
    r.add("app.seed.locations", () -> "");
  }
  @Autowired JdbcTemplate jdbc;
  @Autowired SupplierEvaluationTemplateService templates;
  @Autowired SupplierEvaluationApplicationService evaluations;
  @Autowired PerformanceTaskApplicationService tasks;
  @Autowired org.springframework.transaction.PlatformTransactionManager transactions;
  @org.springframework.boot.test.mock.mockito.MockBean com.procurement.common.storage.ObjectStorageService storage;
  String a, b, supplier, user, other, reader, relation, otherRelation;

  @BeforeEach void seed() {
    String suffix = UUID.randomUUID().toString();
    a = "eta-" + suffix; b = "etb-" + suffix; supplier = "ets-" + suffix;
    user = "etu-" + suffix; other = "etbu-" + suffix; reader = "etr-" + suffix;
    relation = "etra-" + suffix; otherRelation = "etrb-" + suffix;
    jdbc.update("insert into tenants(id,name,plan,status) values (?,'Buyer A','starter','active'),(?,'Buyer B','starter','active')", a,b);
    jdbc.update("insert into enterprises(id,name,type) values (?,'Supplier','supplier')",supplier);
    jdbc.update("insert into buyer_supplier_relations(id,tenant_id,supplier_id,status,level) values (?,?,?,'admitted','B'),(?,?,?,'admitted','B')",
        relation,a,supplier,otherRelation,b,supplier);
    jdbc.update("insert into users(id,tenant_id,name,status) values (?,?,'Assignee','active'),(?,?,'Other','active'),(?,?,'Reader','active')",
        user,a,other,b,reader,a);
    for (String tenant : List.of(a,b)) {
      String role = "role-" + tenant;
      jdbc.update("insert into roles(id,tenant_id,scope,name,permissions) values (?,?,'buyer','Manager','[\"buyer:supplier:read\",\"buyer:supplier:manage\"]')",role,tenant);
      jdbc.update("insert into user_roles(user_id,role_id) values (?,?)",tenant.equals(a) ? user : other,role);
    }
    jdbc.update("insert into roles(id,tenant_id,scope,name,permissions) values (?,?,'buyer','Reader','[\"buyer:supplier:read\"]')","read-" + a,a);
    jdbc.update("insert into user_roles(user_id,role_id) values (?,?)",reader,"read-" + a);
    buyer();
  }
  @AfterEach void clear() { TenantContext.clear(); }
  void buyer() { TenantContext.set(a,null,user); }
  Definition definition(String name, int q, int d, int p, int s) {
    return new Definition(name,bd(q),bd(d),bd(p),bd(s));
  }
  static BigDecimal bd(int value) { return BigDecimal.valueOf(value); }
  CreateSupplierEvaluationRequest scores(String period, String versionId) {
    return new CreateSupplierEvaluationRequest(period,bd(80),bd(90),bd(70),bd(60),"Assessed",versionId);
  }
  Evaluate taskScores() { return new Evaluate(bd(80),bd(90),bd(70),bd(60),"Assessed"); }

  @Test void concurrentNewVersionsAreSequentialAndNeverOverwritePriorVersions() throws Exception {
    var first = templates.create(definition("Original",35,30,20,15));
    try (var pool = Executors.newFixedThreadPool(2)) {
      var start = new CountDownLatch(1);
      Callable<SupplierEvaluationTemplateResponse> append = () -> {
        buyer();
        try { start.await(); return templates.version(first.templateId(),definition("New",100,0,0,0)); }
        finally { TenantContext.clear(); }
      };
      var one = pool.submit(append); var two = pool.submit(append);
      start.countDown();
      assertThat(List.of(one.get(30,TimeUnit.SECONDS).version(),two.get(30,TimeUnit.SECONDS).version()))
          .containsExactlyInAnyOrder(2,3);
    }
    var versions = templates.list();
    assertThat(versions).hasSize(3);
    assertThat(versions.stream().filter(v -> v.id().equals(first.id())).findFirst().orElseThrow()).isEqualTo(first);
    assertThatThrownBy(() -> jdbc.update("update supplier_evaluation_template_versions set quality_weight=0,delivery_weight=100,price_weight=0,service_weight=0 where id=?",first.id()))
        .isInstanceOf(org.springframework.dao.DataAccessException.class);
  }

  @Test void tenantIsolationAndReadOnlyPermissionsCoverEveryTemplateOperation() {
    var first = templates.create(definition("A",35,30,20,15));
    TenantContext.set(b,null,other);
    assertThat(templates.list()).isEmpty();
    assertThatThrownBy(() -> templates.version(first.templateId(),definition("Foreign",100,0,0,0)))
        .isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> templates.enabled(first.templateId(),false)).isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> evaluations.createEvaluation(otherRelation,scores("2040",first.id())))
        .isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> tasks.create(otherRelation,new Create("2041",other,LocalDate.now().plusDays(10),first.id())))
        .isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> jdbc.update("insert into supplier_performance_tasks(id,tenant_id,supplier_id,relation_id,period,assignee_id,assignee_name,due_date,status,template_version_id) values (?,?,?,?,'2042',?,'Other',current_date,'assigned',?)",
        "foreign-task-" + a,b,supplier,otherRelation,other,first.id())).isInstanceOf(org.springframework.dao.DataAccessException.class);
    TenantContext.set(a,null,reader);
    assertThat(templates.list()).hasSize(1);
    assertThatThrownBy(() -> templates.create(definition("Reader",100,0,0,0))).isInstanceOf(PermissionDeniedException.class);
    assertThatThrownBy(() -> templates.version(first.templateId(),definition("Reader",100,0,0,0))).isInstanceOf(PermissionDeniedException.class);
    assertThatThrownBy(() -> templates.enabled(first.templateId(),false)).isInstanceOf(PermissionDeniedException.class);
  }

  @Test void taskLocksVersionAndCanBeCompletedAfterGroupDisableAndNewVersion() {
    var first = templates.create(definition("Quality",100,0,0,0));
    var task = tasks.create(relation,new Create("2043",user,LocalDate.now().plusDays(10),first.id()));
    assertThat(task.scoring()).isEqualTo(first.scoring());
    var next = templates.version(first.templateId(),definition("Delivery",0,100,0,0));
    templates.enabled(first.templateId(),false);
    assertThat(templates.list()).allMatch(v -> !v.enabled());
    assertThatThrownBy(() -> tasks.create(relation,new Create("2044",user,LocalDate.now().plusDays(10),next.id())))
        .isInstanceOf(IllegalStateException.class);
    assertThatThrownBy(() -> evaluations.createEvaluation(relation,scores("2044",first.id())))
        .isInstanceOf(IllegalStateException.class);
    assertThatThrownBy(() -> jdbc.update("update supplier_performance_tasks set template_version_id=? where id=?",next.id(),task.id()))
        .isInstanceOf(org.springframework.dao.DataAccessException.class);
    var completed = tasks.evaluate(relation,task.id(),taskScores());
    assertThat(completed.totalScore()).isEqualByComparingTo("80");
    assertThat(completed.scoring()).isEqualTo(first.scoring());
    var history = evaluations.listEvaluations(relation);
    assertThat(history).singleElement().satisfies(e -> {
      assertThat(e.scoring()).isEqualTo(first.scoring());
      assertThat(e.totalScore()).isEqualByComparingTo("80");
    });
    templates.enabled(first.templateId(),true);
    assertThat(templates.list()).allMatch(SupplierEvaluationTemplateResponse::enabled);
    assertThat(evaluations.createEvaluation(relation,scores("2044",next.id())).totalScore()).isEqualByComparingTo("90");
  }

  @Test void snapshotsAndHistoricalTotalsNeverRecalculateAndOmittedVersionStaysLegacy() {
    // Old totals are authoritative even when they differ from today's scoring formula.
    String old = "old-" + a;
    jdbc.update("insert into supplier_evaluations(id,tenant_id,supplier_id,period,quality_score,delivery_score,price_score,service_score,total_score,suggested_tier) values (?,?,?,'2039',80,90,70,60,12.34,'合格')",old,a,supplier);
    var first = templates.create(definition("Original name",100,0,0,0));
    var evaluation = evaluations.createEvaluation(relation,scores("2045",first.id()));
    templates.version(first.templateId(),definition("Changed name",0,100,0,0));
    templates.enabled(first.templateId(),false);
    assertThat(evaluations.createEvaluation(relation,scores("2046",null)).totalScore()).isEqualByComparingTo("78");
    var legacyTask = tasks.create(relation,new Create("2047",user,LocalDate.now().plusDays(10)));
    assertThat(legacyTask.scoring()).isEqualTo(SupplierEvaluationScoring.legacy());
    assertThat(tasks.evaluate(relation,legacyTask.id(),taskScores()).totalScore()).isEqualByComparingTo("78");
    var rows = evaluations.listEvaluations(relation);
    var original = rows.stream().filter(e -> e.id().equals(evaluation.id())).findFirst().orElseThrow();
    assertThat(original.scoring()).isEqualTo(first.scoring());
    assertThat(original.totalScore()).isEqualByComparingTo("80");
    var historical = rows.stream().filter(e -> e.id().equals(old)).findFirst().orElseThrow();
    assertThat(historical.scoring()).isEqualTo(SupplierEvaluationScoring.legacy());
    assertThat(historical.totalScore()).isEqualByComparingTo("12.34");
    assertThatThrownBy(() -> jdbc.update("update supplier_evaluations set total_score=99 where id=?",old))
        .isInstanceOf(org.springframework.dao.DataAccessException.class);
    assertThatThrownBy(() -> jdbc.update("update supplier_evaluations set scoring_snapshot='{}'::jsonb where id=?",evaluation.id()))
        .isInstanceOf(org.springframework.dao.DataAccessException.class);
  }

  @Test void templateConfigurationAuditPreservesActualActorsAndVersionDetails() {
    var first = templates.create(definition("Audited original",35,30,20,15));
    String manager = "version-" + user;
    jdbc.update("insert into users(id,tenant_id,name,status) values (?,?,'Version author','active')",manager,a);
    jdbc.update("insert into user_roles(user_id,role_id) values (?,?)",manager,"role-" + a);
    TenantContext.set(a,null,manager);
    var second = templates.version(first.templateId(),definition("Audited revision",100,0,0,0));
    templates.enabled(first.templateId(),false);
    buyer();
    templates.enabled(first.templateId(),true);
    for (String action : List.of("created","version_created","disabled","enabled")) {
      String expectedActor = action.equals("version_created") || action.equals("disabled") ? manager : user;
      assertThat(jdbc.queryForList("select actor_id from audit_logs where tenant_id=? and target_type='supplier_evaluation_template' and target_id=? and action=?",
          String.class,a,first.templateId(),"supplier_evaluation_template." + action)).containsExactly(expectedActor);
    }
    String detail = jdbc.queryForObject("select detail from audit_logs where tenant_id=? and target_id=? and action='supplier_evaluation_template.version_created'",
        String.class,a,first.templateId());
    assertThat(detail).contains(second.id(),"Audited revision","qualityWeight","100");
    assertThat(jdbc.queryForObject("select count(*) from audit_logs where tenant_id=? and target_id=?",Integer.class,b,first.templateId())).isZero();
  }

  @Test void rolledBackConfigurationCannotLeaveAuditOrVersionsBehind() {
    String id = new org.springframework.transaction.support.TransactionTemplate(transactions).execute(status -> {
      var first = templates.create(definition("Rollback",35,30,20,15));
      templates.version(first.templateId(),definition("Rollback revision",100,0,0,0));
      templates.enabled(first.templateId(),false);
      assertThat(jdbc.queryForObject("select count(*) from audit_logs where tenant_id=? and target_id=?",Integer.class,a,first.templateId())).isEqualTo(3);
      status.setRollbackOnly();
      return first.templateId();
    });
    assertThat(jdbc.queryForObject("select count(*) from supplier_evaluation_templates where id=?",Integer.class,id)).isZero();
    assertThat(jdbc.queryForObject("select count(*) from supplier_evaluation_template_versions where template_id=?",Integer.class,id)).isZero();
    assertThat(jdbc.queryForObject("select count(*) from audit_logs where tenant_id=? and target_id=?",Integer.class,a,id)).isZero();
  }
}
