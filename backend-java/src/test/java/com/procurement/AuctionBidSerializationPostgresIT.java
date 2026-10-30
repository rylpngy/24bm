package com.procurement;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.tenant.TenantContext;
import com.procurement.notification.application.NotificationApplicationService;
import com.procurement.sourcing.api.SubmitQuoteRequest;
import com.procurement.sourcing.api.UpdateQuoteRequest;
import com.procurement.sourcing.application.QuoteApplicationService;
import com.procurement.sourcing.application.RfqItemQueryService;
import com.procurement.sourcing.domain.RfqSourcingStatusTransition;
import com.procurement.sourcing.infrastructure.*;
import java.math.BigDecimal;
import java.time.Duration;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.apache.ibatis.session.SqlSessionFactory;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/** Actual service + MyBatis SQL on PostgreSQL; no substitute in-memory locking. */
@Testcontainers
class AuctionBidSerializationPostgresIT {
  @Container static final PostgreSQLContainer<?> DB = new PostgreSQLContainer<>("postgres:16-alpine");
  private org.apache.ibatis.datasource.unpooled.UnpooledDataSource dataSource;
  private SqlSessionFactory factory;

  @BeforeEach void setup() throws Exception {
    dataSource = new org.apache.ibatis.datasource.unpooled.UnpooledDataSource(
        "org.postgresql.Driver", DB.getJdbcUrl(), DB.getUsername(), DB.getPassword());
    try (var c = dataSource.getConnection(); var s = c.createStatement()) {
      s.execute("drop table if exists quotes, rfq_invites, rfqs");
      s.execute("""
          create table rfqs(id text primary key, tenant_id text, title text, status text,
            deadline_at timestamptz, owner_id text, awarded_supplier_id text,
            created_at timestamptz default now(), updated_at timestamptz default now(),
            quote_requirement text, delivery_requirement text, evaluation_method text,
            opened_at timestamptz, current_round int, final_round boolean, method text,
            close_reason text, auction_start_price numeric(16,2), auction_min_decrement numeric(16,2),
            single_source_reason text, result_announced_at timestamptz, auction_reserve_price numeric(16,2),
            auction_planned_start timestamptz, auction_soft_close_trigger_minutes int,
            auction_soft_close_extend_minutes int, auction_show_rank boolean,
            auction_show_lowest boolean, auction_show_competitor_names boolean)
          """);
      s.execute("""
          create table rfq_invites(tenant_id text, rfq_id text, supplier_id text, invite_status text);
          create table quotes(id text primary key, tenant_id text, rfq_id text, supplier_id text,
            amount numeric(16,2), tax_rate numeric, delivery_days int, status text,
            round int, submitted_at timestamptz default now(), unique(tenant_id,rfq_id,supplier_id,round));
          insert into rfqs(id,tenant_id,title,status,deadline_at,owner_id,current_round,final_round,method,
            auction_start_price,auction_min_decrement,auction_soft_close_trigger_minutes)
            values('r','t','auction','报价中',now()+interval '1 hour','u',2,false,'竞价',100,1,0);
          insert into rfq_invites values('t','r','s1','已邀请'),('t','r','s2','已邀请');
          insert into quotes values('old','t','r','s1',99,1,1,'已提交',1,now());
          """);
    }
    var config = new org.apache.ibatis.session.Configuration(new org.apache.ibatis.mapping.Environment(
        "auction-lock", new org.apache.ibatis.transaction.jdbc.JdbcTransactionFactory(), dataSource));
    config.setMapUnderscoreToCamelCase(true);
    config.setLocalCacheScope(org.apache.ibatis.session.LocalCacheScope.SESSION);
    config.addMapper(RfqMapper.class);
    config.addMapper(QuoteMapper.class);
    factory = new org.apache.ibatis.session.SqlSessionFactoryBuilder().build(config);
  }

