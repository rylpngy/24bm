
import React, { useState, useEffect } from 'react';
import OrgManagement from './system/OrgManagement';
import RolePermission from './system/RolePermission';
import WorkflowSettings from './system/WorkflowSettings';
import MaterialMasterData from './system/MaterialMasterData';

interface SystemManagementProps {
  initialTab?: string;
}

const SystemManagement: React.FC<SystemManagementProps> = ({ initialTab = 'org' }) => {
  const [activeSubTab, setActiveSubTab] = useState(initialTab);

  useEffect(() => {
    setActiveSubTab(initialTab);
  }, [initialTab]);

  if (activeSubTab === 'permission') {
    return <RolePermission />;
  }

  if (activeSubTab === 'workflow') {
    return <WorkflowSettings />;
  }

  if (activeSubTab === 'material') {
    return <MaterialMasterData />;
  }
  
  // Default to org
  return <OrgManagement />;
};

export default SystemManagement;
