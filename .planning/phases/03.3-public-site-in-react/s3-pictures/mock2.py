# Throwaway design mock, round 2: About and Contact matched to the live Framer pages (owner, 2026-10-04,
# "Yes, except list pages"), in job 11's look (11-DESIGN.md on gsd/phase-3.3-s1-framer-match: sizes 88/56/32/22/18,
# sections 120 px at 1440 and 64/40 at 390, thin teal-tint lines with a gold diamond outline, light footer).
# NOT application code. Writes about2-{en,ar}.html and contact2-{en,ar}.html next to this file.
# Text: EN live verbatim, AR draft (the T table of mock.py). Animations are listed in 03.3-S3-DESIGN.md section 12.
import pathlib, importlib.util

HERE = pathlib.Path(__file__).parent
spec = importlib.util.spec_from_file_location("mock", HERE / "mock.py")
m = importlib.util.module_from_spec(spec)
import sys, io
_out = sys.stdout; sys.stdout = io.StringIO(); spec.loader.exec_module(m); sys.stdout = _out
T, R, IMG = m.T, m.R, m.IMG

CSS = """
@font-face{font-family:Questa;src:url('{R}brand/Font/questa-webfont/2-Questa_Regular.woff') format('woff')}
@font-face{font-family:Lato;src:url('{R}brand/Font/lato/Lato-Regular.ttf');font-weight:400}
@font-face{font-family:Lato;src:url('{R}brand/Font/lato/Lato-Bold.ttf');font-weight:700}
:root{--ivory:#fffaf0;--surface:#fff;--teal:#1f3b40;--tint:#d1dfe0;--gold:#d4ba8a;--ink:#262626;--muted:#63615f;--line:rgb(38 38 38/.16);--wa:#25D366;
--fd:Questa,Georgia,serif;--fb:Lato,Arial,sans-serif;--lh:1.5;--tk:.12em}
:lang(ar){--fd:'Noto Naskh Arabic',Questa,Georgia,serif;--fb:'Noto Sans Arabic',Lato,Arial,sans-serif;--lh:1.7;--tk:normal}
*{box-sizing:border-box}html,body{margin:0}body{background:var(--ivory);color:var(--teal);font:14px/var(--lh) var(--fb)}@media(min-width:768px){body{font-size:16px}}
a{color:inherit}.wrap{max-width:1240px;margin:0 auto;padding:0 20px}@media(min-width:768px){.wrap{padding:0 32px}}@media(min-width:1300px){.wrap{padding:0}}
h1,h2,h3{font-family:var(--fd);font-weight:400;color:var(--teal);margin:0;line-height:1.1}
.h88{font-size:48px}.h56{font-size:32px}.h32{font-size:24px}@media(min-width:768px){.h88{font-size:88px}.h56{font-size:56px}.h32{font-size:32px}}
.kick{margin:0}.lead{max-width:400px;margin:0 auto}
.sec{padding:64px 0 40px}@media(min-width:768px){.sec{padding:120px 0}}
.center{text-align:center;display:grid;gap:16px;justify-items:center}
.div{position:relative;height:1px;background:var(--tint);margin:0 20px}.div:after{content:'';position:absolute;left:50%;top:-6px;width:10px;height:10px;border:1px solid var(--gold);background:var(--ivory);transform:translateX(-50%) rotate(45deg)}
/* nav: job 11 / slice 1 SiteNav */
.nav{height:72px}@media(min-width:1152px){.nav{height:96px}}.nav .wrap{height:100%;display:flex;align-items:center;gap:24px}.nav img{width:112px;max-height:56px;object-fit:contain;object-position:left}:lang(ar) .nav img{object-position:right}@media(min-width:1152px){.nav img{width:150px}}
.nav.on{position:absolute;inset-inline:0;top:0;color:var(--ivory);z-index:2}
.links{display:none;gap:32px}.links a{font-size:12px;text-transform:uppercase;letter-spacing:var(--tk);text-decoration:none}:lang(ar) .links a{text-transform:none;font-size:14px}.links a.cur{text-decoration:underline;text-decoration-thickness:2px;text-underline-offset:6px}
.sel,.menu{margin-inline-start:auto;height:44px;padding:0 16px;border:1px solid currentColor;display:inline-flex;align-items:center;font-size:14px}.sel{display:none}
@media(min-width:1152px){.links{display:flex}.sel{display:inline-flex}.menu{display:none}}
/* buttons: Framer's outlined button, gold as a line */
.btn{height:48px;padding:0 24px;border:1px solid var(--gold);background:var(--ivory);color:var(--teal);font:16px var(--fb);display:inline-flex;align-items:center;gap:8px;text-decoration:none;width:max-content}
@media(min-width:768px){.btn{font-size:18px}}.btn.solid{background:var(--teal);color:var(--ivory);border-color:var(--teal)}
/* about */
.hero{position:relative;height:640px;overflow:hidden}@media(min-width:768px){.hero{height:900px}}
.hero>img,.band>img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}.hero:after,.band:after{content:'';position:absolute;inset:0;background:rgb(38 38 38/.35)}
.hero .center,.band .center{position:relative;z-index:1;height:100%;align-content:center;color:var(--ivory)}.hero h1,.band h2{color:var(--ivory)}
.collage{position:relative;height:1500px}@media(min-width:768px){.collage{height:2300px}}
.collage .st{position:sticky;top:42vh;max-width:400px;margin:0 auto;text-align:center;padding:0 20px;z-index:1}
.collage img{position:absolute;width:170px;aspect-ratio:5/6;object-fit:cover}@media(min-width:768px){.collage img{width:300px}}
.collage .i1{top:120px;inset-inline-end:6%}.collage .i2{top:520px;inset-inline-start:0}.collage .i3{top:860px;inset-inline-end:0}.collage .i4{top:1150px;inset-inline-start:3%}.collage .i5{top:1300px;inset-inline-end:6%}
@media(min-width:768px){.collage .i2{top:700px}.collage .i3{top:1100px}.collage .i4{top:1500px}.collage .i5{top:1800px}}
.still{width:100%;height:420px;object-fit:cover;display:block}@media(min-width:768px){.still{height:900px}}
.cards{display:grid;gap:48px;margin-top:48px;text-align:start}@media(min-width:768px){.cards{grid-template-columns:repeat(3,1fr);gap:80px}}
.cards img{width:100%;aspect-ratio:1/1.08;object-fit:cover;display:block;margin-bottom:24px}.cards p{margin:12px 0 0}
.rows{display:grid;gap:48px;margin-top:48px;text-align:start}.row{display:grid;gap:24px;align-items:center}@media(min-width:768px){.row{grid-template-columns:1fr 1fr;gap:80px}.row img{justify-self:end}}
.row img{width:100%;max-width:480px;aspect-ratio:3/2;object-fit:cover;display:block}.row p{margin:12px 0 0;max-width:360px}
.band{position:relative;height:560px;overflow:hidden}@media(min-width:768px){.band{height:900px}}
/* contact */
.two{display:grid;gap:48px}@media(min-width:900px){.two{grid-template-columns:1fr 1fr;gap:64px}}
.det{display:grid;gap:12px;align-content:start}.grp{display:grid;gap:4px;margin-top:12px}.grp b{font-weight:400;font-size:18px;display:flex;gap:8px;align-items:center}
.grp small{font-size:14px;color:var(--teal)}.grp a{text-decoration:none}.grp a:after{content:' ↗';font-size:12px}:lang(ar) .grp a:after{content:' ↖'}
.box{border:1px solid var(--teal);padding:24px;display:grid;gap:16px;align-content:start}@media(min-width:768px){.box{padding:48px}}
.f{display:grid;gap:8px}.f label{font-size:14px}.f input,.f select,.f textarea{height:48px;border:1px solid var(--teal);background:var(--ivory);padding:0 16px;font:16px var(--fb);width:100%;border-radius:0;color:var(--teal)}
.f textarea{height:96px;padding:12px 16px}.f2{display:grid;gap:16px}@media(min-width:768px){.f2{grid-template-columns:1fr 1fr}}.req{color:var(--muted);font-size:12px}
.acts{display:flex;flex-wrap:wrap;gap:12px}
/* footer: job 11's light footer, our signed content */
footer{border-top:1px solid var(--tint);padding:64px 0 32px}.cols{display:grid;gap:32px}@media(min-width:768px){.cols{grid-template-columns:repeat(4,1fr)}}
.cols p.h{font-size:12px;margin:0 0 8px}.cols a{display:flex;min-height:40px;align-items:center;text-decoration:none}
.news input{height:48px;border:1px solid var(--teal);background:var(--ivory);padding:0 16px;width:100%;font:16px var(--fb)}
.bot{margin-top:48px;border-top:1px solid var(--tint);padding-top:24px;display:flex;flex-wrap:wrap;justify-content:space-between;gap:16px;font-size:14px}
.wa{position:fixed;inset-inline-end:16px;bottom:16px;width:44px;height:44px;background:var(--wa);display:grid;place-items:center;z-index:5}
"""


