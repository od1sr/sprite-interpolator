export type NotificationKind = 'info' | 'success' | 'danger';

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  kind: NotificationKind;
  created_at: string;
}
