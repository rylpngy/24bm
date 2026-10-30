package com.procurement;

import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;

class DatabaseMigrationVersionTests {
  @Test
  void commonMigrationsHaveUniqueVersions() throws Exception {
    Map<String, String> versions = new HashMap<>();
    try (var files = Files.list(Path.of("src/main/resources/db/migration"))) {
      for (var file : files.filter(Files::isRegularFile).toList()) {
        String name = file.getFileName().toString();
        if (!name.matches("V[0-9]+__.*\\.sql")) continue;
        String version = name.substring(1, name.indexOf("__"));
        String previous = versions.putIfAbsent(version, name);
        assertTrue(previous == null, () -> "Duplicate Flyway version: " + previous + " / " + name);
      }
    }
  }
}
