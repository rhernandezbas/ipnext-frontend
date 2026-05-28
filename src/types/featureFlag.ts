export interface FeatureFlag {
  key: string;
  enabled: boolean;
  description?: string | null;
  updatedAt?: string;
}
