import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nProvider } from '@24bid/ui';
import { QueryClientProvider } from '@tanstack/react-query';
import { configureApiClient, createAppQueryClient } from '@24bid/api-client';
import './index.css';
import { App } from './App';

// 配置后端地址（正向契约：所有请求经 @24bid/api-client 的 mutator）。
configureApiClient({
  baseUrl: import.meta.env.VITE_JAVA_API_BASE_URL ?? 'http://localhost:8080',
});

const queryClient = createAppQueryClient();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <App />
      </I18nProvider>
    </QueryClientProvider>
  </StrictMode>,
);
