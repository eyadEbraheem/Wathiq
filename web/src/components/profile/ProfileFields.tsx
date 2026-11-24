import { EDUCATION_LABELS_AR, GOVERNORATE_LABELS_AR } from "@csh/shared";
import { Select } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { isOrganization } from "@/lib/accounts";
import type { CurrentUser } from "@/lib/types";

const toOptions = (labels: Record<string, string>) =>
  Object.entries(labels).map(([value, label]) => ({ value, label }));

/**
 * Address, education and work field: on /me and in the sign-up wizard. All optional.
 * Organizations only have an address: education and work are a person's.
 */
export function ProfileFields({ user }: { user: CurrentUser }) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <Select
          id="governorate"
          name="governorate"
          label="المحافظة"
          options={toOptions(GOVERNORATE_LABELS_AR)}
          defaultValue={user.governorate ?? ""}
        />
        <Input id="city" name="city" label="المدينة" defaultValue={user.city} maxLength={80} />
        <Input id="neighborhood" name="neighborhood" label="الحي" defaultValue={user.neighborhood} maxLength={80} />
      </div>
      {isOrganization(user) ? null : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              id="educationLevel"
              name="educationLevel"
              label="التحصيل العلمي"
              options={toOptions(EDUCATION_LABELS_AR)}
              defaultValue={user.educationLevel ?? ""}
            />
            <Input id="fieldOfStudy" name="fieldOfStudy" label="الاختصاص" defaultValue={user.fieldOfStudy} maxLength={120} />
          </div>
          <Input id="workField" name="workField" label="مجال العمل" defaultValue={user.workField} maxLength={120} />
        </>
      )}
    </>
  );
}
