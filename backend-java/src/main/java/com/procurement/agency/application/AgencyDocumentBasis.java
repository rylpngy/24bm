package com.procurement.agency.application;

import com.procurement.agency.domain.AgencyRecords.*;
import com.procurement.agency.infrastructure.*;
import java.util.*;
import org.springframework.stereotype.Component;

@Component
public class AgencyDocumentBasis {
  private final AgencyMapper packages;
  private final AgencyExecutionMapper data;
  private final AgencyJson json;

  public AgencyDocumentBasis(AgencyMapper packages, AgencyExecutionMapper data, AgencyJson json) {
    this.packages = packages;
    this.data = data;
    this.json = json;
  }

  public Map<String, Object> current(String tenant, String pkg) {
    var p = packages.find(tenant, pkg);
    var d = json.read(p.dataJson(), Draft.class);
    Map<String, Object> fields = new TreeMap<>();
    fields.put("projectTitle", p.title());
    fields.put("projectNumber", p.number());
    fields.put("procurementMethod", p.procurementMethod());
    fields.put("budget", p.budget() == null ? "" : p.budget().toPlainString());
    fields.put("ceiling", p.ceiling() == null ? "" : p.ceiling().toPlainString());
    fields.put("currency", p.currency());
    fields.put("purchaserName", d.purchaser().getOrDefault("name", ""));
    fields.put("contact", d.purchaser().getOrDefault("contact", ""));
    fields.put("phone", d.purchaser().getOrDefault("phone", ""));
    fields.put("regime", d.regime() == null ? "" : d.regime());
    fields.put("region", d.region() == null ? "" : d.region());
    List<Map<String, Object>> requirements = new ArrayList<>();
    for (var item : data.demands(tenant, pkg))
      if ("confirmed".equals(item.status()))
        requirements.add(
            Map.of(
                "id",
                item.id(),
                "version",
                item.version(),
                "key",
                item.fieldKey(),
                "value",
                item.valueText(),
                "sourceVersion",
                item.sourceVersionId(),
                "locator",
                item.locator()));
    Map<String, Object> basis = new LinkedHashMap<>();
    basis.put("fields", fields);
    basis.put("requirements", requirements);
    basis.put("hash", json.hash(Arrays.asList(fields, requirements)));
    basis.put("packageVersion", p.version());
    return basis;
  }

  public boolean stale(String tenant, String pkg, String raw) {
    var old = json.tree(raw).path("hash").asText("");
    return !old.equals(current(tenant, pkg).get("hash"));
  }
}
