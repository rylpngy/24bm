import org.flywaydb.core.Flyway;

class SrmMigrationRehearsal {
  public static void main(String[] args) {
    String url = System.getenv("SRM_REHEARSAL_URL");
    if (url == null || !url.matches("jdbc:postgresql://127\\.0\\.0\\.1:[0-9]+/srm_migration_[0-9]+")) {
      throw new IllegalArgumentException("Only a named local rehearsal database is allowed");
    }
    Flyway flyway = Flyway.configure()
        .dataSource(url, "procurement", System.getenv("SRM_REHEARSAL_PASSWORD"))
        .locations("filesystem:" + System.getenv("SRM_REHEARSAL_MIGRATIONS"))
        .cleanDisabled(true)
        .load();
    flyway.migrate();
    flyway.validate();
  }
}
