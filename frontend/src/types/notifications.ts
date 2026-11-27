export type NotificationKind = 'info' | 'success' | 'danger';

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  kind: NotificationKind;
  read: boolean;
  created_at: string;
}
