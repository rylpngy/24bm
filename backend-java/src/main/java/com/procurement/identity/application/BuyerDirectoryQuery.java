package com.procurement.identity.application;
import com.procurement.identity.infrastructure.BuyerUserMapper;
import com.procurement.common.tenant.TenantAccessGuard;
import java.util.List;
import org.springframework.stereotype.Service;
@Service
public record BuyerDirectoryQuery(BuyerUserMapper mapper) {
 public record Person(String id,String name,String departmentId) {}
 public List<Person> active(){return mapper.listByTenantFiltered(TenantAccessGuard.requireTenantId("buyer directory"),"active",null,null).stream().map(u->new Person(u.id(),u.name(),u.departmentId())).toList();}
}
