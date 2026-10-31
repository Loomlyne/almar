// Plan 05-03 (PAY-12, B-31, B-25): the words of the refund block, the Record refund dialog and the Void refund dialog on
// the booking detail. Loaded only with the lazy chunk (booking-refunds.tsx): no import here and nothing registers it in
// lib/copy/index.ts, so the eager dashboard bundle never carries it. EN is the signed draft of the plan. AR and ES are
// MODEL-TRANSLATED DRAFTS for the owner's check; dashboard Spanish is "usted" (owner, 2026-10-14).
// A refund is recorded, never sent: no sentence here reads as if the site moves money. Amounts, dates, references and
// reasons are `{token}`s filled with fillCopy (lib/copy/ops-kit.ts); the only numbers typed are the 1050 examples.

export type OpsRefundsLocale = "en" | "ar" | "es";

export type OpsRefundsCopy = {
  heading: string;
  dateRefunded: string;
  resend: string;
  /** "{reason}". */
  reasonLine: string;
  record: {
    intro: string;
    amount: string;
    /** "{amount}": what is left to refund. */
    amountHint: string;
    reason: string;
    /** "{amount}", "{date}", "{reference}". */
    line: string;
    /** "{paid}", "{refunded}", "{net}". */
    money: string;
    /** "{amount}". */
    stillDue: string;
    overpaid: string;
    guest: string;
    noMoney: string;
  };
  void: {
    title: string;
    line: string;
    /** "{refunded}". */
    money: string;
    guest: string;
  };
};

export const OPS_REFUNDS_COPY: Record<OpsRefundsLocale, OpsRefundsCopy> = {
  en: {
    heading: "Refunds",
    dateRefunded: "Date refunded",
    resend: "Resend refund email",
    reasonLine: "Reason: {reason}",
    record: {
      intro: "Record a refund you already made from your bank. This does not send any money.",
      amount: "Amount refunded (AED)",
      amountHint: "As it left your bank, like 1050 or 1,050.50. Left to refund: {amount}",
      reason: "Reason (optional)",
      line: "Record a refund of {amount}, made from your bank on {date}, bank reference {reference}.",
      money: "Paid stays {paid}. Refunded becomes {refunded}. Net received becomes {net}.",
      stillDue: "Still due does not change: {amount}.",
      overpaid: "The Overpaid flag stays: what was kept is still above the total.",
      guest: "The guest is emailed, and the booking page shows the date and amount. Never the reference or the reason.",
      noMoney: "This only records it. No money moves from here.",
    },
    void: {
      title: "Void this refund record?",
      line: "The record stays in the list, struck through, with your reason. Nothing is deleted. No money moves.",
      money: "Refunded becomes {refunded}.",
      guest: "The guest's booking page stops showing it. No email is sent: tell the guest yourself.",
    },
  },
  ar: {
    heading: "الاستردادات",
    dateRefunded: "تاريخ الاسترداد",
    resend: "إعادة إرسال بريد الاسترداد",
    reasonLine: "السبب: {reason}",
    record: {
      intro: "سجّل استردادًا أجريته بالفعل من حسابك المصرفي. لا يُرسل هذا أي مبلغ.",
      amount: "المبلغ المسترد (درهم)",
      amountHint: "كما خرج من حسابك المصرفي، مثل 1050 أو 1,050.50. المتبقي للاسترداد: {amount}",
      reason: "السبب (اختياري)",
      line: "سجّل استردادًا بمبلغ {amount}، أُجري من حسابك المصرفي في {date}، مرجع التحويل {reference}.",
      money: "يبقى المدفوع {paid}. يصبح المُسترد {refunded}. يصبح الصافي المستلم {net}.",
      stillDue: "لا يتغير المستحق: {amount}.",
      overpaid: "تبقى علامة الدفع الزائد: ما زال المبلغ المحتفظ به أعلى من الإجمالي.",
      guest: "يصل الضيف بريد، وتعرض صفحة الحجز التاريخ والمبلغ فقط، دون المرجع أو السبب.",
      noMoney: "هذا تسجيل فقط. لا يتحرك أي مبلغ من هنا.",
    },
    void: {
      title: "إلغاء سجل الاسترداد هذا؟",
      line: "يبقى السجل في القائمة مشطوبًا مع سببك. لا يُحذف شيء ولا يتحرك أي مبلغ.",
      money: "يصبح المُسترد {refunded}.",
      guest: "تتوقف صفحة حجز الضيف عن عرضه. لا يُرسل أي بريد: أخبر الضيف بنفسك.",
    },
  },
  es: {
    heading: "Reembolsos",
    dateRefunded: "Fecha del reembolso",
    resend: "Reenviar correo de reembolso",
    reasonLine: "Motivo: {reason}",
    record: {
      intro: "Registre un reembolso que ya hizo desde su banco. Esto no envía dinero.",
      amount: "Importe reembolsado (AED)",
      amountHint: "Tal como salió de su banco, por ejemplo 1050 o 1,050.50. Queda por reembolsar: {amount}",
      reason: "Motivo (opcional)",
      line: "Registrar un reembolso de {amount}, hecho desde su banco el {date}, referencia bancaria {reference}.",
      money: "Pagado sigue en {paid}. Reembolsado pasa a {refunded}. Neto recibido pasa a {net}.",
      stillDue: "Lo pendiente no cambia: {amount}.",
      overpaid: "La marca de pago en exceso sigue: lo retenido aún supera el total.",
      guest: "El huésped recibe un correo y la página de la reserva muestra la fecha y el importe, nunca la referencia ni el motivo.",
      noMoney: "Esto solo lo registra. Desde aquí no se mueve dinero.",
    },
    void: {
      title: "¿Anular este registro de reembolso?",
      line: "El registro sigue en la lista, tachado, con su motivo. No se borra nada y no se mueve dinero.",
      money: "Reembolsado pasa a {refunded}.",
      guest: "La página de la reserva del huésped deja de mostrarlo. No se envía ningún correo: avise usted al huésped.",
    },
  },
};
