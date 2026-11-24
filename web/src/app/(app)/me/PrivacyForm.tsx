"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { Switch } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/FormMessage";
import { isOrganization } from "@/lib/accounts";
import type { FormState } from "@/lib/actions/auth";
import { updatePrivacyAction } from "@/lib/actions/users";
import type { CurrentUser } from "@/lib/types";
import { keepValuesOnSubmit } from "@/lib/forms";

const initialState: FormState = {};

export function PrivacyForm({ user }: { user: CurrentUser }) {
  const [state, formAction, pending] = useActionState(updatePrivacyAction, initialState);
  const organization = isOrganization(user);

  return (
    <form action={formAction} onSubmit={keepValuesOnSubmit(formAction)} className="mt-3">
      <FormMessage error={state.error} notice={state.notice} />
      <div className="divide-y divide-line">
        <Switch
          name="showAddress"
          label={organization ? "الحي" : "العنوان"}
          description={
            organization ? "المحافظة والمدينة تظهران دائماً للجمعيات؛ هذا الخيار يُظهر الحي أيضاً" : "المحافظة والمدينة والحي"
          }
          defaultChecked={user.showAddress}
        />
        {/* Age, education, work, teams and people search are a person's settings. */}
        {organization ? (
          <input type="hidden" name="organization" value="1" />
        ) : (
          <>
            <Switch name="showAge" label="العمر" description="العمر فقط، لا يظهر تاريخ الميلاد أبداً" defaultChecked={user.showAge} />
            <Switch name="showEducation" label="التحصيل العلمي" description="المستوى والاختصاص" defaultChecked={user.showEducation} />
            <Switch name="showWorkField" label="مجال العمل" defaultChecked={user.showWorkField} />
            <Switch name="showTeams" label="الفرق" description="عضوياتك في الفرق بعد موافقتها" defaultChecked={user.showTeams} />
            <Switch
              name="showInSearch"
              label="الظهور في بحث المنظمات"
              description="تستطيع الحسابات الموثّقة إيجادك بالاسم وبما اخترت إظهاره فقط"
              defaultChecked={user.showInSearch}
            />
          </>
        )}
        {user.verifiedKind ? (
          <>
            <input type="hidden" name="verified" value="1" />
            <Switch
              name="acceptsPublishRequests"
              label="استقبال طلبات النشر"
              description="يستطيع المستخدمون أن يطلبوا منك نشر مبادراتهم وحالاتهم"
              defaultChecked={user.acceptsPublishRequests}
            />
            <Switch
              name="hideRating"
              label="إخفاء تقييمي"
              description="يرى الناس «التقييم مخفي» بدل المعدّل"
              defaultChecked={user.hideRating}
            />
          </>
        ) : null}
      </div>
      <Button type="submit" variant="secondary" disabled={pending} className="mt-3">
        {pending ? "جارٍ الحفظ…" : "حفظ الخصوصية"}
      </Button>
    </form>
  );
}
