// Plan 04-09: the dashboard Bookings list and booking detail copy (self-contained: a granted slot, deliberately not
// registered in lib/copy/index.ts).
//
// Strings marked CANVAS are taken verbatim from the design canvas boards (DashBookings, DashBookingDetailA,
// DashBookingDetailB) in all three languages. Every other EN string is new UI copy typed for the owner's review at the
// picture signature (04-09 Task 4). AR (Modern Standard Arabic) and ES (dashboard Spanish in formal "usted", owner
// 2026-10-14) are DRAFTS written from the EN for the owner's review, including "Pay-by date passed, part paid" and
// "Withdrawn by the guest" (revision 2).
// Never a price, a rate, a fee, a deadline, a person or a legal sentence: amounts, dates, names and reasons are
// `{token}`s filled with fillCopy (lib/copy/ops-kit.ts).

export type OpsBookingsLocale = "en" | "ar" | "es";

type StatusWords = {
  held: string;
  awaiting_payment: string;
  deposit_paid: string;
  paid_in_full: string;
  confirmed: string;
  completed: string;
  cancelled: string;
  expired: string;
};

type MailWords = { sent: string; pending: string; failed: string; none: string };

export type OpsBookingsCopy = {
  list: {
    title: string;
    search: string;
    searchHint: string;
    allStatuses: string;
    allDestinations: string;
    destination: string;
    /** The Select's spoken name, {name} = the chosen option. */
    statusPicked: string;
    destinationPicked: string;
    arriveFrom: string;
    arriveTo: string;
    arrival: string;
    showMore: string;
    loading: string;
    empty: string;
    noMatch: string;
    columns: { ref: string; guestDates: string; stay: string; status: string; paid: string; total: string };
    guests: string;
  };
  statuses: StatusWords;
  filters: { attention: string };
  flags: {
    test: string;
    needsAttention: string;
    partReceived: string;
    overpaid: string;
    writtenOff: string;
    balanceOverdue: string;
    deadlinePassed: string;
    deadlinePassedPartPaid: string;
    reasons: {
      paid_after_expiry: string;
      paid_after_cancel: string;
      overpaid: string;
      deadline_passed_part_paid: string;
    };
  };
  detail: {
    back: string;
    overview: string;
    payments: string;
    history: string;
    notes: string;
    latestNotes: string;
    stayDates: string;
    arrive: string;
    leave: string;
    nights: string;
    guest: string;
    email: string;
    phone: string;
    nationality: string;
    specialRequests: string;
    emergencyContact: string;
    adults: string;
    children: string;
    infants: string;
    language: string;
    languages: { en: string; ar: string; es: string };
    travellerKinds: { adult: string; child: string; infant: string };
    lineUnit: { person: string; night: string; trip: string };
    quantity: string;
    guests: string;
    travellers: string;
    booker: string;
    notStaying: string;
    age: string;
    airport: string;
    airports: { DXB: string; AUH: string; SHJ: string; none: string };
    pickupAddress: string;
    addOns: string;
    noAddOns: string;
    subtotal: string;
    vat: string;
    total: string;
    deposit: string;
    paid: string;
    writtenOff: string;
    dueNow: string;
    stillDue: string;
    payBy: string;
    balanceDueBy: string;
    madeOnSite: string;
    madeInDashboard: string;
    guestSees: string;
    uaeTime: string;
  };
  payments: {
    transactions: string;
    date: string;
    method: string;
    bankTransfer: string;
    card: string;
    reference: string;
    amount: string;
    recordedBy: string;
    actionsColumn: string;
    voided: string;
    writtenOff: string;
    none: string;
    receipt: MailWords;
    requestMail: MailWords;
    resendReceipt: string;
    resendRequest: string;
    resent: { sent: string; pending: string; failed: string };
  };
  actions: {
    recordPayment: string;
    void: string;
    confirm: string;
    complete: string;
    cancel: string;
    resolve: string;
    addNote: string;
    keep: string;
    back: string;
  };
  record: {
    title: string;
    amount: string;
    amountHint: string;
    amountDueHint: string;
    receivedOn: string;
    bankReference: string;
    acceptShort: string;
    acceptReason: string;
    review: string;
    back: string;
    record: string;
    line: string;
    becomes: string;
    stays: string;
    partReceived: string;
    writeOff: string;
    overpaid: string;
    deadBooking: string;
    nightsKept: string;
    partPaidHeld: string;
    clearsFlag: string;
    receipt: string;
    recorded: string;
  };
  void: {
    title: string;
    reason: string;
    line: string;
    becomes: string;
    stays: string;
    fresh: string;
    kept: string;
    untilDeadline: string;
    laterOf: string;
    unchanged: string;
    cleared: string;
    voided: string;
  };
  status: {
    confirm: { title: string; body: string };
    complete: { title: string; body: string };
    cancel: { title: string; body: string };
    cancelPaid: { title: string; body: string };
    changed: string;
  };
  notes: { label: string; placeholder: string; add: string; empty: string; added: string };
  attention: { title: string; body: string; note: string; resolve: string; resolved: string };
  history: {
    actors: { owner: string; system: string; guest: string };
    by: string;
    created: string;
    status: string;
    hold_expired: string;
    request_sent: string;
    payment_recorded: string;
    payment_voided: string;
    note_added: string;
    needs_attention: string;
    attention_resolved: string;
    resend_requested: string;
    request_withdrawn: string;
    email_sent: string;
    email_pending: string;
    email_failed: string;
    fallback: string;
  };
  templates: {
    request_received: string;
    request_owner: string;
    payment_receipt: string;
    payment_owner: string;
    request_lapsed: string;
    request_withdrawn_owner: string;
  };
  errors: {
    amount: string;
    date: string;
    reference: string;
    reason: string;
    note: string;
    attentionNote: string;
    changed: string;
    not_found: string;
    not_allowed: string;
    not_requested: string;
    not_applicable: string;
    nothing_to_write_off: string;
    not_voidable: string;
    cancel_first: string;
    window_missing: string;
    nights_lost: string;
    loadFailed: string;
    listFailed: string;
    saveFailed: string;
  };
};

