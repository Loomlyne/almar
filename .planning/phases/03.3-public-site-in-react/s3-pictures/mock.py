# Throwaway design mock for Phase 3.3 slice 3 (About, Contact). NOT application code.
# Writes about-en.html, about-ar.html, contact-en.html, contact-ar.html next to this file.
# Values copy tokens.json by hand; the built pages use the real components (03.3-S3-DESIGN.md).
# EN is the live text verbatim. AR is a DRAFT for the owner's review.
import pathlib

HERE = pathlib.Path(__file__).parent
R = "../../../../"  # repo root from this folder
IMG = R + "public/assets/img/"

T = {
    "en": dict(
        nav=["Destinations", "Experiences", "About", "Contact"], lang="EN", menu="Menu",
        a_kicker="Our Story", a_h1="Your Private Colombia",
        a_statement="ALMAR Private Journeys is a luxury travel agency created for travellers who want to experience Colombia with privacy, careful planning, and high standards of service.",
        story_h="Our Story", story_i="From Colombia, with love — and a mission to make every journey safe, pleasant, and unforgettable.",
        story=[("Designed with Heart", "Every ALMAR journey reflects our commitment to personalised planning, selected local partners, and experiences shaped around each client."),
               ("Bridging Curiosity & Confidence", "ALMAR was founded by a Colombian who spent years guiding international executives across the Gulf and beyond—watching them fall in love with Colombia, then pull back from fear. We answered with all-inclusive private packages: private driver, in-villa chef, 24-hour assistance, handpicked villas, and curated culture. That bridge became our mission."),
               ("A Vision That Grows", "Our long-term vision: direct villa and luxury car partnerships across Colombia, then Latin America — earning trust as the reference for safety-led luxury travel throughout the region.")],
        values_h="Our Values", values_i="What we believe in shapes every stay.",
        values=[("Intentional Hospitality", "We believe great service should feel natural, never forced. Every team member is empowered to create moments that matter - from a warm greeting to a handwritten note."),
                ("Bilingual Trip Support", "Bilingual trip coordination and a 24/7 emergency contact are planned around each confirmed journey."),
                ("Privacy & Discreet Coordination", "Private transfer coordination, discreet planning, and specialist support can be arranged around each client and confirmed before booking.")],
        git_h="Get In Touch", git_i="Your private Colombia journey begins with a conversation. Share your vision and our team will design a safety-led, fully bespoke experience.", git_cta="Begin Your Journey",
        c_kicker="Private Journeys", c_h1="Plan Your Journey",
        c_intro="Your private Colombia journey begins with a message. Share your vision and our team will craft every detail.",
        biz="ALMAR Private Journeys", l_loc="Location", loc="Bogotá, Colombia", l_line="Inquiry line", l_wa="WhatsApp", l_mail="Email",
        wa_btn="Message on WhatsApp",
        f_title="Tell us about your journey", f_name="Your Name", f_phone="Phone / WhatsApp", f_mail="Email", f_type="Journey Type",
        f_types=["Select type", "Experiences", "Services", "Full Journey", "Group Event", "General Question"],
        f_msg="Tell Us About Your Journey", f_send="Request Consultation", req="required",
        conf_h="Travel With Confidence", conf_i="Every journey is planned with selected local partners, private transfer coordination, bilingual trip support, and a 24/7 emergency contact. Additional security, insurance, and medical arrangements are confirmed before booking.",
        conf_cta="Start Your Inquiry",
        ft_pages="Pages", ft_contact="Contact", ft_news="Newsletter", ft_news_line="Private Colombia inspiration, delivered to your inbox.",
        ft_email="Email", ft_join="Join the List", ft_copy="© 2026 ALMAR Private Journeys. All rights reserved.",
    ),
    "ar": dict(
        nav=["الوجهات", "التجارب", "عنّا", "تواصل"], lang="العربية", menu="القائمة",
        a_kicker="قصتنا", a_h1="كولومبيا الخاصة بك",
        a_statement="ALMAR Private Journeys وكالة سفر فاخرة أُنشئت للمسافرين الذين يريدون اكتشاف كولومبيا بخصوصية وتخطيط دقيق ومعايير خدمة رفيعة.",
        story_h="قصتنا", story_i="من كولومبيا بكل حب، ومهمتنا أن تكون كل رحلة آمنة وممتعة ولا تُنسى.",
        story=[("صُمّمت من القلب", "تعكس كل رحلة مع ALMAR التزامنا بالتخطيط الشخصي، وشركاء محليين مختارين، وتجارب تُصاغ حول كل عميل."),
               ("جسر بين الفضول والثقة", "أسّس ALMAR كولومبيٌّ أمضى سنوات يرافق مسؤولين تنفيذيين دوليين في الخليج وخارجه، ورآهم يقعون في حب كولومبيا ثم يتراجعون خوفاً. فكان ردّنا باقات خاصة شاملة: سائق خاص، وطاهٍ في الفيلا، ومساعدة على مدار الساعة، وفلل مختارة بعناية، وثقافة منتقاة. ذلك الجسر صار رسالتنا."),
               ("رؤية تنمو", "رؤيتنا على المدى البعيد: شراكات مباشرة مع الفلل والسيارات الفاخرة في أنحاء كولومبيا ثم أمريكا اللاتينية، لنكسب الثقة مرجعاً للسفر الفاخر القائم على الأمان في المنطقة كلها.")],
        values_h="قيمنا", values_i="ما نؤمن به يصوغ كل إقامة.",
        values=[("ضيافة مقصودة", "نؤمن بأن الخدمة الرائعة تبدو طبيعية لا متكلّفة. كل فرد في فريقنا مخوّل لصنع لحظات تهمّ، من ترحيب دافئ إلى رسالة بخط اليد."),
                ("دعم ثنائي اللغة للرحلة", "يُخطَّط لكل رحلة مؤكَّدة تنسيقٌ بلغتين ورقمُ طوارئ على مدار الساعة."),
                ("الخصوصية والتنسيق المتحفّظ", "يمكن ترتيب تنسيق التنقلات الخاصة والتخطيط المتحفّظ والدعم المتخصص حول كل عميل، وتأكيدها قبل الحجز.")],
        git_h="تواصل معنا", git_i="تبدأ رحلتكم الخاصة في كولومبيا بحديث. شاركونا رؤيتكم وسيصمّم فريقنا تجربة مفصّلة بالكامل تضع الأمان أولاً.", git_cta="ابدأوا رحلتكم",
        c_kicker="رحلات خاصة", c_h1="خطط لرحلتك",
        c_intro="تبدأ رحلتكم الخاصة في كولومبيا برسالة. شاركونا رؤيتكم وسيعتني فريقنا بكل تفصيل.",
        biz="ALMAR Private Journeys", l_loc="الموقع", loc="بوغوتا، كولومبيا", l_line="خط الاستفسارات", l_wa="واتساب", l_mail="البريد الإلكتروني",
        wa_btn="راسلونا على واتساب",
        f_title="أخبرونا عن رحلتكم", f_name="الاسم", f_phone="الهاتف / واتساب", f_mail="البريد الإلكتروني", f_type="نوع الرحلة",
        f_types=["اختاروا النوع", "تجارب", "خدمات", "رحلة كاملة", "فعالية جماعية", "سؤال عام"],
        f_msg="أخبرونا عن رحلتكم", f_send="اطلبوا استشارة", req="مطلوب",
        conf_h="سافر بثقة", conf_i="تُخطَّط كل رحلة مع شركاء محليين مختارين، وتنسيق للتنقلات الخاصة، ودعم ثنائي اللغة، ورقم طوارئ على مدار الساعة. وتُؤكَّد ترتيبات الأمن والتأمين والرعاية الطبية الإضافية قبل الحجز.",
        conf_cta="ابدأوا استفساركم",
        ft_pages="الصفحات", ft_contact="تواصل", ft_news="النشرة", ft_news_line="إلهام خاص عن كولومبيا، يصل إلى بريدكم.",
        ft_email="البريد", ft_join="انضموا إلى القائمة", ft_copy="© 2026 ALMAR Private Journeys. جميع الحقوق محفوظة.",
    ),
}

