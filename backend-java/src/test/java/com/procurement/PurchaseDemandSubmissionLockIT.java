package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import com.procurement.common.tenant.TenantContext;
import com.procurement.demand.api.UpdatePurchaseDemandRequest;
import com.procurement.demand.api.PurchaseDemandLineItemRequest;
import com.procurement.demand.application.PurchaseDemandApplicationService;
import com.procurement.demand.domain.PurchaseDemandApprovalStatusTransition;
import com.procurement.demand.infrastructure.PurchaseDemandMapper;
import com.procurement.workflow.application.UnifiedWorkflowApplicationService;
import com.procurement.workflow.application.WorkflowStartCommand;
import com.procurement.workflow.application.WorkflowStartResult;
import java.math.BigDecimal;
import java.sql.DriverManager;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.apache.ibatis.session.SqlSessionFactory;
import org.junit.jupiter.api.Test;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/** Real PostgreSQL row contention around the actual demand service and mapper; workflow start is captured. */
@Testcontainers
class PurchaseDemandSubmissionLockIT {
  @Container static final PostgreSQLContainer<?> DB = new PostgreSQLContainer<>("postgres:16-alpine");

  @Test void concurrentSubmitRoutesUsingCommittedCorrectedDepartmentAndAmountNeverThePreLockSnapshot() throws Exception {
    try (var connection = DriverManager.getConnection(DB.getJdbcUrl(), DB.getUsername(), DB.getPassword());
         var statement = connection.createStatement()) {
      statement.execute("""
          create table purchase_demands(id text primary key,tenant_id text,title text,department_id text,
            requester_id text,budget numeric,status text,created_at timestamptz default now(),
            updated_at timestamptz default now(),expected_delivery_date date,priority text,purpose text,source text)
          """);
      statement.execute("insert into purchase_demands(id,tenant_id,title,department_id,requester_id,budget,status) values('d','t','原需求','old','requester',1200,'草稿')");
    }
    var dataSource = new org.apache.ibatis.datasource.unpooled.UnpooledDataSource(
        "org.postgresql.Driver", DB.getJdbcUrl(), DB.getUsername(), DB.getPassword());
    var config = new org.apache.ibatis.session.Configuration(new org.apache.ibatis.mapping.Environment(
        "locking", new org.apache.ibatis.transaction.jdbc.JdbcTransactionFactory(), dataSource));
    config.setMapUnderscoreToCamelCase(true);
    config.addMapper(PurchaseDemandMapper.class);
    SqlSessionFactory factory = new org.apache.ibatis.session.SqlSessionFactoryBuilder().build(config);
    var workflow = mock(UnifiedWorkflowApplicationService.class);
    var started = new AtomicReference<WorkflowStartCommand>();
    when(workflow.start(any())).thenAnswer(call -> {
      started.set(call.getArgument(0));
      return new WorkflowStartResult("wf", "flow", "version", "task", "processing", OffsetDateTime.now());
    });
    var changed = new CountDownLatch(1);
    var release = new CountDownLatch(1);
    var executor = Executors.newFixedThreadPool(2);
    try {
      var writer = executor.submit(() -> {
        TenantContext.set("t", null, "requester");
        try (var session = factory.openSession(false)) {
          service(session.getMapper(PurchaseDemandMapper.class), workflow).update("d", new UpdatePurchaseDemandRequest(
              "修正需求", "new", new BigDecimal("600"),
              List.of(new PurchaseDemandLineItemRequest("material", BigDecimal.ONE)), null, "常规", "修正用途"));
          changed.countDown();
          if (!release.await(15, TimeUnit.SECONDS)) throw new IllegalStateException("Timed out waiting to commit correction");
          session.commit();
        } catch (Exception e) { throw new RuntimeException(e); }
        finally { TenantContext.clear(); }
      });
      assertThat(changed.await(10, TimeUnit.SECONDS)).isTrue();
      var submitter = executor.submit(() -> {
        TenantContext.set("t", null, "requester");
        try (var session = factory.openSession(false)) {
          service(session.getMapper(PurchaseDemandMapper.class), workflow).submit("d");
          session.commit();
        } finally { TenantContext.clear(); }
      });
      org.awaitility.Awaitility.await().atMost(Duration.ofSeconds(10)).untilAsserted(() -> {
        try (var connection = dataSource.getConnection(); var statement = connection.createStatement();
             var rows = statement.executeQuery("select count(*) from pg_stat_activity where datname=current_database() and wait_event_type='Lock' and query ilike '%purchase_demands%'")) {
          rows.next(); assertThat(rows.getInt(1)).isGreaterThan(0);
        }
      });
      release.countDown();
      writer.get(15, TimeUnit.SECONDS);
      submitter.get(15, TimeUnit.SECONDS);
      assertThat(started.get().departmentId()).isEqualTo("new");
      assertThat(started.get().amount()).isEqualByComparingTo("600");
      assertThat((BigDecimal) started.get().businessSnapshot().get("budget")).isEqualByComparingTo("600");
      assertThat(started.get().businessSnapshot().get("title")).isEqualTo("修正需求");
    } finally { release.countDown(); executor.shutdownNow(); }
  }

  private PurchaseDemandApplicationService service(PurchaseDemandMapper mapper, UnifiedWorkflowApplicationService workflow) {
    var departments = mock(com.procurement.organization.infrastructure.DepartmentMapper.class);
    when(departments.existsActiveByTenantAndId(any(), any())).thenReturn(true);
    var service = new PurchaseDemandApplicationService(mapper,
        mock(com.procurement.demand.infrastructure.PurchaseDemandItemMapper.class),
        mock(com.procurement.approval.infrastructure.ApprovalTaskMapper.class),
        mock(com.procurement.approval.application.ApprovalTaskApplicationService.class), TestApprovalGates.alwaysOn(),
        mock(com.procurement.sourcing.application.RfqDemandLinkQueryService.class), departments,
        mock(com.procurement.audit.application.AuditLogApplicationService.class),
        mock(com.procurement.notification.application.NotificationApplicationService.class),
        new PurchaseDemandApprovalStatusTransition(), TestDataScopes.unrestricted(),
        mock(com.procurement.identity.application.PermissionService.class));
    org.springframework.test.util.ReflectionTestUtils.setField(service, "unifiedWorkflowApplicationService", workflow);
    return service;
  }
}
