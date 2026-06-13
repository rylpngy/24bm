
import React from 'react';
import InquiryPurchase from './procurement/InquiryPurchase';
import BiddingPurchase from './procurement/BiddingPurchase';
import EnterpriseMall from './procurement/EnterpriseMall';

interface ProcurementExecutionProps {
  initialTab?: string; // 'inquiry', 'bidding', or 'mall'
}

const ProcurementExecution: React.FC<ProcurementExecutionProps> = ({ initialTab = 'inquiry' }) => {
  
  if (initialTab === 'mall') {
    return <EnterpriseMall />;
  }

  if (initialTab === 'bidding') {
    return <BiddingPurchase />;
  }

  // Default to Inquiry
  return <InquiryPurchase />;
};

export default ProcurementExecution;