CSS = """
@font-face{font-family:Questa;src:url('{R}brand/Font/questa-webfont/2-Questa_Regular.woff') format('woff')}
@font-face{font-family:Lato;src:url('{R}brand/Font/lato/Lato-Regular.ttf');font-weight:400}
@font-face{font-family:Lato;src:url('{R}brand/Font/lato/Lato-Bold.ttf');font-weight:700}
:root{--ivory:#fffaf0;--surface:#fff;--teal:#1f3b40;--tint:#d1dfe0;--gold:#d4ba8a;--ink:#262626;--muted:#63615f;--line:rgb(38 38 38/.16);--wa:#25D366;
--fd:Questa,Georgia,serif;--fb:Lato,Arial,sans-serif;--lh:1.5;--lht:1.3;--lhh:1.2;--lhd:1.1;--lhx:1.05;--tk:.12em}
:lang(ar){--fd:'Noto Naskh Arabic',Questa,Georgia,serif;--fb:'Noto Sans Arabic',Lato,Arial,sans-serif;--lh:1.7;--lht:1.5;--lhh:1.4;--lhd:1.3;--lhx:1.25;--tk:normal}
*{box-sizing:border-box}html,body{margin:0}body{background:var(--ivory);color:var(--ink);font:16px/var(--lh) var(--fb)}
a{color:inherit}.wrap{max-width:1240px;margin:0 auto;padding:0 16px}@media(min-width:768px){.wrap{padding:0 32px}}
.kick{font-size:12px;text-transform:uppercase;letter-spacing:var(--tk);color:var(--muted);margin:0}:lang(ar) .kick{text-transform:none}
h1,h2,h3{font-family:var(--fd);font-weight:400;color:var(--teal);margin:0}
.h-hero{font-size:40px;line-height:var(--lhx)}@media(min-width:768px){.h-hero{font-size:64px}}
.h-disp{font-size:32px;line-height:var(--lhd)}@media(min-width:768px){.h-disp{font-size:48px}}
.h-head{font-size:24px;line-height:var(--lhh)}@media(min-width:768px){.h-head{font-size:32px}}
.h-title{font-size:20px;line-height:var(--lht)}
/* nav */
.nav{height:72px;border-bottom:1px solid var(--line);background:var(--ivory)}@media(min-width:768px){.nav{height:80px}}@media(min-width:1152px){.nav{height:96px}}
.nav .wrap{height:100%;display:flex;align-items:center;gap:24px}.nav img{width:112px;max-height:56px;object-fit:contain;object-position:left}:lang(ar) .nav img{object-position:right}@media(min-width:1152px){.nav img{width:150px}}
.nav.on{position:absolute;inset-inline:0;top:0;background:transparent;border-color:transparent;color:var(--ivory);z-index:2}
.links{display:none;gap:32px}.links a{font-size:12px;text-transform:uppercase;letter-spacing:var(--tk);text-decoration:none;min-height:44px;display:inline-flex;align-items:center}
:lang(ar) .links a{text-transform:none;font-size:14px}.links a.cur{text-decoration:underline;text-decoration-thickness:2px;text-underline-offset:6px}
.sel{margin-inline-start:auto;height:44px;padding:0 16px;border:1px solid currentColor;display:none;align-items:center;gap:8px;font-size:14px}
.menu{margin-inline-start:auto;height:44px;padding:0 16px;border:1px solid currentColor;display:inline-flex;align-items:center;font-size:14px}
@media(min-width:1152px){.links{display:flex}.sel{display:inline-flex}.menu{display:none}}
/* section */
.sec{padding-top:48px}.head{border-top:2px solid var(--gold);padding-top:24px;max-width:768px;display:grid;gap:12px}
.head p.i{margin:0;max-width:65ch}
.grid3{display:grid;gap:32px;grid-template-columns:1fr;margin-top:24px}@media(min-width:768px){.grid3{grid-template-columns:repeat(2,1fr)}}@media(min-width:1280px){.grid3{grid-template-columns:repeat(3,1fr)}}
.card{display:grid;gap:12px;align-content:start}.card img{width:100%;aspect-ratio:4/3;object-fit:cover;outline:1px solid var(--line);outline-offset:-1px;display:block}
.card p{margin:0}
.hero{position:relative;height:640px;overflow:hidden}@media(min-width:1280px){.hero{height:720px}}
.hero>img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}.hero:after{content:'';position:absolute;inset:0;background:rgb(38 38 38/.4)}
.hero .wrap{position:relative;z-index:1;height:100%;display:flex;flex-direction:column;justify-content:flex-end;padding-bottom:64px;gap:12px}
.hero .kick{color:var(--ivory)}.hero h1{color:var(--ivory)}
.intro{display:grid;gap:24px;justify-items:center;text-align:center;padding-top:64px}.intro .mono{width:96px;opacity:.9}.intro p{max-width:46ch;margin:0;font-family:var(--fd);font-size:20px;line-height:var(--lht);color:var(--teal)}
.strip{display:grid;gap:12px;grid-template-columns:repeat(2,1fr);width:100%}@media(min-width:768px){.strip{grid-template-columns:repeat(3,1fr)}}@media(min-width:1280px){.strip{grid-template-columns:repeat(5,1fr)}}
.strip img{width:100%;aspect-ratio:3/4;object-fit:cover;display:block}.still{width:100%;aspect-ratio:16/9;object-fit:cover;display:block}
.cta{color:var(--teal);text-decoration:underline;text-decoration-color:var(--gold);text-underline-offset:4px;font-size:14px;text-transform:uppercase;letter-spacing:var(--tk);min-height:44px;display:inline-flex;align-items:center;gap:8px}
:lang(ar) .cta{text-transform:none}
/* contact */
.two{display:grid;gap:48px;margin-top:24px}@media(min-width:768px){.two{grid-template-columns:1fr 1fr}}@media(min-width:1280px){.two{grid-template-columns:5fr 7fr;gap:80px}}
dl{margin:0}.row{display:flex;justify-content:space-between;gap:16px;min-height:44px;align-items:center;border-bottom:1px solid var(--line)}
.row dt{font-size:14px;color:var(--muted)}.row dd{margin:0;text-align:end}.row a{text-decoration:none}bdi{unicode-bidi:isolate}
.btn{height:44px;padding:0 24px;background:var(--teal);color:var(--ivory);border:1px solid var(--teal);font:14px var(--fb);text-transform:uppercase;letter-spacing:var(--tk);display:inline-flex;align-items:center;gap:8px;text-decoration:none;width:max-content}
:lang(ar) .btn{text-transform:none}.btn.sec2{background:transparent;color:var(--teal)}
form{display:grid;gap:16px;background:var(--surface);padding:24px;border:1px solid var(--line)}@media(min-width:768px){form{padding:32px}}
.f{display:grid;gap:8px}.f label{font-size:14px}.f input,.f select,.f textarea{height:44px;border:1px solid var(--ink);background:var(--surface);padding:0 16px;font:16px var(--fb);width:100%;border-radius:0;color:var(--ink)}
.f textarea{height:120px;padding:12px 16px}.f2{display:grid;gap:16px}@media(min-width:1280px){.f2{grid-template-columns:1fr 1fr}}
.req{color:var(--muted);font-size:12px}
/* footer */
footer{margin-top:96px;background:var(--teal);color:var(--ivory);padding:48px 0}footer .brand{font-family:Questa,Georgia,serif;font-size:32px;letter-spacing:var(--tk);border-bottom:1px solid var(--ivory);padding-bottom:24px;margin-bottom:32px}
.cols{display:grid;gap:32px}@media(min-width:672px){.cols{grid-template-columns:repeat(3,1fr)}}.cols p.h{font-size:12px;text-transform:uppercase;letter-spacing:var(--tk);margin:0 0 8px}:lang(ar) .cols p.h{text-transform:none}
.cols a{display:flex;min-height:44px;align-items:center;text-decoration:underline;text-underline-offset:4px}
.news{display:grid;gap:8px}.news .in{display:flex;gap:12px;flex-wrap:wrap}.news input{flex:1 1 160px;height:44px;border:1px solid var(--ivory);background:var(--surface);padding:0 16px;font:16px var(--fb)}
.news .btn{border-color:var(--ivory)}.bot{margin-top:32px;border-top:1px solid var(--ivory);padding-top:24px;display:flex;flex-wrap:wrap;justify-content:space-between;gap:16px;font-size:14px}
.wa{position:fixed;inset-inline-end:16px;bottom:16px;width:44px;height:44px;background:var(--wa);display:grid;place-items:center;z-index:5}
"""


