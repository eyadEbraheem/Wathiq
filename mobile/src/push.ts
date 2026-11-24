import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { api } from './api';

const tokenKey = 'wathiq.push-token';
const supported = () =>
  Device.isDevice && Constants.appOwnership !== 'expo' && Platform.OS !== 'web';
export async function registerPush(ask = false) {
  if (!supported()) {
    if (ask)
      throw new Error(
        'إشعارات الجهاز تحتاج نسخة تطوير مثبتة على هاتف حقيقي؛ صندوق الإشعارات متاح داخل التطبيق.',
      );
    return;
  }
  const projectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
  if (!projectId) {
    if (ask) throw new Error('لم يُهيّأ مشروع إشعارات التطبيق بعد.');
    return;
  }
  if (Platform.OS === 'android')
    await Notifications.setNotificationChannelAsync('default', {
      name: 'إشعارات واثق',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  let permission = await Notifications.getPermissionsAsync();
  if (permission.status !== 'granted' && ask)
    permission = await Notifications.requestPermissionsAsync();
  if (permission.status !== 'granted') {
    if (ask) throw new Error('اسمح بإشعارات واثق من إعدادات الهاتف.');
    return;
  }
  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  await api('/push-devices', 'POST', {
    pushToken: token,
    platform: Platform.OS === 'ios' ? 'IOS' : 'ANDROID',
  });
  await SecureStore.setItemAsync(tokenKey, token);
}
export async function unregisterPush() {
  const token = await SecureStore.getItemAsync(tokenKey);
  if (token) {
    await api(`/push-devices/${encodeURIComponent(token)}`, 'DELETE');
    await SecureStore.deleteItemAsync(tokenKey);
  }
}
export function watchPush(open: (data: Record<string, unknown>) => void) {
  if (!supported()) return () => {};
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
  const handle = (response: Notifications.NotificationResponse) => {
    open(response.notification.request.content.data);
    void Notifications.clearLastNotificationResponseAsync();
  };
  const listener =
    Notifications.addNotificationResponseReceivedListener(handle);
  void Notifications.getLastNotificationResponseAsync().then((r) => {
    if (r) handle(r);
  });
  return () => listener.remove();
}
