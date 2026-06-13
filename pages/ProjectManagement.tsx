
import React, { useState, useEffect } from 'react';
import ProcurementNeeds from './project/ProcurementNeeds';
import ProcurementPlans from './project/ProcurementPlans';
import ProjectArchives from './project/ProjectArchives';

interface ProjectManagementProps {
  initialTab?: string;
}

const ProjectManagement: React.FC<ProjectManagementProps> = ({ initialTab = 'needs' }) => {
  const [activeSubTab, setActiveSubTab] = useState(initialTab);
  const [planCreationData, setPlanCreationData] = useState<any>(null);
  const [sourceTab, setSourceTab] = useState<string | null>(null);

  // Sync internal state with prop from Sidebar
  useEffect(() => {
    setActiveSubTab(initialTab);
  }, [initialTab]);

  const handleNavigateToPlan = (data?: any) => {
    if (data) {
      setPlanCreationData(data);
      setSourceTab('needs');
    }
    setActiveSubTab('plan');
  };

  if (activeSubTab === 'plan') {
    return (
      <ProcurementPlans 
        initialData={planCreationData} 
        onClearInitialData={() => setPlanCreationData(null)} 
        onBackToNeeds={() => {
          if (sourceTab === 'needs') {
            setActiveSubTab('needs');
            setSourceTab(null);
          }
        }}
      />
    );
  }

  if (activeSubTab === 'archive') {
    return <ProjectArchives />;
  }

  // Default: Needs
  return <ProcurementNeeds onNavigateToPlan={handleNavigateToPlan} />;
};

export default ProjectManagement;