def nav(t, on, cur):
    logo = R + ("brand/Logo Typography/Poly_White.svg" if on else "brand/Logo Typography/Stacked_Charcoal.svg")
    links = "".join(f'<a class="{"cur" if i == cur else ""}" href="#">{x}</a>' for i, x in enumerate(t["nav"]))
    return f'<header class="nav{" on" if on else ""}"><div class="wrap"><img src="{logo}" alt="ALMAR"><nav class="links">{links}</nav><span class="sel">{t["lang"]} ▾</span><span class="menu">{t["menu"]}</span></div></header>'


def footer(t):
    pages = "".join(f'<a href="#">{x}</a>' for x in t["nav"])
    return f"""<footer><div class="wrap"><div class="brand">ALMAR</div><div class="cols">
<nav><p class="h">{t['ft_pages']}</p>{pages}</nav>
<address style="font-style:normal"><p class="h">{t['ft_contact']}</p><a href="#"><bdi>inquiries@almarprivatejourney.com</bdi></a><a href="#"><bdi>+971 56 388 3302</bdi></a><a href="#">Instagram</a></address>
<form class="news" style="background:none;border:0;padding:0"><p class="h">{t['ft_news']}</p><span style="font-size:14px">{t['ft_news_line']}</span>
<label style="font-size:14px">{t['ft_email']}</label><div class="in"><input type="email"><span class="btn">{t['ft_join']}</span></div></form>
</div><div class="bot"><span>English · العربية · Español</span><span>{t['ft_copy']}</span></div></div></footer>
<a class="wa" aria-label="WhatsApp"><svg width="24" height="24" viewBox="0 0 24 24"><path fill="#262626" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2z"/></svg></a>"""


