// Arabic display names for enum values (docs/CONVENTIONS.md: display names live in packages/shared).
// English labels can be added next to these when the English UI is built.
import type { EducationLevel, Governorate } from './enums';

export const GOVERNORATE_LABELS_AR: Record<Governorate, string> = {
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
};

export const EDUCATION_LABELS_AR: Record<EducationLevel, string> = {
  NONE: 'بدون',
  PRIMARY: 'ابتدائي',
  PREPARATORY: 'إعدادي',
  SECONDARY: 'ثانوي',
  INSTITUTE: 'معهد / دبلوم',
  BACHELOR: 'إجازة جامعية',
  MASTER: 'ماجستير',
  DOCTORATE: 'دكتوراه',
};

/** Arabic counted noun for new volunteers: "متطوع جديد", "7 متطوعين جدد", "23 متطوعاً جديداً". */
export function newVolunteersWordAr(n: number): string {
  if (n === 1) return 'متطوع جديد';
  if (n === 2) return 'متطوعان جديدان';
  const lastTwo = n % 100;
  return lastTwo >= 3 && lastTwo <= 10 ? 'متطوعين جدد' : 'متطوعاً جديداً';
}