def nav(t, on, cur):
    logo = R + ("brand/Logo Typography/Poly_White.svg" if on else "brand/Logo Typography/Stacked_Charcoal.svg")
    links = "".join(f'<a class="{"cur" if i == cur else ""}" href="#">{x}</a>' for i, x in enumerate(t["nav"]))
    return f'<header class="nav{" on" if on else ""}"><div class="wrap"><img src="{logo}" alt="ALMAR"><nav class="links">{links}</nav><span class="sel">{t["lang"]} ▾</span><span class="menu">{t["menu"]}</span></div></header>'


def footer(t):
    pages = "".join(f'<a href="#">{x}</a>' for x in t["nav"])
    return f"""<footer><div class="wrap"><div class="cols">
<nav><p class="h">{t['ft_pages']}</p>{pages}</nav>
<div><p class="h">{t['ft_contact']}</p><a href="#"><bdi>inquiries@almarprivatejourney.com</bdi></a><a href="#"><bdi>+971 56 388 3302</bdi></a><a href="#">Instagram</a></div>
<div></div>
<div class="news"><p class="h">{t['ft_news']}</p><p style="font-size:12px;margin:0 0 8px">{t['ft_news_line']}</p><input placeholder=""><p style="margin:12px 0 0"><span class="btn">{t['ft_join']}</span></p></div>
</div><div class="bot"><span>{t['ft_copy']}</span><span>English · العربية · Español</span></div></div></footer>
<a class="wa"><svg width="24" height="24" viewBox="0 0 24 24"><path fill="#262626" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2z"/></svg></a>"""


