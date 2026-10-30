import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { FundingLiquidationEvidence } from './funding-liquidation-evidence';
it('distinguishes retained historical cash, current paid attribution and released responsibility',()=>{
 render(<FundingLiquidationEvidence snapshot={JSON.stringify({fundingLiquidation:{period:'2026',historicalPaid:200,totalPaid:900,releasedAmount:300,lines:[{fundId:'a',code:'A',name:'专项A',allocatedAmount:700,paidAmount:500,releasedAmount:200}]}})}/>);
 const text=screen.getByRole('region',{name:'专项资金终止释放依据'}).textContent;expect(text).toContain('历史年度已付 ¥200.00');expect(text).toContain('本次释放 ¥300.00');expect(text).toContain('保留已付 ¥500.00');
});
it('preserves old unfunded history without inventing funding evidence',()=>{const {container}=render(<FundingLiquidationEvidence snapshot='{}'/>);expect(container.textContent).toBe('');});
it('surfaces malformed evidence instead of implying release succeeded',()=>{render(<FundingLiquidationEvidence snapshot='invalid'/>);expect(screen.getByText('专项清算依据读取失败')).toBeTruthy();});
