package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

// Real PostgreSQL projections, isolated from application seed and historical production data.
@Testcontainers
class ContractFinanceCloseoutPostgresIT {
  @Container static final PostgreSQLContainer<?> DB = new PostgreSQLContainer<>("postgres:16-alpine");

  private void sql(String sql) throws Exception {
    try (Connection c = DriverManager.getConnection(DB.getJdbcUrl(), DB.getUsername(), DB.getPassword());
         var statement = c.createStatement()) { statement.execute(sql); }
  }

  private String reason(String view) throws Exception {
    try (Connection c = DriverManager.getConnection(DB.getJdbcUrl(), DB.getUsername(), DB.getPassword());
         var statement = c.createStatement();
         var rows = statement.executeQuery("select blocking_reason from " + view + " where tenant_id='t'")) {
      assertThat(rows.next()).isTrue();
      return rows.getString(1);
    }
  }

  @BeforeEach void seed() throws Exception {
    sql("""
        drop schema public cascade; create schema public;
        create table purchase_orders(id text,tenant_id text,supplier_id text,amount numeric,status text);
        create table order_line_items(id text,tenant_id text,order_id text,quantity numeric,unit_price numeric,line_amount numeric);
        create table receipts(id text,tenant_id text,order_id text,received_quantity numeric,qualified_quantity numeric,disposition text,received_at timestamptz,disposition_note text);
        create table receipt_line_items(id text,tenant_id text,receipt_id text,order_line_id text,received_quantity numeric,qualified_quantity numeric);
        create table invoices(id text,tenant_id text,order_id text,supplier_id text,amount numeric,payment_status text);
        create table invoice_line_items(id text,tenant_id text,invoice_id text,order_line_id text,quantity numeric,unit_price numeric,line_amount numeric);
        create table variance_handlings(id text,tenant_id text,order_id text,invoice_id text,status text,result text,updated_at timestamptz);
        create table invoice_payment_entries(id text,tenant_id text,invoice_id text,amount numeric,reversal_of text,evidence_no text,idempotency_key text);
        create table contracts(id text,tenant_id text,related_order_id text,supplier_id text,amount numeric,status text);
        create table three_way_matches(id text,tenant_id text,invoice_id text,created_at timestamptz,updated_at timestamptz);
        insert into purchase_orders values ('o','t','s',100,'已收货');
        insert into order_line_items values ('l','t','o',10,10,100);
        insert into receipts values ('r','t','o',10,10,null,now(),null);
        insert into receipt_line_items values ('rl','t','r','l',10,10);
        insert into invoices values ('i','t','o','s',100,'已付款');
        insert into invoice_line_items values ('il','t','i','l',10,10,100);
        insert into invoice_payment_entries values ('p','t','i',100,null,'proof','key');
        insert into contracts values ('c','t','o','s',100,'已生效');
        """);
    sql(Files.readString(Path.of("src/main/resources/db/migration/V220__contract_finance_closeout_guards.sql")));
  }

  @Test void completeVerifiedOrderCanArchive() throws Exception {
    assertThat(reason("contract_closeout_checks")).isNull();
  }
  @Test void multipleReceiptsAreAggregatedPerOrderLine() throws Exception {
    sql("update receipts set received_quantity=4,qualified_quantity=4; update receipt_line_items set received_quantity=4,qualified_quantity=4;"
        + "insert into receipts values ('r2','t','o',6,6,null,now(),null); insert into receipt_line_items values ('rl2','t','r2','l',6,6);");
    assertThat(reason("finance_invoice_closeout_checks")).isNull();
  }
  @Test void shortReceiptCannotPassDespiteReceivedOrderStatus() throws Exception {
    sql("update receipts set received_quantity=4,qualified_quantity=4; update receipt_line_items set received_quantity=4,qualified_quantity=4;");
    assertThat(reason("finance_invoice_closeout_checks")).isNotNull();
  }
  @Test void zeroOrContradictoryHeaderCannotPass() throws Exception {
    sql("update receipts set received_quantity=0,qualified_quantity=0;");
    assertThat(reason("finance_invoice_closeout_checks")).isNotNull();
  }
  @Test void headerOnlyHistoricalReceiptIsUnverified() throws Exception {
    sql("delete from receipt_line_items;");
    assertThat(reason("finance_invoice_closeout_checks")).contains("验收");
  }
  @Test void returnedGoodsNeedSameReceiptLegalReviewNotGenericVarianceResolution() throws Exception {
    sql("update receipts set qualified_quantity=8,disposition='退货换货'; update receipt_line_items set qualified_quantity=8;");
    assertThat(reason("finance_invoice_closeout_checks")).isNotNull();
    assertThat(reason("finance_invoice_closeout_checks")).contains("处置");
    sql("insert into variance_handlings values ('v','t','o','i','已处理','已核实',now());");
    assertThat(reason("finance_invoice_closeout_checks")).contains("处置");
    sql("create table receipt_disposition_reviews(tenant_id text,receipt_id text,decision text,reason text,evidence_no text,reviewed_by text,reviewed_at timestamptz);"
        + "insert into receipt_disposition_reviews values ('t','r','让步接收','依法复核','evidence','reviewer',now());");
    assertThat(reason("finance_invoice_closeout_checks")).isNull();
  }
  @Test void originalConcessionRequiresActualDispositionNote() throws Exception {
    sql("update receipts set qualified_quantity=8,disposition='让步接收'; update receipt_line_items set qualified_quantity=8;");
    assertThat(reason("finance_invoice_closeout_checks")).isNotNull();
    sql("update receipts set disposition_note='经双方核实的让步接收凭据 C-1';");
    assertThat(reason("finance_invoice_closeout_checks")).isNull();
  }
  @Test void duplicateAcceptanceAfterConcessionCannotArchive() throws Exception {
    sql("update receipts set qualified_quantity=8,disposition='让步接收',disposition_note='C-1'; update receipt_line_items set qualified_quantity=8;"
        + "insert into receipts values ('r2','t','o',2,2,null,now(),null); insert into receipt_line_items values ('rl2','t','r2','l',2,2);");
    assertThat(reason("contract_closeout_checks")).isNotNull();
  }
  @Test void unresolvedVarianceBlocksPaymentAndArchive() throws Exception {
    sql("insert into variance_handlings values ('v','t','o','i','处理中','',now());");
    assertThat(reason("finance_invoice_closeout_checks")).contains("差异");
    assertThat(reason("contract_closeout_checks")).isNotNull();
  }
  @Test void smallPaidInvoiceCannotArchiveLargeOrder() throws Exception {
    sql("update invoices set amount=1; update invoice_payment_entries set amount=1;");
    assertThat(reason("contract_closeout_checks")).isNotNull();
  }
  @Test void paidStatusWithoutLedgerIsNotZeroOrPaidEvidence() throws Exception {
    sql("delete from invoice_payment_entries;");
    assertThat(reason("contract_closeout_checks")).isNotNull();
  }
  @Test void reversalIsDeductedFromArchiveBalance() throws Exception {
    sql("insert into invoice_payment_entries values ('reverse','t','i',-100,'p','proof','reverse-key');");
    assertThat(reason("contract_closeout_checks")).isNotNull();
  }
  @Test void foreignTenantEvidenceDoesNotCount() throws Exception {
    sql("update invoice_payment_entries set tenant_id='other';");
    assertThat(reason("contract_closeout_checks")).isNotNull();
  }
  @Test void changedContractAmountCannotArchiveAgainstOldInvoice() throws Exception {
    sql("update contracts set amount=200;");
    assertThat(reason("contract_closeout_checks")).isNotNull();
  }
}