def page(loc, body):
    d = "rtl" if loc == "ar" else "ltr"
    fonts = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Naskh+Arabic&family=Noto+Sans+Arabic:wght@400;700&display=swap">' if loc == "ar" else ""
    return f'<!doctype html><html lang="{loc}" dir="{d}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">{fonts}<style>{CSS.replace("{R}", R)}</style></head><body>{body}</body></html>'


def about(loc):
    t = T[loc]
    strip = ["18c236478045dd34", "bfe105a629dcc096", "8ddf86c5dd7c51fe", "15368278ab019a18", "8941b742928820e1"]
    coll = "".join(f'<img class="i{k+1}" src="{IMG}{s}.webp" alt="">' for k, s in enumerate(strip))
    cards = "".join(f'<article><img src="{IMG}{i}.webp" alt=""><h3 class="h32">{a}</h3><p>{b}</p></article>' for (a, b), i in zip(t["story"], ["9d2fd4b4cb4bbe5d", "ea1642e544c2e4d8", "b431333bfc499a22"]))
    rows = "".join(f'<div class="row"><div><h3 class="h32">{a}</h3><p>{b}</p></div><img src="{IMG}{i}.webp" alt=""></div>' for (a, b), i in zip(t["values"], ["d6b480cf5ea43448", "3197823a7573cd0e", "eb2bdb4be90884e4"]))
    body = f"""{nav(t, True, 2)}<main>
<section class="hero"><img src="{IMG}8487db9c4571064d.webp" alt=""><div class="center wrap"><p class="kick">{t['a_kicker']}</p><h1 class="h88">{t['a_h1']}</h1></div></section>
<section class="collage"><p class="st">{t['a_statement']}</p>{coll}</section>
<img class="still" src="{IMG}caedcb84dd0d35bb.webp" alt="">
<section class="sec"><div class="wrap center"><h2 class="h56">{t['story_h']}</h2><p class="lead">{t['story_i']}</p><div class="cards">{cards}</div></div></section>
<div class="div"></div>
<section class="sec"><div class="wrap center"><h2 class="h56">{t['values_h']}</h2><p class="lead">{t['values_i']}</p><div class="rows" style="width:100%">{rows}</div></div></section>
<section class="band"><img src="{IMG}3484e51613dcadfa.webp" alt=""><div class="center wrap"><h2 class="h88">{t['git_h']}</h2><p class="lead">{t['git_i']}</p><a class="btn" href="#">{t['git_cta']}</a></div></section>
</main>{footer(t)}"""
    return page(loc, body)


