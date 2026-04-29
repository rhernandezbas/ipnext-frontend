import { useQuery } from '@tanstack/react-query';
import { getCustomerVouchers } from '@/api/voucher.api';

export function useCustomerVouchers() {
  return useQuery({
    queryKey: ['customer-vouchers'],
    queryFn: getCustomerVouchers,
    staleTime: 60_000,
  });
}
