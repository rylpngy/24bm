package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;

import java.sql.DriverManager;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.datasource.init.ScriptUtils;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers
class WorkflowTaskOperationMigrationIT {
  @Container
  static final PostgreSQLContainer<?> DB = new PostgreSQLContainer<>("postgres:16-alpine");

  @Test
  void taskOperationUpgradeRetainsHistoricalWithdrawalEvents() throws Exception {
    try (var connection = DriverManager.getConnection(DB.getJdbcUrl(), DB.getUsername(), DB.getPassword());
        var statement = connection.createStatement()) {
      statement.execute("create table workflow_task_events(id text, action text constraint workflow_task_events_action_check check(action in ('created','claimed','approved','rejected','completed','cancelled')))");
      statement.execute("insert into workflow_task_events values ('old-withdrawal','cancelled')");
      ScriptUtils.executeSqlScript(connection, new ClassPathResource("db/migration/V260__workflow_task_operations.sql"));
      statement.execute("insert into workflow_task_events values ('new-transfer','transferred')");
      try (var result = statement.executeQuery("select count(*) from workflow_task_events")) {
        assertThat(result.next()).isTrue();
        assertThat(result.getInt(1)).isEqualTo(2);
      }
    }
  }
}