def contact(loc, form=True):
    t = T[loc]
    opts = "".join(f"<option>{o}</option>" for o in t["f_types"])
    r = f'<span class="req"> · {t["req"]}</span>'
    pin = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 21s7-6 7-11a7 7 0 0 0-14 0c0 5 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>'
    det = f"""<div class="det"><h2 class="h56">{t['biz']}</h2>
<div class="grp"><b>{pin}{t['l_loc']}</b><a href="#">{t['loc']}</a></div>
<div class="grp"><b>☏ {'الهاتف' if loc=='ar' else 'Phone'}</b><small>{t['l_line']}</small><a href="#"><bdi>+971 56 388 3302</bdi></a><small>{t['l_wa']}</small><a href="#"><bdi>+971 56 388 3302</bdi></a></div>
<div class="grp"><b>✉ {t['l_mail']}</b><a href="#"><bdi>inquiries@almarprivatejourney.com</bdi></a></div></div>"""
    formbox = f"""<form class="box" id="inquiry"><div class="f2"><div class="f"><label>{t['f_name']}{r}</label><input></div><div class="f"><label>{t['f_phone']}</label><input type="tel"></div></div>
<div class="f"><label>{t['f_mail']}{r}</label><input type="email"></div><div class="f"><label>{t['f_type']}{r}</label><select>{opts}</select></div>
<div class="f"><label>{t['f_msg']}{r}</label><textarea></textarea></div>
<div class="acts"><span class="btn solid">{t['f_send']}</span><a class="btn" href="#">{t['wa_btn']}</a></div></form>"""
    conf = f"""<section class="sec"><div class="wrap center"><h2 class="h56">{t['conf_h']}</h2><p class="lead">{t['conf_i']}</p><a class="btn" href="#inquiry">{t['conf_cta']}</a></div></section>"""
    body = f"""{nav(t, False, 3)}<main>
<section class="sec"><div class="wrap center"><p class="kick">{t['c_kicker']}</p><h1 class="h88">{t['c_h1']}</h1><p class="lead">{t['c_intro']}</p></div></section>
<div class="div"></div>
<section class="sec"><div class="wrap two">{det}{formbox}</div></section>
{conf}<div class="div"></div>
</main>{footer(t)}"""
    return page(loc, body)


for loc in ("en", "ar"):
    (HERE / f"about2-{loc}.html").write_text(about(loc), encoding="utf8")
    (HERE / f"contact2-{loc}.html").write_text(contact(loc), encoding="utf8")
print("ok")
