import { Can } from '@/components/auth/Can';
import { GeoLocationEditor } from '@/components/molecules/GeoLocationEditor/GeoLocationEditor';
import { useUpdateCustomer } from '@/hooks/useCustomers';
import type { Customer } from '@/types/customer';

interface Props {
  customer: Customer;
}

/**
 * client-geolocation — "Ubicación" tab on the customer detail page.
 *
 * Renders a GPS editor for the Prominense-owned lat/lng/plusCode of the client.
 * Saves via PATCH /clients/:id. Gated by clients.write.
 */
export function UbicacionTab({ customer }: Props) {
  const updateCustomer = useUpdateCustomer();

  const value = {
    lat: customer.lat ?? null,
    lng: customer.lng ?? null,
    plusCode: customer.plusCode ?? null,
  };

  const handleSave = async (v: { lat: number | null; lng: number | null; plusCode: string | null }) => {
    await updateCustomer.mutateAsync({
      id: String(customer.id),
      data: { lat: v.lat, lng: v.lng, plusCode: v.plusCode },
    });
  };

  return (
    <Can permission="clients.write" fallback={
      <GeoLocationEditor
        value={value}
        onSave={async () => { /* read-only */ }}
        canEdit={false}
        title="Ubicación GPS del cliente"
      />
    }>
      <GeoLocationEditor
        value={value}
        onSave={handleSave}
        canEdit={true}
        title="Ubicación GPS del cliente"
      />
    </Can>
  );
}