  @Test void competingBidWaitsForCommittedLowestAndOldRoundCannotUpdateOrBeAwarded() throws Exception {
    var firstWritten = new CountDownLatch(1);
    var releaseFirst = new CountDownLatch(1);
    var executor = Executors.newFixedThreadPool(2);
    try {
      var first = executor.submit(() -> {
        TenantContext.set(null, "s1", "supplier1");
        try (var session = factory.openSession(false)) {
          service(session.getMapper(RfqMapper.class), session.getMapper(QuoteMapper.class)).submit("r",
              new SubmitQuoteRequest(new BigDecimal("90"), BigDecimal.ONE, 1, null));
          firstWritten.countDown();
          if (!releaseFirst.await(15, TimeUnit.SECONDS)) throw new IllegalStateException("commit wait timeout");
          session.commit();
        } catch (Exception e) { throw new RuntimeException(e); }
        finally { TenantContext.clear(); }
      });
      assertThat(firstWritten.await(10, TimeUnit.SECONDS)).isTrue();
      var second = executor.submit(() -> {
        TenantContext.set(null, "s2", "supplier2");
        try (var session = factory.openSession(false)) {
          assertThatThrownBy(() -> service(session.getMapper(RfqMapper.class), session.getMapper(QuoteMapper.class))
              .submit("r", new SubmitQuoteRequest(new BigDecimal("95"), BigDecimal.ONE, 1, null)))
              .isInstanceOf(IllegalStateException.class).hasMessageContaining("至少再降");
          session.rollback();
        } finally { TenantContext.clear(); }
      });
      org.awaitility.Awaitility.await().atMost(Duration.ofSeconds(10)).untilAsserted(() -> {
        try (var c = dataSource.getConnection(); var s = c.createStatement(); var rows = s.executeQuery(
            "select count(*) from pg_stat_activity where datname=current_database() and wait_event_type='Lock' and query ilike '%rfqs%'")) {
          rows.next(); assertThat(rows.getInt(1)).isGreaterThan(0);
        }
      });
      releaseFirst.countDown();
      first.get(15, TimeUnit.SECONDS);
      second.get(15, TimeUnit.SECONDS);
      try (var session = factory.openSession(false)) {
        var mapper = session.getMapper(QuoteMapper.class);
        assertThat(mapper.listByTenantAndRfqAndRound("t", "r", 2)).hasSize(1);
        assertThat(mapper.findLowestSubmittedAmount("t", "r", 2)).isEqualByComparingTo("90");
        assertThat(mapper.updateSubmittedQuote("t", "old", "s1", new BigDecimal("80"), BigDecimal.ONE, 1, "已提交"))
            .isZero();
        assertThat(mapper.findSubmittedQuoteForAward("t", "r", "old", "已提交")).isNull();
        session.rollback();
      }
    } finally {
      releaseFirst.countDown();
      executor.shutdownNow();
    }
  }

  @ParameterizedTest
  @ValueSource(booleans = {false, true})
  void committedTerminationWinsOverCachedPreLockSnapshotForSubmitAndUpdate(boolean update) throws Exception {
    try (var c = dataSource.getConnection(); var s = c.createStatement()) {
      s.execute("insert into quotes values('current','t','r','s1',90,1,1,'已提交',2,now())");
    }
    var executor = Executors.newSingleThreadExecutor();
    try (var terminating = dataSource.getConnection()) {
      terminating.setAutoCommit(false);
      try (var statement = terminating.createStatement()) {
        assertThat(statement.executeUpdate("update rfqs set status='已废标' where tenant_id='t' and id='r'"))
            .isEqualTo(1);
      }
      var bidder = executor.submit(() -> {
        String supplier = update ? "s1" : "s2";
        TenantContext.set(null, supplier, "supplier-user");
        try (var session = factory.openSession(false)) {
          var rfqs = session.getMapper(RfqMapper.class);
          // The uncommitted termination is invisible; explicitly retain this snapshot in SESSION cache.
          assertThat(rfqs.findBySupplierInvite("r", supplier).status()).isEqualTo("报价中");
          var application = service(rfqs, session.getMapper(QuoteMapper.class));
          assertThatThrownBy(() -> {
            if (update) application.update("current", new UpdateQuoteRequest(new BigDecimal("80"), BigDecimal.ONE, 1, null));
            else application.submit("r", new SubmitQuoteRequest(new BigDecimal("80"), BigDecimal.ONE, 1, null));
          }).isInstanceOf(IllegalStateException.class).hasMessageContaining("not open for quotes");
          session.rollback();
        } finally { TenantContext.clear(); }
      });
      org.awaitility.Awaitility.await().atMost(Duration.ofSeconds(10)).untilAsserted(() -> {
        try (var c = dataSource.getConnection(); var s = c.createStatement(); var rows = s.executeQuery(
            "select count(*) from pg_stat_activity where datname=current_database() and wait_event_type='Lock' and query ilike '%rfqs%'")) {
          rows.next(); assertThat(rows.getInt(1)).isGreaterThan(0);
        }
      });
      terminating.commit();
      bidder.get(15, TimeUnit.SECONDS);
      try (var session = factory.openSession(false)) {
        var mapper = session.getMapper(QuoteMapper.class);
        assertThat(mapper.listByTenantAndRfqAndRound("t", "r", 2)).hasSize(1);
        assertThat(mapper.findByTenantAndId("t", "current").amount()).isEqualByComparingTo("90");
        assertThat(session.getMapper(RfqMapper.class).findByTenantAndId("t", "r").status()).isEqualTo("已废标");
      }
    } finally { executor.shutdownNow(); }
  }

  private QuoteApplicationService service(RfqMapper rfqs, QuoteMapper quotes) {
    var invites = mock(RfqInviteMapper.class);
    when(invites.isSupplierInvited(any(), any(), any())).thenReturn(1);
    return new QuoteApplicationService(rfqs, mock(RfqDemandMapper.class), invites, quotes,
        mock(QuoteLineItemMapper.class), new RfqSourcingStatusTransition(), mock(RfqItemQueryService.class),
        mock(AuditLogApplicationService.class), mock(NotificationApplicationService.class),
        mock(org.springframework.context.ApplicationEventPublisher.class),
        mock(com.procurement.sourcing.application.QuoteVersionService.class));
  }
}
