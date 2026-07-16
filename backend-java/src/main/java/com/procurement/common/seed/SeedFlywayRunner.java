package com.procurement.common.seed;

import javax.sql.DataSource;
import org.flywaydb.core.Flyway;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * 种子数据独立迁移链:demo/dev 种子(db/demo、db/dev)不再与业务迁移(db/migration)共用
 * 一条 Flyway 历史——业务链版本号可持续递增而永不触发 out-of-order,种子链单独演进。
 *
 * <p>通过 APP_SEED_LOCATIONS 开启(演示环境=classpath:db/demo,本地 local profile=classpath:db/dev,
 * 干净试点/生产库留空即完全不跑种子)。历史表为 flyway_seed_history,与主链 flyway_schema_history 隔离。
 *
 * <p>实现为 ApplicationRunner 而非 Flyway Bean:Spring Boot 主 Flyway 自动配置是
 * ConditionalOnMissingBean(Flyway),声明第二个 Flyway Bean 会顶掉业务链迁移。
 */
@Configuration
public class SeedFlywayRunner {
  private static final Logger log = LoggerFactory.getLogger(SeedFlywayRunner.class);

  @Bean
  public ApplicationRunner seedMigrations(
      DataSource dataSource, @Value("${app.seed.locations:}") String locations) {
    return args -> {
      if (locations == null || locations.isBlank()) {
        return;
      }
      var result = Flyway.configure()
          .dataSource(dataSource)
          .locations(locations.split(","))
          .table("flyway_seed_history")
          // 种子链跑在业务 schema 已就绪的非空库上:以 0 为基线初始化自己的历史表,
          // 全部种子版本(V1xx/V2xx)> 0,首次即完整应用。
          .baselineOnMigrate(true)
          .baselineVersion("0")
          .load()
          .migrate();
      log.info("Seed migrations applied: {} from {}", result.migrationsExecuted, locations);
    };
  }
}
