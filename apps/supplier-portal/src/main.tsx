import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { configureApiClient } from '@24bid/api-client';
import './index.css';
import { App } from './App';

configureApiClient({
  baseUrl: import.meta.env.VITE_JAVA_API_BASE_URL ?? 'http://localhost:8080',
});

const queryClient = new QueryClient();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