def page(loc, title, body):
    d = "rtl" if loc == "ar" else "ltr"
    fonts = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Naskh+Arabic&family=Noto+Sans+Arabic:wght@400;700&display=swap">' if loc == "ar" else ""
    return f'<!doctype html><html lang="{loc}" dir="{d}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>{title}</title>{fonts}<style>{CSS.replace("{R}", R)}</style></head><body>{body}</body></html>'


def about(loc):
    t = T[loc]
    cards = lambda items, imgs: "".join(f'<article class="card"><img src="{IMG}{i}.webp" alt=""><h3 class="h-title">{a}</h3><p>{b}</p></article>' for (a, b), i in zip(items, imgs))
    strip = "".join(f'<img src="{IMG}{i}.webp" alt="">' for i in ["18c236478045dd34", "bfe105a629dcc096", "8ddf86c5dd7c51fe", "15368278ab019a18", "8941b742928820e1"])
    body = f"""{nav(t, True, 2)}
<main><section class="hero"><img src="{IMG}8487db9c4571064d.webp" alt=""><div class="wrap"><p class="kick">{t['a_kicker']}</p><h1 class="h-hero">{t['a_h1']}</h1></div></section>
<div class="wrap">
<section class="intro"><img class="mono" src="{R}brand/Logo Monogram/Curves_black.svg" alt=""><p>{t['a_statement']}</p><div class="strip">{strip}</div><img class="still" src="{IMG}caedcb84dd0d35bb.webp" alt=""></section>
<section class="sec"><div class="head"><h2 class="h-head">{t['story_h']}</h2><p class="i">{t['story_i']}</p></div><div class="grid3">{cards(t['story'], ['9d2fd4b4cb4bbe5d', 'ea1642e544c2e4d8', 'b431333bfc499a22'])}</div></section>
<section class="sec"><div class="head"><h2 class="h-head">{t['values_h']}</h2><p class="i">{t['values_i']}</p></div><div class="grid3">{cards(t['values'], ['d6b480cf5ea43448', '3197823a7573cd0e', 'eb2bdb4be90884e4'])}</div></section>
<section class="sec"><div class="head"><h2 class="h-head">{t['git_h']}</h2><p class="i">{t['git_i']}</p><a class="cta" href="#">{t['git_cta']} <span aria-hidden="true">{'←' if loc == 'ar' else '→'}</span></a></div></section>
</div></main>{footer(t)}"""
    return page(loc, "About", body)


