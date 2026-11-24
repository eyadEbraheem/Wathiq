import type { Section } from '@csh/shared';
import { field, type Field, type Option } from './forms';

export const governorates: Option[] = Object.entries({
  DAMASCUS: 'دمشق',
  RIF_DIMASHQ: 'ريف دمشق',
  ALEPPO: 'حلب',
  HOMS: 'حمص',
  HAMA: 'حماة',
  LATAKIA: 'اللاذقية',
  TARTUS: 'طرطوس',
  IDLIB: 'إدلب',
  RAQQA: 'الرقة',
  DEIR_EZ_ZOR: 'دير الزور',
  HASAKAH: 'الحسكة',
  DARAA: 'درعا',
  SUWAYDA: 'السويداء',
  QUNEITRA: 'القنيطرة',
}).map(([value, label]) => ({ value, label }));
export const education: Option[] = Object.entries({
  NONE: 'دون تعليم',
  PRIMARY: 'ابتدائي',
  PREPARATORY: 'إعدادي',
  SECONDARY: 'ثانوي',
  INSTITUTE: 'معهد',
  BACHELOR: 'جامعي',
  MASTER: 'ماجستير',
  DOCTORATE: 'دكتوراه',
}).map(([value, label]) => ({ value, label }));
export const select = (
  key: string,
  label: string,
  options: Option[],
  required = false,
): Field => ({ key, label, kind: 'select', options, required });
export const sectionField = (sections: Section[], required = true) =>
  select(
    'sectionId',
    'المجال',
    sections.map((s) => ({ value: s.id, label: s.nameAr })),
    required,
  );
export const profileFields: Field[] = [
  field('name', 'الاسم', 'text', true),
  { ...field('bio', 'نبذة عنك', 'multiline'), clearValue: '' },
  { ...select('governorate', 'المحافظة', governorates), clearValue: null },
  { ...field('city', 'المدينة'), clearValue: '' },
  { ...field('neighborhood', 'الحي'), clearValue: '' },
  {
    ...select('educationLevel', 'المستوى التعليمي', education),
    clearValue: null,
  },
  { ...field('fieldOfStudy', 'مجال الدراسة'), clearValue: '' },
  { ...field('workField', 'مجال العمل'), clearValue: '' },
];
export const privacyFields = Object.entries({
  showAddress: 'إظهار العنوان',
  showAge: 'إظهار العمر',
  showEducation: 'إظهار التعليم',
  showWorkField: 'إظهار مجال العمل',
  showTeams: 'إظهار الفرق',
  showInSearch: 'الظهور في البحث',
  hideRating: 'إخفاء التقييم',
  acceptsPublishRequests: 'استقبال طلبات النشر',
}).map(([key, label]) => field(key, label, 'boolean'));
export const dateFields = [
  field('startsAt', 'بداية الفعالية', 'datetime', true),
  field('endsAt', 'نهاية الفعالية', 'datetime'),
  field('applicationDeadline', 'آخر موعد للتقديم', 'datetime'),
];
export const caseField: Field = {
  key: 'caseDetails',
  label: 'حالة إنسانية',
  kind: 'group',
  fields: [
    field('contactPhone', 'هاتف التواصل (+963…)', 'text', true),
    field('paymentQrKey', 'رمز الدفع', 'image'),
    field('paymentNote', 'ملاحظة الدفع'),
  ],
};
export const opportunityField: Field = {
  key: 'opportunity',
  label: 'فرصة تعليم أو عمل',
  kind: 'group',
  fields: [
    field('applyUrl', 'رابط التقديم', 'text', true),
    select(
      'mode',
      'طريقة المشاركة',
      [
        { value: 'ONLINE', label: 'عن بعد' },
        { value: 'IN_PERSON', label: 'حضوري' },
        { value: 'HYBRID', label: 'هجين' },
      ],
      true,
    ),
    field('deadline', 'الموعد النهائي', 'datetime'),
    field('location', 'المكان'),
    field('eligibility', 'شروط الأهلية', 'multiline'),
    field('minAge', 'أقل عمر', 'number'),
    field('maxAge', 'أعلى عمر', 'number'),
    select('educationLevel', 'التعليم', education),
    field('field', 'المجال'),
  ],
};
export const eventFields: Field[] = [
  ...dateFields,
  select('governorate', 'المحافظة', governorates, true),
  field('city', 'المدينة', 'text', true),
  field('locationText', 'وصف الموقع'),
  field('latitude', 'خط العرض', 'number'),
  field('longitude', 'خط الطول', 'number'),
  field('minAge', 'أقل عمر', 'number'),
  {
    ...field(
      'capacity',
      'السعة (اتركها دون تحديد إذا كانت غير محدودة)',
      'number',
    ),
    when: (v) => !(v.roles as unknown[] | undefined)?.length,
  },
  {
    key: 'roles',
    label: 'الأدوار',
    kind: 'rows',
    fields: [
      field('id', '', 'hidden'),
      field('name', 'اسم الدور', 'text', true),
      field('seats', 'عدد المقاعد', 'number', true),
    ],
  },
  {
    key: 'questions',
    label: 'أسئلة التقديم',
    kind: 'rows',
    fields: [
      field('text', 'السؤال', 'text', true),
      field('required', 'إجابة مطلوبة', 'boolean'),
    ],
  },
];
export const membershipFields = [
  field('role', 'دورك في الفريق'),
  field('description', 'وصف المشاركة', 'multiline'),
  field('startYear', 'سنة البداية', 'number'),
  field('endYear', 'سنة النهاية (اتركها فارغة إن كنت مستمراً)', 'number'),
];
