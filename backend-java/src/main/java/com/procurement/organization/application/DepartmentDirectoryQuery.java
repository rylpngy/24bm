package com.procurement.organization.application;
import com.procurement.organization.infrastructure.DepartmentMapper;
import com.procurement.common.tenant.TenantAccessGuard;
import java.util.List;
import org.springframework.stereotype.Service;
@Service
public record DepartmentDirectoryQuery(DepartmentMapper mapper) {
 public record Department(String id,String name) {}
 public List<Department> active(){return mapper.listActiveByTenant(TenantAccessGuard.requireTenantId("department directory")).stream().map(d->new Department(d.id(),d.name())).toList();}
}