def contact(loc):
    t = T[loc]
    opts = "".join(f"<option>{o}</option>" for o in t["f_types"])
    r = f'<span class="req"> · {t["req"]}</span>'
    body = f"""{nav(t, False, 3)}
<main><div class="wrap">
<section class="sec"><div class="head"><p class="kick">{t['c_kicker']}</p><h1 class="h-disp">{t['c_h1']}</h1><p class="i">{t['c_intro']}</p></div></section>
<section class="sec"><div class="two">
<div style="display:grid;gap:24px;align-content:start"><h2 class="h-head">{t['biz']}</h2>
<dl><div class="row"><dt>{t['l_loc']}</dt><dd><a href="#">{t['loc']}</a></dd></div>
<div class="row"><dt>{t['l_line']}</dt><dd><a href="#"><bdi>+971 56 388 3302</bdi></a></dd></div>
<div class="row"><dt>{t['l_wa']}</dt><dd><a href="#"><bdi>+971 56 388 3302</bdi></a></dd></div>
<div class="row"><dt>{t['l_mail']}</dt><dd><a href="#"><bdi>inquiries@almarprivatejourney.com</bdi></a></dd></div></dl>
<a class="btn sec2" href="#">{t['wa_btn']}</a></div>
<form id="inquiry"><h3 class="h-title">{t['f_title']}</h3>
<div class="f2"><div class="f"><label>{t['f_name']}{r}</label><input></div><div class="f"><label>{t['f_phone']}</label><input type="tel"></div></div>
<div class="f2"><div class="f"><label>{t['f_mail']}{r}</label><input type="email"></div><div class="f"><label>{t['f_type']}{r}</label><select>{opts}</select></div></div>
<div class="f"><label>{t['f_msg']}{r}</label><textarea></textarea></div>
<span class="btn">{t['f_send']}</span></form>
</div></section>
<section class="sec"><div class="head"><h2 class="h-head">{t['conf_h']}</h2><p class="i">{t['conf_i']}</p><a class="cta" href="#inquiry">{t['conf_cta']} <span aria-hidden="true">{'←' if loc == 'ar' else '→'}</span></a></div></section>
</div></main>{footer(t)}"""
    return page(loc, "Contact", body)


for loc in ("en", "ar"):
    (HERE / f"about-{loc}.html").write_text(about(loc), encoding="utf8")
    (HERE / f"contact-{loc}.html").write_text(contact(loc), encoding="utf8")
print("ok")
