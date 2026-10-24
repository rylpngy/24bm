import { useQuery } from '@tanstack/react-query';
import { customInstance } from './http-client';
import type { ApiEnvelope } from './workflow-runtime';

export type NumberingBusinessType = 'demand' | 'tender';
export type NumberingDateFormat = 'none' | 'yyyy' | 'yyyyMM' | 'yyyyMMdd';
export interface NumberingRuleDraft { prefix: string; dateFormat: NumberingDateFormat; width: number; enabled: boolean }
export interface NumberingRule extends NumberingRuleDraft { businessType: NumberingBusinessType }
export interface NumberingPreview { example: string; consumesSequence: boolean; notice: string }
const base = '/api/v1/buyer/numbering-rules';
export const numberingRulesKey = [base] as const;
export const listNumberingRules = (signal?: AbortSignal) => customInstance<ApiEnvelope<NumberingRule[]>>({ url: base, method: 'GET', signal });
export const useNumberingRules = (enabled = true) => useQuery({ queryKey: numberingRulesKey, queryFn: ({ signal }) => listNumberingRules(signal), enabled });
export const saveNumberingRule = (businessType: NumberingBusinessType, data: NumberingRuleDraft) => customInstance<ApiEnvelope<NumberingRule>>({
  url: `${base}/${businessType}`, method: 'PUT', data, headers: { 'Content-Type': 'application/json' },
});
export const previewNumberingRule = (businessType: NumberingBusinessType, data: NumberingRuleDraft) => customInstance<ApiEnvelope<NumberingPreview>>({
  url: `${base}/${businessType}/preview`, method: 'POST', data, headers: { 'Content-Type': 'application/json' },
});
