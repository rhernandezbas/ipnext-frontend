import { useQuery } from '@tanstack/react-query';
import { getPaymentStatements } from '@/api/paymentStatement.api';

export function usePaymentStatements() {
  return useQuery({
    queryKey: ['payment-statements'],
    queryFn: getPaymentStatements,
    staleTime: 60_000,
  });
}
