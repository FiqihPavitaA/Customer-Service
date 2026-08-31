/* Warna label ACTION — nilai diambil dari .tag-* di ai.css/dashboard.css
   agar tampilannya sama dengan halaman lama. */

export const ACTION_TAG: Record<string, string> = {
  AUTO_REPLY: "bg-green-mint text-green-dark",
  ASK_INFORMATION: "bg-[#fef3c7] text-[#92400e]",
  HANDOVER_TO_CS: "bg-[#fee2e2] text-[#b91c1c]",
  CHECK_ORDER_SYSTEM: "bg-[#dbeafe] text-[#1e40af]",
};

export function actionTagClass(action: string): string {
  return ACTION_TAG[action] ?? ACTION_TAG.AUTO_REPLY;
}
