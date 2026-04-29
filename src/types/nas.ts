export type NasType = 'mikrotik_api' | 'mikrotik_radius' | 'cisco' | 'ubiquiti' | 'cambium' | 'other';

export interface NasServer {
  id: string;
  name: string;
  type: NasType;
  ipAddress: string;
  radiusSecret: string;
  nasIpAddress: string;
  apiPort: number | null;
  apiLogin: string | null;
  apiPassword: string | null;
  status: 'active' | 'inactive' | 'error';
  lastSeen: string | null;
  clientCount: number;
  description: string;
}

export interface RadiusConfig {
  authPort: number;
  acctPort: number;
  coaPort: number;
  sessionTimeout: number;
  idleTimeout: number;
  interimUpdateInterval: number;
  nasType: string;
  enableCoa: boolean;
  enableAccounting: boolean;
}
