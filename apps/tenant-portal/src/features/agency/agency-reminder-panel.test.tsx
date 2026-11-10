import {useState} from 'react';
import {render,screen,fireEvent} from '@testing-library/react';
import {describe,it,expect} from 'vitest';
import {AgencyReminderSettingsForm,defaultReminder} from './agency-reminder-panel';
function Form(){const [value,setValue]=useState(defaultReminder);return <><AgencyReminderSettingsForm prefix="验收" value={value} onChange={setValue} people={[{id:'manager',name:'内部管理者'}]}/><output aria-label="策略结果">{JSON.stringify(value)}</output></>;}
describe('reminder settings form',()=>{
 it('keeps owner tiers and escalation settings separate',()=>{render(<Form/>);fireEvent.change(screen.getByLabelText('验收临近1小时'),{target:{value:'48'}});fireEvent.change(screen.getByLabelText('验收升级接收人'),{target:{value:'manager'}});fireEvent.change(screen.getByLabelText('验收逾期升级小时'),{target:{value:'12'}});const value=JSON.parse(screen.getByLabelText('策略结果').textContent!);expect(value.leadHours).toEqual([48]);expect(value.overdueHours).toEqual([0]);expect(value.escalationUserId).toBe('manager');expect(value.escalationAfterHours).toBe(12);});
 it('allows disabling reminders while retaining the editable policy values',()=>{render(<Form/>);fireEvent.click(screen.getByLabelText('验收启用提醒'));expect(screen.queryByLabelText('验收临近1小时')).toBeNull();const value=JSON.parse(screen.getByLabelText('策略结果').textContent!);expect(value.enabled).toBe(false);expect(value.leadHours).toEqual([24]);fireEvent.click(screen.getByLabelText('验收启用提醒'));expect(screen.getByLabelText('验收临近1小时')).toHaveValue(24);});
 it('bounds the number of configured tiers in the UI',()=>{render(<Form/>);for(let i=0;i<4;i++)fireEvent.click(screen.getByRole('button',{name:'增加临近级别'}));expect(screen.getByRole('button',{name:'增加临近级别'})).toBeDisabled();});
});
