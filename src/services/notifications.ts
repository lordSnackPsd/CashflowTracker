import notifee, { TriggerType, TimestampTrigger } from '@notifee/react-native';

export async function requestNotificationPermission() {
  await notifee.requestPermission();
}

export async function schedulePaymentReminder(
  id: string,
  clientName: string,
  amount: number,
  currency: string,
  dateStr: string, // YYYY-MM-DD
  timeStr: string // "HH:MM"
): Promise<string> {
  await notifee.requestPermission();

  const channelId = await notifee.createChannel({
    id: 'payment-reminders',
    name: 'Payment Reminders',
  });

  const [year, month, day] = dateStr.split('-').map(Number);
  const [hours, minutes] = timeStr.split(':').map(Number);
  
  const triggerDate = new Date(year, month - 1, day, hours, minutes);
  const time = triggerDate.getTime();

  const trigger: TimestampTrigger = {
    type: TriggerType.TIMESTAMP,
    timestamp: time,
  };

  const notificationId = await notifee.createTriggerNotification(
    {
      id,
      title: 'Payment Reminder',
      body: `Reminder: ${clientName} owes you ${amount} ${currency} today.`,
      android: {
        channelId,
        pressAction: {
          id: 'default',
        },
      },
    },
    trigger
  );

  return notificationId;
}

export async function cancelPaymentReminder(notificationId: string) {
  if (notificationId) {
    await notifee.cancelNotification(notificationId);
  }
}
