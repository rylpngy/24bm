package com.procurement.contract.infrastructure;

import java.math.BigDecimal;
import java.util.List;
import org.apache.ibatis.annotations.*;

@Mapper
public interface ContractPaymentAllocationMapper {
  record Allocation(String milestoneId, BigDecimal amount) {}

  @Select("select coalesce(sum(amount),0) from contract_payment_allocations where tenant_id=#{tenant} and milestone_id=#{milestone}")
  BigDecimal paid(@Param("tenant") String tenant, @Param("milestone") String milestone);

  @Select("select milestone_id,amount from contract_payment_allocations where tenant_id=#{tenant} and entry_id=#{entry} order by milestone_id")
  List<Allocation> byEntry(@Param("tenant") String tenant, @Param("entry") String entry);

  @Insert("insert into contract_payment_allocations(id,tenant_id,entry_id,milestone_id,amount) values(#{id},#{tenant},#{entry},#{milestone},#{amount})")
  void insert(@Param("id") String id, @Param("tenant") String tenant, @Param("entry") String entry,
      @Param("milestone") String milestone, @Param("amount") BigDecimal amount);
}
