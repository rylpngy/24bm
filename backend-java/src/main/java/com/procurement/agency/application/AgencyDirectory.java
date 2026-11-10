package com.procurement.agency.application;

import com.procurement.agency.domain.AgencyRecords.*;
import com.procurement.identity.application.BuyerDirectoryQuery;
import com.procurement.organization.application.DepartmentDirectoryQuery;
import java.util.*;
import org.springframework.stereotype.Service;

@Service
public class AgencyDirectory {
  private final BuyerDirectoryQuery users;
  private final DepartmentDirectoryQuery departments;

  public AgencyDirectory(BuyerDirectoryQuery users, DepartmentDirectoryQuery departments) {
    this.users = users;
    this.departments = departments;
  }

  public BuyerDirectoryQuery users() {
    return users;
  }

  public DepartmentDirectoryQuery departments() {
    return departments;
  }

  public List<Person> people() {
    return users.active().stream()
        .map(u -> new Person(u.id(), u.name(), u.departmentId()))
        .toList();
  }

  public List<Department> departmentsList() {
    return departments.active().stream().map(d -> new Department(d.id(), d.name())).toList();
  }
}
