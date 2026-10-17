# Part B pictures (2026-10-14, round 2 after the controller's review): the strings of the Contact form box and
# footer newsletter states that 11.4 left undrawn. NOT application code. This file holds the strings and checks
# that every label is a string; it writes partb-states.json, which partb-states.scene.tsx renders with the REAL
# components on main (Field, Select, Button, Link, Divider, the toast card's classes) through the dev harness.
# shoot_states.mjs copies the scene into tests/journey/scenes for the shoot only and removes it after.
# Text: EN live where the live site has it, every other line marked DRAFT in DRAFTS below.
import pathlib, json

HERE = pathlib.Path(__file__).parent

MAIL = "inquiries@almarprivatejourney.com"

S = {
    "en": dict(
        f_name="Your Name", f_phone="Phone / WhatsApp", f_mail="Email", f_type="Journey Type", f_placeholder="Select type",
        f_types=["Experiences", "Services", "Full Journey", "Group Event", "General Question"],
        f_msg="Tell Us About Your Journey", f_send="Request Consultation", sending="Sending…", wa_btn="Message on WhatsApp",
        e_name="Enter your name.", e_mail_req="Enter your email address.", e_mail_bad="Check the email address.",
        e_phone="Check the phone number.", e_type="Choose a journey type.", e_msg="Write a few words about your journey.",
        e_long="Keep this under 4000 characters.",
        sent="Your message was sent.",
        failed=("It did not send. Write to ", MAIL, " or message us on ", "WhatsApp", "."),
        n_title="Newsletter", n_line="Private Colombia inspiration, delivered to your inbox.", n_email="Email",
        n_join="Join the List", n_invalid="Enter an email as name@example.com.", n_success="You're on the list.",
        n_failed=f"You were not added. Please try again, or write to {MAIL}.",
        st=["1 · Empty", "2 · Pressed with nothing filled", "3 · Filled wrong", "4 · Sending", "5 · Sent", "6 · Did not send",
            "7 · Newsletter, empty", "8 · Newsletter, bad address", "9 · Newsletter, sending", "10 · Newsletter, did not send",
            "11 · Newsletter, added (toast)"],
        sheet="Contact form and footer newsletter: every state", note="Throwaway mock, not the built page. Values typed by a guest are in brackets.",
        v_name="[Guest name]", v_mail_bad="[guest@]", v_phone_bad="[call me]", v_mail="[guest@example.com]", v_msg="[A few lines about the trip]",
        v_long="[4,012 characters]",
    ),
    "ar": dict(
        f_name="الاسم", f_phone="الهاتف / واتساب", f_mail="البريد الإلكتروني", f_type="نوع الرحلة", f_placeholder="اختاروا النوع",
        f_types=["تجارب", "خدمات", "رحلة كاملة", "فعالية جماعية", "سؤال عام"],
        f_msg="أخبرونا عن رحلتكم", f_send="اطلبوا استشارة", sending="جارٍ الإرسال…", wa_btn="راسلونا على واتساب",
        e_name="أدخلوا اسمكم.", e_mail_req="أدخلوا بريدكم الإلكتروني.", e_mail_bad="تحقّقوا من البريد الإلكتروني.",
        e_phone="تحقّقوا من رقم الهاتف.", e_type="اختاروا نوع الرحلة.", e_msg="اكتبوا بضع كلمات عن رحلتكم.",
        e_long="لا تتجاوزوا 4000 حرف.",
        sent="أُرسلت رسالتكم.",
        failed=("لم تُرسَل الرسالة. راسلونا على ", MAIL, " أو على ", "واتساب", "."),
        n_title="النشرة", n_line="إلهام خاص عن كولومبيا، يصل إلى بريدكم.", n_email="البريد",
        n_join="انضموا إلى القائمة", n_invalid="أدخلوا بريداً بصيغة name@example.com.", n_success="أنتم على القائمة الآن.",
        n_failed=f"لم تتم إضافتكم. حاولوا مرة أخرى، أو راسلونا على {MAIL}.",
        st=["1 · فارغ", "2 · ضغط دون تعبئة", "3 · تعبئة خاطئة", "4 · جارٍ الإرسال", "5 · أُرسل", "6 · لم يُرسل",
            "7 · النشرة، فارغة", "8 · النشرة، عنوان خاطئ", "9 · النشرة، جارٍ الإرسال", "10 · النشرة، لم تتم الإضافة",
            "11 · النشرة، تمت الإضافة (إشعار)"],
        sheet="نموذج التواصل والنشرة في التذييل: كل الحالات", note="نموذج مؤقت، ليس الصفحة المبنية. ما يكتبه الضيف بين قوسين.",
        v_name="[اسم الضيف]", v_mail_bad="[guest@]", v_phone_bad="[اتصلوا بي]", v_mail="[guest@example.com]", v_msg="[بضعة أسطر عن الرحلة]",
        v_long="[4012 حرفاً]",
    ),
    "es": dict(
        f_name="Tu nombre", f_phone="Teléfono / WhatsApp", f_mail="Correo electrónico", f_type="Tipo de viaje", f_placeholder="Elige el tipo",
        f_types=["Experiencias", "Servicios", "Viaje completo", "Evento de grupo", "Pregunta general"],
        f_msg="Cuéntanos sobre tu viaje", f_send="Solicita una consulta", sending="Enviando…", wa_btn="Escríbenos por WhatsApp",
        e_name="Escribe tu nombre.", e_mail_req="Escribe tu correo electrónico.", e_mail_bad="Revisa el correo electrónico.",
        e_phone="Revisa el número de teléfono.", e_type="Elige un tipo de viaje.", e_msg="Escribe unas palabras sobre tu viaje.",
        e_long="Usa menos de 4000 caracteres.",
        sent="Tu mensaje se envió.",
        failed=("No se envió. Escribe a ", MAIL, " o escríbenos por ", "WhatsApp", "."),
        n_title="Boletín", n_line="Inspiración privada sobre Colombia, en tu bandeja de entrada.", n_email="Correo",
        n_join="Unirse a la lista", n_invalid="Escribe un correo como name@example.com.", n_success="Ya estás en la lista.",
        n_failed=f"No te agregamos. Inténtalo de nuevo o escribe a {MAIL}.",
        st=["1 · Vacío", "2 · Enviado sin rellenar", "3 · Rellenado mal", "4 · Enviando", "5 · Enviado", "6 · No se envió",
            "7 · Boletín, vacío", "8 · Boletín, correo mal escrito", "9 · Boletín, enviando", "10 · Boletín, no se agregó",
            "11 · Boletín, agregado (aviso)"],
        sheet="Formulario de contacto y boletín del pie: todos los estados", note="Maqueta desechable, no la página construida. Lo que escribe el huésped va entre corchetes.",
        v_name="[Nombre del huésped]", v_mail_bad="[guest@]", v_phone_bad="[llámame]", v_mail="[guest@example.com]", v_msg="[Unas líneas sobre el viaje]",
        v_long="[4012 caracteres]",
    ),
}

