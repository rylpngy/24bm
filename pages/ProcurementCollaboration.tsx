
import React, { useState, useEffect } from 'react';
import ContractManagement from './collaboration/ContractManagement';
import OrderManagement from './collaboration/OrderManagement';
import FinanceManagement from './collaboration/FinanceManagement';

interface ProcurementCollaborationProps {
  initialTab?: string;
}

const ProcurementCollaboration: React.FC<ProcurementCollaborationProps> = ({ initialTab = 'contracts' }) => {
  const [activeSubTab, setActiveSubTab] = useState(initialTab);

  useEffect(() => {
    setActiveSubTab(initialTab);
  }, [initialTab]);

  if (activeSubTab === 'orders') {
      return <OrderManagement />;
  }
  if (activeSubTab === 'finance') {
      return <FinanceManagement />;
  }
  // Default to contracts
  return <ContractManagement />;
};

export default ProcurementCollaboration;
