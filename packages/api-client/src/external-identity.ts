import { customInstance } from './http-client';
import type { ApiEnvelope } from './workflow-runtime';
export interface ExternalBinding { id: string; userId: string; issuer: string; subject: string; name: string; employeeNo?: string; enabled: boolean; revision: number; userStatus: string; reason: string; createdAt: string; updatedAt: string }
export interface IdentityReadiness { externalEnabled: boolean; issuerConfigured: boolean; audienceConfigured: boolean; strictMapping: boolean; selfIssuedAccepted: boolean; issuer: string; totalBindings: number; activeBindings: number; pendingItems: string[] }
export interface IdentityBindingPage { items: ExternalBinding[]; total: number; page: number; pageSize: number }
async function call<T>(path: string, data?: unknown) { return (await customInstance<ApiEnvelope<T>>({url:'/api/v1/buyer/identity-bindings'+path,method:data===undefined?'GET':'POST',data})).data as T; }
export const externalBindings = (page: number, keyword: string) => call<IdentityBindingPage>(`?page=${page}&pageSize=10&keyword=${encodeURIComponent(keyword)}`);
export const identityReadiness = () => call<IdentityReadiness>('/readiness');
export const createExternalBinding = (data: {userId: string;subject: string;reason: string}) => call<ExternalBinding>('',data);
export const changeExternalBinding = (id: string,data: {enabled: boolean;revision: number;reason: string}) => call<ExternalBinding>(`/${encodeURIComponent(id)}/status`,data);
export const remapExternalBinding = (id: string,data: {userId: string;revision: number;reason: string}) => call<ExternalBinding>(`/${encodeURIComponent(id)}/member`,data);