# Every line below is DRAFT (not on the live site, not yet signed). Printed by the hand-over report.
DRAFTS = {
    "en": ["sending", "e_name", "e_mail_req", "e_mail_bad", "e_phone", "e_type", "e_msg", "e_long", "sent", "failed", "n_success", "n_failed"],
    "ar": ["sending", "e_name", "e_mail_req", "e_mail_bad", "e_phone", "e_type", "e_msg", "e_long", "sent", "failed", "n_success", "n_failed"],
    "es": ["sending", "f_name", "f_phone", "f_mail", "f_type", "f_placeholder", "f_types", "f_msg", "e_name", "e_mail_req", "e_mail_bad",
           "e_phone", "e_type", "e_msg", "e_long", "sent", "failed", "n_line", "n_invalid", "n_success", "n_failed"],
}


def check_strings():
    """Every label is a string (03.2-12 lesson: a duplicate key printed "[object Object]")."""
    keys = set(S["en"])
    for loc, t in S.items():
        assert set(t) == keys, (loc, set(t) ^ keys)
        for k, v in t.items():
            items = v if isinstance(v, (list, tuple)) else [v]
            assert items, (loc, k)
            for x in items:
                assert isinstance(x, str) and x.strip(), (loc, k, x)
                assert "[object" not in x and x != "None", (loc, k, x)
        assert len(t["st"]) == 11, loc
        assert len(t["f_types"]) == 5, loc
        assert MAIL in t["n_failed"] and t["failed"][1] == MAIL, loc



if __name__ == "__main__":
    check_strings()
    out = {loc: {**t, "drafts": DRAFTS[loc]} for loc, t in S.items()}
    (HERE / "partb-states.json").write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf8")
    print("ok")
