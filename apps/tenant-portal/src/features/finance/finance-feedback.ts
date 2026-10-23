export function financeErrorMessage(error: unknown, fallback = '操作失败，请稍后重试'): string {
  if (typeof error !== 'object' || error === null) return fallback;
  const response = (error as { response?: { data?: { message?: unknown } } }).response;
  if (typeof response?.data?.message === 'string' && response.data.message.trim()) {
    return response.data.message;
  }
  const message = (error as { message?: unknown }).message;
  return typeof message === 'string' && message.trim() ? message : fallback;
}
