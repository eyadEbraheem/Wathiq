import React, { useEffect, useState } from 'react';
import { Platform, Pressable, Switch, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import DateTimePicker, {
  DateTimePickerAndroid,
} from '@react-native-community/datetimepicker';
import { api, appendFile } from './api';
import { Button, Card, Chip, Input, Photo, Row, Txt } from './ui';

export type Values = Record<string, unknown>;
export type Option = { value: string | number; label: string };
export interface Field {
  key: string;
  label: string;
  kind?:
    | 'text'
    | 'number'
    | 'password'
    | 'multiline'
    | 'date'
    | 'datetime'
    | 'boolean'
    | 'select'
    | 'multi'
    | 'images'
    | 'image'
    | 'file'
    | 'files'
    | 'group'
    | 'rows'
    | 'strings'
    | 'hidden';
  options?: Option[];
  fields?: Field[];
  required?: boolean;
  maxItems?: number;
  clearValue?: '' | null;
  when?: (values: Values) => boolean;
}
export const field = (
  key: string,
  label: string,
  kind: Field['kind'] = 'text',
  required = false,
): Field => ({ key, label, kind, required });

function DateInputField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [showing, setShowing] = useState(false);
  const selectedDate = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T12:00:00`)
    : new Date(new Date().getFullYear() - 18, 0, 1, 12);
  const formatDate = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const openPicker = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: selectedDate,
        mode: 'date',
        maximumDate: new Date(),
        onChange: (event, date) => {
          if (event.type === 'set' && date) onChange(formatDate(date));
        },
      });
    } else {
      setShowing(true);
    }
  };
  return (
    <View style={{ gap: 8 }}>
      <Txt>{label}</Txt>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`اختيار ${label}`}
        onPress={openPicker}
        style={{
          minHeight: 50,
          alignItems: 'center',
          justifyContent: 'center',
          padding: 12,
          borderRadius: 15,
          borderWidth: 1,
          borderColor: '#DCECEF',
          backgroundColor: '#EBF6F8',
        }}
      >
        <Txt style={{ fontFamily: 'TajawalBold' }}>
          {value || 'اضغط لاختيار تاريخ ميلادك'}
        </Txt>
      </Pressable>
      {Platform.OS === 'ios' && showing && (
        <View style={{ alignItems: 'center' }}>
          <DateTimePicker
            value={selectedDate}
            mode="date"
            display="spinner"
            maximumDate={new Date()}
            onChange={(_, date) => date && onChange(formatDate(date))}
          />
          <Button
            subtle
            title="تم اختيار التاريخ"
            onPress={() => setShowing(false)}
          />
        </View>
      )}
    </View>
  );
}

type UploadedImage = { key: string; url: string };

/** What POST /uploads/images accepts (it checks the real bytes). */
const UPLOADABLE = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Picks several photos and uploads them one by one. A photo that fails does not stop the
 * others; the ones that failed are named under the button.
 */
function ImagesField({
  label,
  maxItems,
  value,
  onChange,
}: {
  label: string;
  maxItems: number;
  value: UploadedImage[];
  onChange: (images: UploadedImage[]) => void;
}) {
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);

  async function pick() {
    setError('');
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.85,
      // iPhone photos are HEIC by default; ask iOS for a JPEG the API accepts.
      preferredAssetRepresentationMode:
        ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
    });
    if (result.canceled) return;
    if (value.length + result.assets.length > maxItems) {
      setError(`الحد الأقصى ${maxItems} صور.`);
      return;
    }
    setUploading(true);
    const uploaded = [...value];
    const failed: string[] = [];
    for (const [i, asset] of result.assets.entries()) {
      const name = asset.fileName ?? `صورة ${i + 1}`;
      if (asset.mimeType && !UPLOADABLE.includes(asset.mimeType)) {
        failed.push(name);
        continue;
      }
      try {
        const form = new FormData();
        appendFile(form, 'file', {
          uri: asset.uri,
          name: asset.fileName ?? 'image.jpg',
          mimeType: asset.mimeType ?? 'image/jpeg',
        });
        uploaded.push(
          await api<UploadedImage>('/uploads/images', 'POST', form),
        );
        onChange([...uploaded]);
      } catch {
        failed.push(name);
      }
    }
    setUploading(false);
    if (failed.length > 0) {
      setError(
        `تعذّر رفع: ${failed.join('، ')}. الصور المسموحة: JPG أو PNG أو WebP، حتى 10 ميغابايت.`,
      );
    }
  }

  return (
    <View style={{ gap: 8 }}>
      <Txt>{label}</Txt>
      {value.map((img, i) => (
        <Card key={img.key}>
          <Photo uri={img.url} />
          <Button
            subtle
            title="إزالة الصورة"
            onPress={() => onChange(value.filter((_, j) => j !== i))}
          />
        </Card>
      ))}
      <Button
        subtle
        title={uploading ? 'جارٍ رفع الصور…' : 'اختيار صور'}
        disabled={uploading}
        onPress={() => void pick()}
      />
      {!!error && <Txt style={{ color: '#B84863' }}>{error}</Txt>}
    </View>
  );
}

export function Fields({
  fields,
  values,
  change,
}: {
  fields: Field[];
  values: Values;
  change: (values: Values) => void;
}) {
  return (
    <>
      {fields
        .filter((f) => !f.when || f.when(values))
        .map((f) => {
          const value = values[f.key];
          const set = (v: unknown) => change({ ...values, [f.key]: v });
          if (f.kind === 'hidden') return null;
          if (f.kind === 'image')
            return (
              <Fields
                key={f.key}
                fields={[{ ...f, kind: 'images' }]}
                values={{ [f.key]: value ? [value] : [] }}
                change={(v) => set((v[f.key] as unknown[]).at(-1))}
              />
            );
          if (f.kind === 'boolean')
            return (
              <Row key={f.key}>
                <Txt>{f.label}</Txt>
                <Switch
                  accessibilityLabel={f.label}
                  value={value === true}
                  onValueChange={set}
                />
              </Row>
            );
          if (f.kind === 'select' || f.kind === 'multi')
            return (
              <View key={f.key} style={{ gap: 8 }}>
                <Txt>{f.label}</Txt>
                {f.kind === 'multi' && f.key === 'roleIds' && (
                  <Txt>
                    {((value as number[]) ?? [])
                      .map(
                        (id, i) =>
                          `${i + 1}. ${f.options?.find((o) => o.value === id)?.label ?? ''}`,
                      )
                      .join('، ')}
                  </Txt>
                )}
                <Row>
                  {!f.required && f.kind === 'select' && (
                    <Chip
                      title="بدون تحديد"
                      active={value === undefined || value === null}
                      onPress={() => set(f.clearValue ?? undefined)}
                    />
                  )}
                  {f.options?.map((o) => (
                    <Chip
                      key={o.value}
                      title={o.label}
                      active={
                        f.kind === 'multi'
                          ? ((value as unknown[]) ?? []).includes(o.value)
                          : value === o.value
                      }
                      onPress={() =>
                        set(
                          f.kind === 'multi'
                            ? ((value as unknown[]) ?? []).includes(o.value)
                              ? (value as unknown[]).filter(
                                  (v) => v !== o.value,
                                )
                              : [...((value as unknown[]) ?? []), o.value]
                            : o.value,
                        )
                      }
                    />
                  ))}
                </Row>
              </View>
            );
          if (f.kind === 'group')
            return (
              <Card key={f.key}>
                <Row>
                  <Txt>{f.label}</Txt>
                  <Switch
                    value={!!value}
                    onValueChange={(v) => set(v ? {} : undefined)}
                  />
                </Row>
                {!!value && (
                  <Fields
                    fields={f.fields ?? []}
                    values={value as Values}
                    change={set}
                  />
                )}
              </Card>
            );
          if (f.kind === 'rows')
            return (
              <View key={f.key} style={{ gap: 8 }}>
                <Txt>{f.label}</Txt>
                {((value as Values[]) ?? []).map((row, i) => (
                  <Card key={i}>
                    <Fields
                      fields={f.fields ?? []}
                      values={row}
                      change={(v) =>
                        set(
                          (value as Values[]).map((r, j) => (i === j ? v : r)),
                        )
                      }
                    />
                    <Button
                      subtle
                      title="إزالة"
                      onPress={() =>
                        set((value as Values[]).filter((_, j) => i !== j))
                      }
                    />
                  </Card>
                ))}
                <Button
                  subtle
                  title={`إضافة ${f.label}`}
                  onPress={() => set([...((value as Values[]) ?? []), {}])}
                />
              </View>
            );
          if (f.kind === 'images')
            return (
              <ImagesField
                key={f.key}
                label={f.label}
                maxItems={f.maxItems ?? 10}
                value={(value as UploadedImage[]) ?? []}
                onChange={set}
              />
            );
          if (f.kind === 'file' || f.kind === 'files')
            return (
              <View key={f.key}>
                <Txt>{f.label}</Txt>
                <Txt>
                  {((value as { name: string }[]) ?? [])
                    .map((x) => x.name)
                    .join('، ')}
                </Txt>
                <Button
                  subtle
                  title="اختيار ملف"
                  onPress={async () => {
                    const r = await DocumentPicker.getDocumentAsync({
                      type: [
                        'image/jpeg',
                        'image/png',
                        'image/webp',
                        'application/pdf',
                      ],
                      multiple: f.kind === 'files',
                      copyToCacheDirectory: true,
                    });
                    if (!r.canceled) set(r.assets);
                  }}
                />
              </View>
            );
          if (f.kind === 'date')
            return (
              <DateInputField
                key={f.key}
                label={f.label}
                value={typeof value === 'string' ? value : ''}
                onChange={set}
              />
            );
          return (
            <Input
              key={f.key}
              label={`${f.label}${f.kind === 'datetime' ? ' (YYYY-MM-DD HH:mm، توقيت جهازك)' : ''}`}
              value={value === undefined || value === null ? '' : String(value)}
              onChange={set}
              secure={f.kind === 'password'}
              multiline={f.kind === 'multiline'}
              numeric={f.kind === 'number'}
            />
          );
        })}
    </>
  );
}
export function encode(fields: Field[], values: Values): Values {
  const out: Values = {};
  for (const f of fields) {
    if (f.when && !f.when(values)) continue;
    const v = values[f.key];
    if (
      v === undefined ||
      v === '' ||
      v === null ||
      (f.required && Array.isArray(v) && !v.length)
    ) {
      if (f.required) throw new Error(`أكمل حقل ${f.label}`);
      if (f.clearValue !== undefined && v !== undefined)
        out[f.key] = f.clearValue;
      continue;
    }
    if (f.kind === 'number') {
      const n = Number(v);
      if (!Number.isFinite(n)) throw new Error(`تحقق من ${f.label}`);
      out[f.key] = n;
    } else if (f.kind === 'datetime') {
      const d = new Date(String(v).replace(' ', 'T'));
      if (!Number.isFinite(d.getTime()))
        throw new Error(`تحقق من تاريخ ${f.label}`);
      out[f.key] = d.toISOString();
    } else if (f.kind === 'group')
      out[f.key] = encode(f.fields ?? [], v as Values);
    else if (f.kind === 'rows')
      out[f.key] = (v as Values[]).map((r) => encode(f.fields ?? [], r));
    else if (f.kind === 'images')
      out[f.key] = (v as { key: string }[]).map((x) => x.key);
    else if (f.kind === 'image') out[f.key] = (v as { key: string }).key;
    else if (f.kind === 'strings')
      out[f.key] = String(v)
        .split(/\n|،|,/)
        .map((s) => s.trim())
        .filter(Boolean);
    else out[f.key] = v;
  }
  return out;
}
export function Form({
  fields,
  initial = {},
  submit,
  title = 'حفظ',
  after,
}: {
  fields: Field[];
  initial?: Values;
  submit: (v: Values) => Promise<unknown>;
  title?: string;
  after?: () => void;
}) {
  const [values, change] = useState(initial);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  return (
    <View style={{ gap: 14 }}>
      <Fields
        fields={fields}
        values={values}
        change={(v) => {
          change(v);
          setDone(false);
        }}
      />
      {!!error && <Txt style={{ color: '#B84863' }}>{error}</Txt>}
      {done && <Txt>تم الحفظ بنجاح</Txt>}
      <Button
        title={title}
        onPress={async () => {
          setError('');
          try {
            await submit(encode(fields, values));
            setDone(true);
            after?.();
          } catch (e) {
            setError(e instanceof Error ? e.message : 'تعذّر الاتصال');
          }
        }}
      />
    </View>
  );
}
