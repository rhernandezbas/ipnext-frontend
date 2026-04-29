export interface AdminProfile {
  id: number;
  name: string;
  email: string;
  phone: string;
  role: string;
  language: string;
  timezone: string;
  twoFactorEnabled: boolean;
  avatarInitials: string;
  createdAt: string;
  lastLogin: string;
}
