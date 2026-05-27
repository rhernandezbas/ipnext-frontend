export interface NetworkDevice {
  id: string;
  name: string;
  type: 'router' | 'switch' | 'onu' | 'olt' | 'access_point' | 'other';
  ipAddress: string;
  macAddress: string;
  location: string;
  status: 'online' | 'offline' | 'warning';
  model: string;
  lastSeen: string;
}
