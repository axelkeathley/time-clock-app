import * as Notifications from 'expo-notifications';
import { Settings } from './types';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function requestNotificationPermissions(): Promise<boolean> {
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function scheduleWorkNotifications(settings: Settings): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();

  if (!settings.notificationsEnabled) return;

  const granted = await requestNotificationPermissions();
  if (!granted) return;

  const [startHour, startMin] = settings.workStartTime.split(':').map(Number);
  const [endHour, endMin] = settings.workEndTime.split(':').map(Number);

  for (const jsDay of settings.workDays) {
    // expo-notifications weekday: 1=Sun, 2=Mon ... 7=Sat
    const weekday = (jsDay + 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🕐 Time to Clock In!',
        body: 'Your work day is starting.',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        weekday,
        hour: startHour,
        minute: startMin,
      },
    });

    await Notifications.scheduleNotificationAsync({
      content: {
        title: "🏁 Don't Forget to Clock Out!",
        body: 'Your shift is ending — remember to clock out.',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        weekday,
        hour: endHour,
        minute: endMin,
      },
    });
  }
}
