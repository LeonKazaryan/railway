import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { FleetPage } from '@/pages/fleet'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
})

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <FleetPage />
    </QueryClientProvider>
  )
}
