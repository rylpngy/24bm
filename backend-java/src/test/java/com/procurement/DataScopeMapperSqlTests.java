package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;

class DataScopeMapperSqlTests {
  private static final Path MAPPER_SOURCE = Path.of(
      "src/main/java/com/procurement/identity/infrastructure/DataScopeMapper.java");

  @Test
  void userRoleDataScopeOnlyReadsBuyerRoles() throws IOException {
    String source = Files.readString(MAPPER_SOURCE);

    assertThat(source)
        .contains("from user_roles ur")
        .contains("join roles r on r.id = ur.role_id")
        .contains("r.scope = 'buyer'")
        .doesNotContain("r.status");
  }
}