export const OPS_BOOKINGS_COPY: Record<OpsBookingsLocale, OpsBookingsCopy> = {
  en: {
    list: {
      title: "Bookings", // CANVAS
      search: "Search", // CANVAS
      searchHint: "Reference, guest name or email",
      allStatuses: "All statuses", // CANVAS
      allDestinations: "All destinations", // CANVAS
      destination: "Destination",
      statusPicked: "Status: {name}",
      destinationPicked: "Destination: {name}",
      arriveFrom: "Arrival from",
      arriveTo: "Arrival to",
      arrival: "Arrival dates",
      showMore: "Show more",
      loading: "Loading bookings…",
      empty: "No bookings yet", // CANVAS
      noMatch: "No booking matches these filters.",
      columns: {
        ref: "Ref", // CANVAS
        guestDates: "Guest and dates", // CANVAS
        stay: "Stay", // CANVAS
        status: "Status", // CANVAS
        paid: "Paid", // CANVAS
        total: "Total", // CANVAS
      },
      guests: "{count} guests",
    },
    statuses: {
      held: "Held",
      awaiting_payment: "Awaiting payment",
      deposit_paid: "Deposit paid", // CANVAS
      paid_in_full: "Paid in full",
      confirmed: "Confirmed", // CANVAS
      completed: "Completed", // CANVAS
      cancelled: "Cancelled",
      expired: "Expired",
    },
    filters: { attention: "Needs attention" },
    flags: {
      test: "TEST",
      needsAttention: "Needs attention",
      partReceived: "Part received",
      overpaid: "Overpaid",
      writtenOff: "Written off {amount}",
      balanceOverdue: "Balance overdue",
      deadlinePassed: "Deadline passed",
      deadlinePassedPartPaid: "Pay-by date passed, part paid",
      reasons: {
        paid_after_expiry:
          "Money arrived after the request expired. The nights were not taken back: re-book or refund from your bank.",
        paid_after_cancel:
          "Money arrived after the booking was cancelled. The nights were not taken back: re-book or refund from your bank.",
        overpaid: "More money than the total was received. Check it with the guest; refunds are made from your bank.",
        deadline_passed_part_paid:
          "Pay-by date passed, part paid. The nights stay held until you act: record the rest, cancel the booking, or resolve this.",
      },
    },
    detail: {
      back: "All bookings",
      overview: "Overview", // CANVAS
      payments: "Payments", // CANVAS
      history: "History", // CANVAS
      notes: "Notes", // CANVAS
      latestNotes: "Latest notes", // CANVAS
      stayDates: "Stay and dates", // CANVAS
      arrive: "Arrive", // CANVAS
      leave: "Leave", // CANVAS
      nights: "Nights", // CANVAS
      guest: "Guest", // CANVAS
      email: "Email",
      phone: "Phone",
      nationality: "Nationality",
      specialRequests: "Special requests",
      emergencyContact: "Emergency contact",
      adults: "Adults",
      children: "Children",
      infants: "Infants",
      language: "Language",
      languages: { en: "English", ar: "العربية", es: "Español" }, // each language in its own name, the same in every locale
      travellerKinds: { adult: "Adult", child: "Child", infant: "Infant" },
      lineUnit: { person: "per person", night: "per night", trip: "per trip" },
      quantity: "Quantity",
      guests: "Guests", // CANVAS
      travellers: "Travellers",
      booker: "Booker",
      notStaying: "Not staying",
      age: "Age",
      airport: "Airport",
      airports: { DXB: "Dubai (DXB)", AUH: "Abu Dhabi (AUH)", SHJ: "Sharjah (SHJ)", none: "Not chosen" },
      pickupAddress: "Pickup address",
      addOns: "Add-ons",
      noAddOns: "No add-ons",
      subtotal: "Subtotal", // CANVAS
      vat: "VAT {rate}%", // CANVAS, [RATE] as a token
      total: "Total", // CANVAS
      deposit: "Deposit",
      paid: "Paid", // CANVAS
      writtenOff: "Written off",
      dueNow: "Due now",
      stillDue: "Still due",
      payBy: "Pay by {date}",
      balanceDueBy: "Balance due by", // CANVAS
      madeOnSite: "Made on the website",
      madeInDashboard: "Made in the dashboard",
      guestSees: "What the guest sees",
      uaeTime: " UAE time",
    },
    payments: {
      transactions: "Transactions", // CANVAS
      date: "Date", // CANVAS
      method: "Method", // CANVAS
      bankTransfer: "Bank transfer", // CANVAS
      card: "Card", // CANVAS
      reference: "Reference", // CANVAS
      amount: "Amount", // CANVAS
      recordedBy: "Recorded by",
      actionsColumn: "Actions", // the payments table's last column, read by screen readers only
      voided: "Voided: {reason}",
      writtenOff: "Written off {amount}: {reason}",
      none: "No payment recorded yet.",
      receipt: {
        sent: "Receipt sent",
        pending: "Receipt not sent yet: the email sender is not set up",
        failed: "Receipt not sent: the email failed",
        none: "Receipt not sent",
      },
      requestMail: {
        sent: "Request email sent",
        pending: "Request email not sent yet: the email sender is not set up",
        failed: "Request email not sent: the email failed",
        none: "Request email not sent",
      },
      resendReceipt: "Resend receipt",
      resendRequest: "Resend request email",
      resent: {
        sent: "Sent again.",
        pending: "Not sent yet: the email sender is not set up.",
        failed: "Not sent: the email failed. Try again.",
      },
    },
    actions: {
      recordPayment: "Record payment", // CANVAS
      void: "Void",
      confirm: "Confirm",
      complete: "Mark completed",
      cancel: "Cancel booking",
      resolve: "Resolve",
      addNote: "Add note",
      keep: "Keep booking",
      back: "Back",
    },
    record: {
      title: "Record payment", // CANVAS
      amount: "Amount received (AED)",
      amountHint: "As it arrived in your bank, like 1050 or 1,050.50.",
      amountDueHint: "{hint} {label}: {amount}",
      receivedOn: "Date received",
      bankReference: "Bank reference",
      acceptShort: "Accept as paid",
      acceptReason: "Reason",
      review: "Review",
      back: "Back",
      record: "Record",
      line: "Record {amount} received on {date}, bank reference {reference}.",
      becomes: "The booking becomes {status}.",
      stays: "The status stays {status}.",
      partReceived: "Part received: {due} still due by {deadline}.",
      writeOff: "{gap} short is written off: {reason}.",
      overpaid: "{extra} more than the total is kept and flagged Overpaid.",
      deadBooking: "This booking is {status}: the money is recorded and flagged for you. The nights are not taken back.",
      nightsKept: "Its nights are kept for good.",
      partPaidHeld: "Part paid: the nights stay held until you act, even after the pay-by date.",
      clearsFlag: "This clears the flag Pay-by date passed, part paid.",
      receipt: "The guest is emailed a receipt.",
      recorded: "Payment recorded.",
    },
    void: {
      title: "Void this payment?",
      reason: "Reason",
      line: "The payment stays in the list, struck through, with your reason. Nothing is deleted.",
      becomes: "The booking becomes {status}.",
      stays: "The status stays {status}.",
      fresh: "It is back to Awaiting payment with a new pay-by date: the transfer window from now.",
      kept: "The nights stay held.",
      untilDeadline: "The nights are held until then.",
      laterOf:
        "No payment is left: it is an unpaid request again. Its pay-by date becomes the later of {deadline} and the transfer window from now.",
      unchanged: "The pay-by date {deadline} stays.",
      cleared: "The Needs attention flag is cleared.",
      voided: "Payment voided.",
    },
    status: {
      confirm: {
        title: "Confirm this booking?",
        body: "The guest's booking page will show the exact address and stay access. No email is sent.",
      },
      complete: {
        title: "Mark this booking completed?",
        body: "The booking is marked as done and no action is left on it. No email is sent.",
      },
      cancel: {
        title: "Cancel this booking?",
        body: "The request ends and the nights are freed. No email is sent: tell the guest yourself.",
      },
      cancelPaid: {
        title: "Cancel this booking?",
        body: "The booking ends and the nights are freed. {paid} already received stays recorded. Refunds are made from your bank. No email is sent: tell the guest yourself.",
      },
      changed: "Status changed.",
    },
    notes: {
      label: "Internal note",
      placeholder: "[Internal note]", // CANVAS, scenes only
      add: "Add note",
      empty: "No notes yet.",
      added: "Note added.",
    },
    attention: {
      title: "Resolve Needs attention",
      body: "Say what you did. Your note is kept with the booking and the flag is cleared.",
      note: "Note",
      resolve: "Resolve",
      resolved: "Needs attention resolved.",
    },
    history: {
      actors: { owner: "Owner", system: "System", guest: "Guest" }, // CANVAS Owner, System
      by: "{action}, by {who}",
      created: "Booking created", // CANVAS
      status: "Status changed to {status}", // CANVAS, status as a token
      hold_expired: "Expired: the time to pay ran out and the nights were freed",
      request_sent: "Request sent by the guest",
      payment_recorded: "Payment recorded: {amount}",
      payment_voided: "Payment voided: {amount}",
      note_added: "Internal note added", // CANVAS
      needs_attention: "Flagged: needs attention",
      attention_resolved: "Needs attention resolved",
      resend_requested: "Resend asked: {template}",
      request_withdrawn: "Withdrawn by the guest",
      email_sent: "{template} sent",
      email_pending: "{template} not sent yet",
      email_failed: "{template} not sent: the email failed",
      fallback: "Change recorded",
    },
    templates: {
      request_received: "Request email",
      request_owner: "Owner notice",
      payment_receipt: "Receipt",
      payment_owner: "Owner payment notice",
      request_lapsed: "Lapse email",
      request_withdrawn_owner: "Owner withdrawal notice",
    },
    errors: {
      amount: "Type the amount received in AED, like 1050 or 1,050.50.",
      date: "Use a date from {first} to today.",
      reference: "Type the bank reference (up to 100 characters).",
      reason: "Type a reason of 3 to 300 characters.",
      note: "Type a note of up to 2,000 characters.",
      attentionNote: "Type a note of 3 to 500 characters.",
      changed: "This booking changed. It has been reloaded: check it and try again.",
      not_found: "No booking has this reference.",
      not_allowed: "This step is not possible from the booking's current status. It has been reloaded.",
      not_requested: "The guest has not sent this request yet, so no payment can be recorded.",
      not_applicable: "Accept as paid does not apply to a booking with this status.",
      nothing_to_write_off: "Nothing is short: the amount covers what is due, so there is nothing to write off.",
      not_voidable: "This payment cannot be voided: only a recorded bank transfer can.",
      cancel_first: "Cancel the booking first: a confirmed booking cannot drop below its deposit.",
      window_missing: "Set the transfer window in Settings first.",
      nights_lost: "The nights could not be kept. Nothing was recorded.",
      loadFailed: "The booking could not be loaded. Reload the page.",
      listFailed: "The bookings could not be loaded. Reload the page.",
      saveFailed: "This was not saved. Try again.",
    },
  },

  ar: {
    list: {
      title: "الحجوزات",
      search: "بحث",
      searchHint: "المرجع أو اسم الضيف أو البريد الإلكتروني",
      allStatuses: "كل الحالات",
      allDestinations: "كل الوجهات",
      destination: "الوجهة",
      statusPicked: "الحالة: {name}",
      destinationPicked: "الوجهة: {name}",
      arriveFrom: "الوصول من",
      arriveTo: "الوصول حتى",
      arrival: "تواريخ الوصول",
      showMore: "عرض المزيد",
      loading: "جارٍ تحميل الحجوزات…",
      empty: "لا حجوزات بعد",
      noMatch: "لا يطابق أي حجز عوامل التصفية هذه.",
      columns: {
        ref: "المرجع",
        guestDates: "الضيف والتواريخ",
        stay: "الإقامة",
        status: "الحالة",
        paid: "المدفوع",
        total: "الإجمالي",
      },
      guests: "{count} ضيوف",
    },
    statuses: {
      held: "محجوز مؤقتًا",
      awaiting_payment: "بانتظار الدفع",
      deposit_paid: "تم دفع المقدّم",
      paid_in_full: "مدفوع بالكامل",
      confirmed: "مؤكد",
      completed: "مكتمل",
      cancelled: "ملغى",
      expired: "منتهي",
    },
    filters: { attention: "يحتاج إلى متابعة" },
    flags: {
      test: "TEST",
      needsAttention: "يحتاج إلى متابعة",
      partReceived: "استُلم جزء",
      overpaid: "مدفوع بزيادة",
      writtenOff: "مشطوب {amount}",
      balanceOverdue: "الرصيد متأخر",
      deadlinePassed: "انقضى الموعد",
      deadlinePassedPartPaid: "انقضى موعد الدفع، ودُفع جزء",
      reasons: {
        paid_after_expiry: "وصل المبلغ بعد انتهاء الطلب. لم تُستعد الليالي: أعد الحجز أو ردّ المبلغ من مصرفك.",
        paid_after_cancel: "وصل المبلغ بعد إلغاء الحجز. لم تُستعد الليالي: أعد الحجز أو ردّ المبلغ من مصرفك.",
        overpaid: "استُلم مبلغ أكبر من الإجمالي. راجع الأمر مع الضيف؛ تُردّ المبالغ من مصرفك.",
        deadline_passed_part_paid:
          "انقضى موعد الدفع، ودُفع جزء. تبقى الليالي محجوزة حتى تتخذ إجراءً: سجّل الباقي، أو ألغِ الحجز، أو عالج هذا التنبيه.",
      },
    },
    detail: {
      back: "كل الحجوزات",
      overview: "نظرة عامة",
      payments: "المدفوعات",
      history: "السجل",
      notes: "الملاحظات",
      latestNotes: "آخر الملاحظات",
      stayDates: "الإقامة والتواريخ",
      arrive: "وصول",
      leave: "مغادرة",
      nights: "الليالي",
      guest: "الضيف",
      email: "البريد الإلكتروني",
      phone: "الهاتف",
      nationality: "الجنسية",
      specialRequests: "طلبات خاصة",
      emergencyContact: "جهة الاتصال في الطوارئ",
      adults: "البالغون",
      children: "الأطفال",
      infants: "الرضّع",
      language: "اللغة",
      languages: { en: "English", ar: "العربية", es: "Español" }, // each language in its own name, the same in every locale
      travellerKinds: { adult: "بالغ", child: "طفل", infant: "رضيع" },
      lineUnit: { person: "للشخص", night: "لليلة", trip: "للرحلة" },
      quantity: "الكمية",
      guests: "الضيوف",
      travellers: "المسافرون",
      booker: "صاحب الحجز",
      notStaying: "لا يقيم",
      age: "العمر",
      airport: "المطار",
      airports: { DXB: "دبي (DXB)", AUH: "أبوظبي (AUH)", SHJ: "الشارقة (SHJ)", none: "لم يُختر" },
      pickupAddress: "عنوان الاستقبال",
      addOns: "الإضافات",
      noAddOns: "لا إضافات",
      subtotal: "المجموع الفرعي",
      vat: "ضريبة القيمة المضافة {rate}٪",
      total: "الإجمالي",
      deposit: "الدفعة المقدّمة",
      paid: "المدفوع",
      writtenOff: "المشطوب",
      dueNow: "المستحق الآن",
      stillDue: "المتبقي",
      payBy: "الدفع قبل {date}",
      balanceDueBy: "الرصيد مستحق قبل",
      madeOnSite: "أُجري على الموقع",
      madeInDashboard: "أُجري من لوحة التحكم",
      guestSees: "ما يراه الضيف",
      uaeTime: " بتوقيت الإمارات",
    },
    payments: {
      transactions: "المعاملات",
      date: "التاريخ",
      method: "الطريقة",
      bankTransfer: "تحويل مصرفي",
      card: "بطاقة",
      reference: "المرجع",
      amount: "المبلغ",
      recordedBy: "سجّلها",
      actionsColumn: "الإجراءات", // the payments table's last column, read by screen readers only
      voided: "أُلغيت: {reason}",
      writtenOff: "مشطوب {amount}: {reason}",
      none: "لم تُسجَّل أي دفعة بعد.",
      receipt: {
        sent: "أُرسل الإيصال",
        pending: "لم يُرسل الإيصال بعد: مُرسِل البريد غير مُعدّ",
        failed: "لم يُرسل الإيصال: فشل البريد",
        none: "لم يُرسل الإيصال",
      },
      requestMail: {
        sent: "أُرسل بريد الطلب",
        pending: "لم يُرسل بريد الطلب بعد: مُرسِل البريد غير مُعدّ",
        failed: "لم يُرسل بريد الطلب: فشل البريد",
        none: "لم يُرسل بريد الطلب",
      },
      resendReceipt: "إعادة إرسال الإيصال",
      resendRequest: "إعادة إرسال بريد الطلب",
      resent: {
        sent: "أُرسل مرة أخرى.",
        pending: "لم يُرسل بعد: مُرسِل البريد غير مُعدّ.",
        failed: "لم يُرسل: فشل البريد. حاول مرة أخرى.",
      },
    },
    actions: {
      recordPayment: "تسجيل دفعة",
      void: "إلغاء الدفعة",
      confirm: "تأكيد",
      complete: "وضع علامة مكتمل",
      cancel: "إلغاء الحجز",
      resolve: "معالجة",
      addNote: "إضافة ملاحظة",
      keep: "الإبقاء على الحجز",
      back: "رجوع",
    },
    record: {
      title: "تسجيل دفعة",
      amount: "المبلغ المستلم (درهم)",
      amountHint: "كما وصل إلى مصرفك، مثل 1050 أو 1,050.50.",
      amountDueHint: "{hint} {label}: {amount}",
      receivedOn: "تاريخ الاستلام",
      bankReference: "مرجع التحويل",
      acceptShort: "قبول كمدفوع",
      acceptReason: "السبب",
      review: "مراجعة",
      back: "رجوع",
      record: "تسجيل",
      line: "تسجيل {amount} مستلم في {date}، مرجع التحويل {reference}.",
      becomes: "يصبح الحجز {status}.",
      stays: "تبقى الحالة {status}.",
      partReceived: "استُلم جزء: يبقى {due} مستحقًا قبل {deadline}.",
      writeOff: "يُشطب النقص {gap}: {reason}.",
      overpaid: "يُحتفظ بمبلغ {extra} الزائد عن الإجمالي ويُعلَّم مدفوعًا بزيادة.",
      deadBooking: "هذا الحجز {status}: يُسجَّل المبلغ ويُعلَّم لك. لا تُستعاد الليالي.",
      nightsKept: "تبقى لياليه محجوزة نهائيًا.",
      partPaidHeld: "دُفع جزء: تبقى الليالي محجوزة حتى تتخذ إجراءً، حتى بعد موعد الدفع.",
      clearsFlag: "يزيل هذا تنبيه: انقضى موعد الدفع، ودُفع جزء.",
      receipt: "يُرسل إلى الضيف إيصال بالبريد.",
      recorded: "سُجّلت الدفعة.",
    },
    void: {
      title: "إلغاء هذه الدفعة؟",
      reason: "السبب",
      line: "تبقى الدفعة في القائمة مشطوبة مع سببك. لا يُحذف شيء.",
      becomes: "يصبح الحجز {status}.",
      stays: "تبقى الحالة {status}.",
      fresh: "يعود إلى بانتظار الدفع بموعد دفع جديد: مهلة التحويل من الآن.",
      kept: "تبقى الليالي محجوزة.",
      untilDeadline: "تبقى الليالي محجوزة حتى ذلك الموعد.",
      laterOf: "لم تبقَ أي دفعة: عاد طلبًا غير مدفوع. يصبح موعد الدفع الأبعد بين {deadline} ومهلة التحويل من الآن.",
      unchanged: "يبقى موعد الدفع {deadline}.",
      cleared: "أُزيل تنبيه يحتاج إلى متابعة.",
      voided: "أُلغيت الدفعة.",
    },
    status: {
      confirm: {
        title: "تأكيد هذا الحجز؟",
        body: "ستعرض صفحة حجز الضيف العنوان الدقيق وطريقة الوصول إلى الإقامة. لا يُرسل أي بريد.",
      },
      complete: {
        title: "وضع علامة مكتمل على هذا الحجز؟",
        body: "يُعلَّم الحجز منتهيًا ولا يبقى عليه أي إجراء. لا يُرسل أي بريد.",
      },
      cancel: {
        title: "إلغاء هذا الحجز؟",
        body: "ينتهي الطلب وتُحرَّر الليالي. لا يُرسل أي بريد: أبلغ الضيف بنفسك.",
      },
      cancelPaid: {
        title: "إلغاء هذا الحجز؟",
        body: "ينتهي الحجز وتُحرَّر الليالي. يبقى {paid} المستلم مسجلًا. تُردّ المبالغ من مصرفك. لا يُرسل أي بريد: أبلغ الضيف بنفسك.",
      },
      changed: "تم تغيير الحالة.",
    },
    notes: {
      label: "ملاحظة داخلية",
      placeholder: "[ملاحظة داخلية]",
      add: "إضافة ملاحظة",
      empty: "لا ملاحظات بعد.",
      added: "أُضيفت الملاحظة.",
    },
    attention: {
      title: "معالجة تنبيه يحتاج إلى متابعة",
      body: "اذكر ما فعلته. تُحفظ ملاحظتك مع الحجز ويُزال التنبيه.",
      note: "ملاحظة",
      resolve: "معالجة",
      resolved: "عولج التنبيه.",
    },
    history: {
      actors: { owner: "المالك", system: "النظام", guest: "الضيف" },
      by: "{action}، بواسطة {who}",
      created: "أُنشئ الحجز",
      status: "تغيّرت الحالة إلى {status}",
      hold_expired: "انتهى: انقضى وقت الدفع وحُرّرت الليالي",
      request_sent: "أرسل الضيف الطلب",
      payment_recorded: "سُجّلت دفعة: {amount}",
      payment_voided: "أُلغيت دفعة: {amount}",
      note_added: "أُضيفت ملاحظة داخلية",
      needs_attention: "عُلّم: يحتاج إلى متابعة",
      attention_resolved: "عولج تنبيه المتابعة",
      resend_requested: "طُلبت إعادة الإرسال: {template}",
      request_withdrawn: "سحبه الضيف",
      email_sent: "أُرسل {template}",
      email_pending: "لم يُرسل {template} بعد",
      email_failed: "لم يُرسل {template}: فشل البريد",
      fallback: "سُجّل تغيير",
    },
    templates: {
      request_received: "بريد الطلب",
      request_owner: "إشعار المالك",
      payment_receipt: "الإيصال",
      payment_owner: "إشعار الدفع للمالك",
      request_lapsed: "بريد انتهاء الطلب",
      request_withdrawn_owner: "إشعار السحب للمالك",
    },
    errors: {
      amount: "اكتب المبلغ المستلم بالدرهم، مثل 1050 أو 1,050.50.",
      date: "استخدم تاريخًا من {first} حتى اليوم.",
      reference: "اكتب مرجع التحويل (حتى 100 حرف).",
      reason: "اكتب سببًا من 3 إلى 300 حرف.",
      note: "اكتب ملاحظة حتى 2,000 حرف.",
      attentionNote: "اكتب ملاحظة من 3 إلى 500 حرف.",
      changed: "تغيّر هذا الحجز. أُعيد تحميله: راجعه وحاول مرة أخرى.",
      not_found: "لا يوجد حجز بهذا المرجع.",
      not_allowed: "لا يمكن تنفيذ هذه الخطوة من حالة الحجز الحالية. أُعيد تحميله.",
      not_requested: "لم يُرسل الضيف هذا الطلب بعد، لذا لا يمكن تسجيل دفعة.",
      not_applicable: "لا ينطبق القبول كمدفوع على حجز بهذه الحالة.",
      nothing_to_write_off: "لا نقص: المبلغ يغطي المستحق، فلا شيء يُشطب.",
      not_voidable: "لا يمكن إلغاء هذه الدفعة: يمكن إلغاء التحويل المصرفي المسجل فقط.",
      cancel_first: "ألغِ الحجز أولًا: لا يمكن أن ينزل حجز مؤكد عن دفعته المقدّمة.",
      window_missing: "حدّد مهلة التحويل في الإعدادات أولًا.",
      nights_lost: "تعذّر الإبقاء على الليالي. لم يُسجَّل شيء.",
      loadFailed: "تعذّر تحميل الحجز. أعد تحميل الصفحة.",
      listFailed: "تعذّر تحميل الحجوزات. أعد تحميل الصفحة.",
      saveFailed: "لم يُحفظ هذا. حاول مرة أخرى.",
    },
  },

  es: {
    list: {
      title: "Reservas",
      search: "Buscar",
      searchHint: "Referencia, nombre del huésped o correo",
      allStatuses: "Todos los estados",
      allDestinations: "Todos los destinos",
      destination: "Destino",
      statusPicked: "Estado: {name}",
      destinationPicked: "Destino: {name}",
      arriveFrom: "Llegada desde",
      arriveTo: "Llegada hasta",
      arrival: "Fechas de llegada",
      showMore: "Mostrar más",
      loading: "Cargando reservas…",
      empty: "Aún no hay reservas",
      noMatch: "Ninguna reserva coincide con estos filtros.",
      columns: {
        ref: "Ref.",
        guestDates: "Huésped y fechas",
        stay: "Estancia",
        status: "Estado",
        paid: "Pagado",
        total: "Total",
      },
      guests: "{count} huéspedes",
    },
    statuses: {
      held: "Retenido",
      awaiting_payment: "Pendiente de pago",
      deposit_paid: "Depósito pagado",
      paid_in_full: "Pagado en su totalidad",
      confirmed: "Confirmado",
      completed: "Completado",
      cancelled: "Cancelado",
      expired: "Vencido",
    },
    filters: { attention: "Requiere atención" },
    flags: {
      test: "TEST",
      needsAttention: "Requiere atención",
      partReceived: "Pago parcial recibido",
      overpaid: "Pago en exceso",
      writtenOff: "Condonado {amount}",
      balanceOverdue: "Saldo vencido",
      deadlinePassed: "Plazo vencido",
      deadlinePassedPartPaid: "Fecha límite de pago vencida, pago parcial",
      reasons: {
        paid_after_expiry:
          "El dinero llegó después de que la solicitud venciera. Las noches no se recuperaron: vuelva a reservar o reembolse desde su banco.",
        paid_after_cancel:
          "El dinero llegó después de cancelar la reserva. Las noches no se recuperaron: vuelva a reservar o reembolse desde su banco.",
        overpaid: "Se recibió más dinero que el total. Revíselo con el huésped; los reembolsos se hacen desde su banco.",
        deadline_passed_part_paid:
          "Fecha límite de pago vencida, pago parcial. Las noches siguen retenidas hasta que usted actúe: registre el resto, cancele la reserva o resuelva este aviso.",
      },
    },
    detail: {
      back: "Todas las reservas",
      overview: "Resumen",
      payments: "Pagos",
      history: "Historial",
      notes: "Notas",
      latestNotes: "Últimas notas",
      stayDates: "Estancia y fechas",
      arrive: "Llegada",
      leave: "Salida",
      nights: "Noches",
      guest: "Huésped",
      email: "Correo",
      phone: "Teléfono",
      nationality: "Nacionalidad",
      specialRequests: "Peticiones especiales",
      emergencyContact: "Contacto de emergencia",
      adults: "Adultos",
      children: "Niños",
      infants: "Bebés",
      language: "Idioma",
      languages: { en: "English", ar: "العربية", es: "Español" }, // each language in its own name, the same in every locale
      travellerKinds: { adult: "Adulto", child: "Niño", infant: "Bebé" },
      lineUnit: { person: "por persona", night: "por noche", trip: "por trayecto" },
      quantity: "Cantidad",
      guests: "Huéspedes",
      travellers: "Viajeros",
      booker: "Titular de la reserva",
      notStaying: "No se aloja",
      age: "Edad",
      airport: "Aeropuerto",
      airports: { DXB: "Dubái (DXB)", AUH: "Abu Dabi (AUH)", SHJ: "Sharjah (SHJ)", none: "Sin elegir" },
      pickupAddress: "Dirección de recogida",
      addOns: "Extras",
      noAddOns: "Sin extras",
      subtotal: "Subtotal",
      vat: "IVA {rate} %",
      total: "Total",
      deposit: "Depósito",
      paid: "Pagado",
      writtenOff: "Condonado",
      dueNow: "A pagar ahora",
      stillDue: "Pendiente",
      payBy: "Pagar antes del {date}",
      balanceDueBy: "Saldo pendiente antes del",
      madeOnSite: "Hecha en el sitio web",
      madeInDashboard: "Hecha en el panel",
      guestSees: "Lo que ve el huésped",
      uaeTime: " hora de los EAU",
    },
    payments: {
      transactions: "Transacciones",
      date: "Fecha",
      method: "Método",
      bankTransfer: "Transferencia",
      card: "Tarjeta",
      reference: "Referencia",
      amount: "Importe",
      recordedBy: "Registrado por",
      actionsColumn: "Acciones", // the payments table's last column, read by screen readers only
      voided: "Anulado: {reason}",
      writtenOff: "Condonado {amount}: {reason}",
      none: "Aún no hay pagos registrados.",
      receipt: {
        sent: "Recibo enviado",
        pending: "Recibo aún no enviado: el envío de correo no está configurado",
        failed: "Recibo no enviado: el correo falló",
        none: "Recibo no enviado",
      },
      requestMail: {
        sent: "Correo de la solicitud enviado",
        pending: "Correo de la solicitud aún no enviado: el envío de correo no está configurado",
        failed: "Correo de la solicitud no enviado: el correo falló",
        none: "Correo de la solicitud no enviado",
      },
      resendReceipt: "Reenviar recibo",
      resendRequest: "Reenviar correo de la solicitud",
      resent: {
        sent: "Enviado de nuevo.",
        pending: "Aún no enviado: el envío de correo no está configurado.",
        failed: "No enviado: el correo falló. Inténtelo de nuevo.",
      },
    },
    actions: {
      recordPayment: "Registrar pago",
      void: "Anular",
      confirm: "Confirmar",
      complete: "Marcar como completada",
      cancel: "Cancelar reserva",
      resolve: "Resolver",
      addNote: "Añadir nota",
      keep: "Mantener reserva",
      back: "Volver",
    },
    record: {
      title: "Registrar pago",
      amount: "Importe recibido (AED)",
      amountHint: "Tal como llegó a su banco, por ejemplo 1050 o 1,050.50.",
      amountDueHint: "{hint} {label}: {amount}",
      receivedOn: "Fecha de recepción",
      bankReference: "Referencia bancaria",
      acceptShort: "Aceptar como pagado",
      acceptReason: "Motivo",
      review: "Revisar",
      back: "Volver",
      record: "Registrar",
      line: "Registrar {amount} recibido el {date}, referencia bancaria {reference}.",
      becomes: "La reserva pasa a {status}.",
      stays: "El estado sigue en {status}.",
      partReceived: "Pago parcial recibido: quedan {due} por pagar antes del {deadline}.",
      writeOff: "Se condona la diferencia de {gap}: {reason}.",
      overpaid: "Se conservan {extra} por encima del total y se marca Pago en exceso.",
      deadBooking: "El estado de esta reserva es {status}: el dinero se registra y se marca para usted. Las noches no se recuperan.",
      nightsKept: "Sus noches quedan reservadas de forma definitiva.",
      partPaidHeld: "Pago parcial: las noches siguen retenidas hasta que usted actúe, incluso después de la fecha límite de pago.",
      clearsFlag: "Esto quita el aviso Fecha límite de pago vencida, pago parcial.",
      receipt: "Se envía un recibo al huésped por correo.",
      recorded: "Pago registrado.",
    },
    void: {
      title: "¿Anular este pago?",
      reason: "Motivo",
      line: "El pago sigue en la lista, tachado, con su motivo. No se elimina nada.",
      becomes: "La reserva pasa a {status}.",
      stays: "El estado sigue en {status}.",
      fresh: "Vuelve a Pendiente de pago con una nueva fecha límite de pago: el plazo de transferencia desde ahora.",
      kept: "Las noches siguen retenidas.",
      untilDeadline: "Las noches quedan retenidas hasta entonces.",
      laterOf:
        "No queda ningún pago: vuelve a ser una solicitud sin pagar. Su fecha límite de pago pasa a ser la más tardía entre {deadline} y el plazo de transferencia desde ahora.",
      unchanged: "La fecha límite de pago {deadline} se mantiene.",
      cleared: "Se quita el aviso Requiere atención.",
      voided: "Pago anulado.",
    },
    status: {
      confirm: {
        title: "¿Confirmar esta reserva?",
        body: "La página de la reserva del huésped mostrará la dirección exacta y el acceso a la estancia. No se envía ningún correo.",
      },
      complete: {
        title: "¿Marcar esta reserva como completada?",
        body: "La reserva queda marcada como terminada y no queda ninguna acción pendiente. No se envía ningún correo.",
      },
      cancel: {
        title: "¿Cancelar esta reserva?",
        body: "La solicitud termina y las noches quedan libres. No se envía ningún correo: avise usted al huésped.",
      },
      cancelPaid: {
        title: "¿Cancelar esta reserva?",
        body: "La reserva termina y las noches quedan libres. Los {paid} ya recibidos siguen registrados. Los reembolsos se hacen desde su banco. No se envía ningún correo: avise usted al huésped.",
      },
      changed: "Estado cambiado.",
    },
    notes: {
      label: "Nota interna",
      placeholder: "[Nota interna]",
      add: "Añadir nota",
      empty: "Aún no hay notas.",
      added: "Nota añadida.",
    },
    attention: {
      title: "Resolver Requiere atención",
      body: "Indique qué hizo. Su nota se guarda con la reserva y se quita el aviso.",
      note: "Nota",
      resolve: "Resolver",
      resolved: "Aviso resuelto.",
    },
    history: {
      actors: { owner: "Propietario", system: "Sistema", guest: "Huésped" },
      by: "{action}, por {who}",
      created: "Reserva creada",
      status: "Estado cambiado a {status}",
      hold_expired: "Vencida: terminó el tiempo para pagar y las noches quedaron libres",
      request_sent: "Solicitud enviada por el huésped",
      payment_recorded: "Pago registrado: {amount}",
      payment_voided: "Pago anulado: {amount}",
      note_added: "Nota interna añadida",
      needs_attention: "Marcada: requiere atención",
      attention_resolved: "Aviso resuelto",
      resend_requested: "Reenvío solicitado: {template}",
      request_withdrawn: "Retirada por el huésped",
      email_sent: "{template} enviado",
      email_pending: "{template} aún no enviado",
      email_failed: "{template} no enviado: el correo falló",
      fallback: "Cambio registrado",
    },
    templates: {
      request_received: "Correo de la solicitud",
      request_owner: "Aviso al propietario",
      payment_receipt: "Recibo",
      payment_owner: "Aviso de pago al propietario",
      request_lapsed: "Correo de vencimiento",
      request_withdrawn_owner: "Aviso de retirada al propietario",
    },
    errors: {
      amount: "Escriba el importe recibido en AED, por ejemplo 1050 o 1,050.50.",
      date: "Use una fecha entre el {first} y hoy.",
      reference: "Escriba la referencia bancaria (hasta 100 caracteres).",
      reason: "Escriba un motivo de 3 a 300 caracteres.",
      note: "Escriba una nota de hasta 2.000 caracteres.",
      attentionNote: "Escriba una nota de 3 a 500 caracteres.",
      changed: "Esta reserva cambió. Se ha vuelto a cargar: revísela e inténtelo de nuevo.",
      not_found: "Ninguna reserva tiene esta referencia.",
      not_allowed: "Este paso no es posible desde el estado actual de la reserva. Se ha vuelto a cargar.",
      not_requested: "El huésped aún no ha enviado esta solicitud, así que no se puede registrar ningún pago.",
      not_applicable: "Aceptar como pagado no se aplica a una reserva con este estado.",
      nothing_to_write_off: "No falta nada: el importe cubre lo pendiente, así que no hay nada que condonar.",
      not_voidable: "Este pago no se puede anular: solo se puede anular una transferencia registrada.",
      cancel_first: "Cancele primero la reserva: una reserva confirmada no puede quedar por debajo de su depósito.",
      window_missing: "Defina primero el plazo de transferencia en Ajustes.",
      nights_lost: "No se pudieron conservar las noches. No se registró nada.",
      loadFailed: "No se pudo cargar la reserva. Vuelva a cargar la página.",
      listFailed: "No se pudieron cargar las reservas. Vuelva a cargar la página.",
      saveFailed: "No se guardó. Inténtelo de nuevo.",
    },
  },
};
