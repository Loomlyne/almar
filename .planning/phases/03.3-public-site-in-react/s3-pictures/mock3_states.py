# Throwaway design mock, round 3 (part B, 2026-10-14): the states of the Contact form box and of the footer
# newsletter that 11.4 left undrawn ("the form states other than empty are not drawn"). NOT application code.
# Look: mock2.py (signed 2026-10-04) plus the owner's 2026-10-13 rule: primary button teal fill + WHITE text,
# gold only as a line. Error colour and the 3 px bottom rule are tokens.json `error` / `rule-error`.
# Writes states-{en,ar,es}.html next to this file; shoot_states.mjs takes the 390/834/1440 shots.
# Text: EN live where the live site has it, every other line marked DRAFT in DRAFTS below.
import pathlib, importlib.util, sys, io

HERE = pathlib.Path(__file__).parent
spec = importlib.util.spec_from_file_location("mock2", HERE / "mock2.py")
m2 = importlib.util.module_from_spec(spec)
_out = sys.stdout; sys.stdout = io.StringIO(); spec.loader.exec_module(m2); sys.stdout = _out
R = m2.R

MAIL = "inquiries@almarprivatejourney.com"

S = {
    "en": dict(
        f_name="Your Name", f_phone="Phone / WhatsApp", f_mail="Email", f_type="Journey Type", f_placeholder="Select type",
        f_types=["Experiences", "Services", "Full Journey", "Group Event", "General Question"],
        f_msg="Tell Us About Your Journey", f_send="Request Consultation", wa_btn="Message on WhatsApp",
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
        f_msg="أخبرونا عن رحلتكم", f_send="اطلبوا استشارة", wa_btn="راسلونا على واتساب",
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
        f_msg="Cuéntanos sobre tu viaje", f_send="Solicita una consulta", wa_btn="Escríbenos por WhatsApp",
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
    "en": ["e_name", "e_mail_req", "e_mail_bad", "e_phone", "e_type", "e_msg", "e_long", "sent", "failed", "n_success", "n_failed"],
    "ar": ["e_name", "e_mail_req", "e_mail_bad", "e_phone", "e_type", "e_msg", "e_long", "sent", "failed", "n_success", "n_failed"],
    "es": ["f_name", "f_phone", "f_mail", "f_type", "f_placeholder", "f_types", "f_msg", "e_name", "e_mail_req", "e_mail_bad",
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
                assert "[object" not in x and "None" != x, (loc, k, x)
        assert len(t["st"]) == 11, loc
        assert len(t["f_types"]) == 5, loc
        assert MAIL in t["n_failed"] and t["failed"][1] == MAIL, loc


CSS = m2.CSS + """
.sheet{padding:32px 0 96px}.sheet h1{font-size:28px;margin:0 0 4px}.sheet .note{font-size:13px;color:var(--muted);margin:0 0 32px}
.grid{display:grid;gap:40px}@media(min-width:768px){.grid{grid-template-columns:1fr 1fr;gap:48px 32px}}
.cap{font:12px var(--fb);letter-spacing:var(--tk);text-transform:uppercase;margin:0 0 10px;color:var(--teal)}:lang(ar) .cap{text-transform:none;font-size:13px}
.btn.solid{color:#fff}
.f input,.f select,.f textarea{display:block}.f .v{height:48px;border:1px solid var(--teal);background:var(--ivory);padding:0 16px;font:16px var(--fb);display:flex;align-items:center;color:var(--teal)}
.f .v.ta{height:96px;align-items:flex-start;padding-top:12px}.f .v.ph{color:var(--muted)}.f .v.sel:after{content:'▾';margin-inline-start:auto}
.f .bad{box-shadow:inset 0 -3px 0 #8f2d2d}.err{margin:0;font-size:14px;color:#8f2d2d}
.star{color:var(--ink)}
.btn[aria-busy]{opacity:.85;cursor:progress}.spin{width:16px;height:16px;border:2px solid #fff;border-inline-end-color:transparent;display:inline-block}
.btn.out .spin{border-color:var(--teal);border-inline-end-color:transparent}
.dis{opacity:.6}
.alert{margin:0;font-size:14px;color:#8f2d2d;border-inline-start:3px solid #8f2d2d;padding-inline-start:12px}.alert a{color:var(--teal);text-decoration:underline}
.sentbox{border:1px solid var(--teal);padding:24px;min-height:200px;display:grid;align-content:center}@media(min-width:768px){.sentbox{padding:48px}}
.sentbox p{margin:0;font:22px var(--fd);color:var(--teal)}.sentbox p:focus{outline:2px solid var(--teal);outline-offset:6px}
.foot{border-top:1px solid var(--tint);padding:32px 0;max-width:340px}
.foot p.h{font-size:12px;margin:0 0 8px}.foot .ln{font-size:12px;margin:0 0 8px}.foot label{display:block;font-size:14px;margin:0 0 6px}
.foot .v{height:48px;border:1px solid var(--teal);background:var(--ivory);padding:0 16px;display:flex;align-items:center;font:16px var(--fb)}
.foot .v.bad{box-shadow:inset 0 -3px 0 #8f2d2d}.foot .row{margin:12px 0 0}
.toastwrap{position:relative;min-height:230px}.toast{position:absolute;inset-inline:0;bottom:0;margin:auto;width:max-content;max-width:100%;background:#fff;color:var(--ink);padding:8px 16px;display:flex;gap:8px;align-items:center;box-shadow:0 10px 24px rgb(38 38 38/.18)}
.toast .ok{width:16px;height:16px;border:2px solid #1e6b45}.toast .x{width:44px;height:44px;display:grid;place-items:center;color:var(--teal)}
"""


def lab(text, req):
    return f'<label>{text}{" <span class=star aria-hidden=true>*</span>" if req else ""}</label>'


def fld(t, key, req, val="", ph=False, bad=None, cls=""):
    v = val if val else ""
    c = "v" + (" ph" if ph else "") + (" bad" if bad else "") + (" " + cls if cls else "")
    err = f'<p class="err">{bad}</p>' if bad else ""
    return f'<div class="f">{lab(t[key], req)}<div class="{c}">{v}</div>{err}</div>'


def box(t, vals, errs=None, busy=False, alert=None):
    errs = errs or {}
    name = fld(t, "f_name", True, vals.get("name", ""), bad=errs.get("name"))
    phone = fld(t, "f_phone", False, vals.get("phone", ""), bad=errs.get("phone"))
    mail = fld(t, "f_mail", True, vals.get("mail", ""), bad=errs.get("mail"))
    typ = fld(t, "f_type", True, vals.get("type") or t["f_placeholder"], ph=not vals.get("type"), bad=errs.get("type"), cls="sel")
    msg = fld(t, "f_msg", True, vals.get("msg", ""), bad=errs.get("msg"), cls="ta")
    send = (f'<span class="btn solid" aria-busy="true"><span class="spin"></span>{t["f_send"]}</span>' if busy
            else f'<span class="btn solid">{t["f_send"]}</span>')
    al = ""
    if alert:
        a, mail_s, b, wa, c = t["failed"]
        al = f'<p class="alert" role="alert">{a}<a href="#"><bdi>{mail_s}</bdi></a>{b}<a href="#">{wa}</a>{c}</p>'
    return f"""<div class="box"><div class="f2">{name}{phone}</div>{mail}{typ}{msg}{al}
<div class="acts">{send}<a class="btn{' dis' if busy else ''}" href="#">{t['wa_btn']}</a></div></div>"""


def news(t, val="", bad=None, busy=False, failed=False):
    v = f'<div class="v{" bad" if bad else ""}">{val}</div>'
    line = f'<p class="err" role="alert" style="margin-top:8px">{bad}</p>' if bad else ""
    if failed:
        line = f'<p class="err" role="alert" style="margin-top:8px">{t["n_failed"]}</p>'
    btn = (f'<span class="btn out" aria-busy="true"><span class="spin"></span>{t["n_join"]}</span>' if busy
           else f'<span class="btn">{t["n_join"]}</span>')
    return f"""<div class="foot"><p class="h">{t['n_title']}</p><p class="ln">{t['n_line']}</p><label>{t['n_email']}</label>{v}{line}<p class="row">{btn}</p></div>"""


def sheet(loc):
    t = S[loc]
    full = dict(name=t["v_name"], mail=t["v_mail"], type=t["f_types"][2], msg=t["v_msg"])
    panels = [
        box(t, {}),
        box(t, {}, errs=dict(name=t["e_name"], mail=t["e_mail_req"], type=t["e_type"], msg=t["e_msg"])),
        box(t, dict(name=t["v_name"], phone=t["v_phone_bad"], mail=t["v_mail_bad"], type=t["f_types"][0], msg=t["v_long"]),
            errs=dict(phone=t["e_phone"], mail=t["e_mail_bad"], msg=t["e_long"])),
        box(t, full, busy=True),
        f'<div class="sentbox"><p role="status" tabindex="-1">{t["sent"]}</p></div>',
        box(t, full, alert=True),
        news(t),
        news(t, val=t["v_mail_bad"], bad=t["n_invalid"]),
        news(t, val=t["v_mail"], busy=True),
        news(t, val=t["v_mail"], failed=True),
        f'<div class="toastwrap">{news(t)}<div class="toast" role="status"><span class="ok"></span><span>{t["n_success"]}</span><span class="x" aria-label="x">✕</span></div></div>',
    ]
    cells = "".join(f'<section><p class="cap">{cap}</p>{p}</section>' for cap, p in zip(t["st"], panels))
    body = f'<main class="sheet"><div class="wrap"><h1>{t["sheet"]}</h1><p class="note">{t["note"]}</p><div class="grid">{cells}</div></div></main>'
    return m2.page(loc, body)


if __name__ == "__main__":
    check_strings()
    for loc in ("en", "ar", "es"):
        html = sheet(loc)
        assert "[object" not in html and "None" not in html, loc
        (HERE / f"states-{loc}.html").write_text(html, encoding="utf8")
    print("ok")
