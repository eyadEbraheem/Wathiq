import React, { createContext, useContext, useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import type { CurrentUser, Paginated, Section } from '@csh/shared';
import { api } from './api';
import { Button, Card, Row, Txt } from './ui';

export type Route = {
  name: string;
  id?: number;
  kind?: string;
  targetId?: number;
};
export interface AppState {
  me: CurrentUser;
  sections: Section[];
  go: (route: Route) => void;
  back: () => void;
  reloadMe: () => Promise<void>;
  refreshNotifications: () => void;
  signOut: () => Promise<void>;
  dark: boolean;
  toggleTheme: () => void;
}
export const AppContext = createContext<AppState | null>(null);
export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error('Missing session');
  return value;
}
export function useResource<T>(path: string, revision = 0) {
  const [state, setState] = useState<{
    data?: T;
    error?: string;
    loading: boolean;
  }>({ loading: true });
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    let active = true;
    setState({ loading: true });
    api<T>(path)
      .then((data) => {
        if (active) setState({ data, loading: false });
      })
      .catch((e) => {
        if (active)
          setState({
            loading: false,
            error: e instanceof Error ? e.message : 'تعذّر الاتصال',
          });
      });
    return () => {
      active = false;
    };
  }, [path, nonce, revision]);
  return { ...state, reload: () => setNonce((n) => n + 1) };
}
export function Resource<T>({
  path,
  children,
  revision = 0,
}: {
  path: string;
  revision?: number;
  children: (data: T, reload: () => void) => React.ReactNode;
}) {
  const r = useResource<T>(path, revision);
  if (r.loading)
    return (
      <ActivityIndicator
        accessibilityLabel="جارٍ التحميل"
        style={{ margin: 30 }}
        color="#198996"
      />
    );
  if (r.error)
    return (
      <Card>
        <Txt>{r.error}</Txt>
        <Button title="إعادة المحاولة" onPress={r.reload} />
      </Card>
    );
  return <>{r.data !== undefined && children(r.data, r.reload)}</>;
}
export function List<T extends { id: number }>({
  path,
  render,
  revision = 0,
}: {
  path: string;
  render: (item: T, reload: () => void) => React.ReactNode;
  revision?: number;
}) {
  // Reset page with a new query instead of displaying the previous query's page.
  return (
    <Paged<T> key={path} path={path} render={render} revision={revision} />
  );
}
function Paged<T extends { id: number }>({
  path,
  render,
  revision,
}: {
  path: string;
  render: (item: T, reload: () => void) => React.ReactNode;
  revision: number;
}) {
  const [page, setPage] = useState(1);
  return (
    <Resource<Paginated<T>>
      path={`${path}${path.includes('?') ? '&' : '?'}page=${page}&limit=20`}
      revision={revision}
    >
      {(res, reload) => (
        <View>
          {!res.data.length && (
            <Card>
              <Txt>لا توجد نتائج هنا بعد.</Txt>
            </Card>
          )}
          {res.data.map((item) => (
            <React.Fragment key={item.id}>
              {render(item, reload)}
            </React.Fragment>
          ))}
          {res.meta.totalPages > 1 && (
            <Row>
              <Button
                subtle
                title="السابق"
                disabled={page <= 1}
                onPress={() => setPage((p) => p - 1)}
              />
              <Txt>
                {page} / {res.meta.totalPages}
              </Txt>
              <Button
                subtle
                title="التالي"
                disabled={page >= res.meta.totalPages}
                onPress={() => setPage((p) => p + 1)}
              />
            </Row>
          )}
        </View>
      )}
    </Resource>
  );
}
export function query(values: Record<string, unknown>) {
  return new URLSearchParams(
    Object.entries(values)
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => [k, String(v)]),
  ).toString();
}
export const statusText: Record<string, string> = {
  PENDING: 'قيد المراجعة',
  APPROVED: 'مقبول',
  ACCEPTED: 'مقبول',
  REJECTED: 'مرفوض',
  REQUESTED: 'طُلبت',
  WITHDRAWN: 'منسحب',
  OPEN: 'مفتوحة',
  CLOSED: 'مغلقة',
  COMPLETED: 'مكتملة',
  CANCELLED: 'ملغاة',
  DECLINED: 'مرفوض',
  REMOVED: 'أزيل',
  REVOKED: 'مسحوبة',
  RESOLVED: 'عولج',
  DISMISSED: 'تُجاهل',
  PUBLISHED: 'منشور',
  HIDDEN: 'مخفي',
};
export const dateText = (date?: string | null) =>
  date
    ? new Date(date).toLocaleString('ar-SY', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : 'غير محدد';
