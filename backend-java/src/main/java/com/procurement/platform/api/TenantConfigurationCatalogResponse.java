package com.procurement.platform.api;

import com.procurement.platform.domain.TenantPlanCatalog;
import com.procurement.tenant.domain.ProcurementMethodCatalog;
import com.procurement.tenant.domain.TenantFeatureKey;
import java.util.List;

public record TenantConfigurationCatalogResponse(
    List<TenantPlanCatalog.Plan> plans, List<TenantFeatureKey.Feature> features,
    List<ProcurementMethodCatalog.MethodDefinition> methods) {}
