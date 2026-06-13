
import React, { useState, useEffect } from 'react';
import SmartSourcing from './supplier/SmartSourcing';
import SupplierList from './supplier/SupplierList';
import SupplierApproval from './supplier/SupplierApproval';
import SupplierFinance from './supplier/SupplierFinance';

interface SupplierManagementProps {
  initialTab?: string;
}

const SupplierManagement: React.FC<SupplierManagementProps> = ({ initialTab = 'list' }) => {
  const [activeSubTab, setActiveSubTab] = useState(initialTab);

  useEffect(() => {
    setActiveSubTab(initialTab);
  }, [initialTab]);

  if (activeSubTab === 'sourcing') {
    return <SmartSourcing />;
  }

  if (activeSubTab === 'approval') {
    return <SupplierApproval />;
  }

  if (activeSubTab === 'finance') {
    return <SupplierFinance />;
  }

  // Default to list
  return <SupplierList />;
};

export default SupplierManagement;
