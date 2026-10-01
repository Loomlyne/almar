# Phase 2: Platform spine - Context

**Gathered:** 2026-09-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Guest and owner can authenticate. Public and ops are isolated. Language and currency persist on the same URLs. No booking, catalog, or ops CMS in this phase.

</domain>

<decisions>
## Implementation Decisions

Locked this session. Do not re-ask. Latest answer wins.

### Guest sign-up
- **D-01:** Public guest sign-up is live this phase. Email form. Account stays inactive until they confirm.
- **D-02:** Guest session is 30 days, same as the owner.
- **D-03:** Signed-in guest menu shows Bookings, Account, and Sign out this phase, even if those pages are empty.

### Ops host
- **D-04:** Ops is not `https://almarprivatejourney.com/ops`. It is `https://dashboard.almarprivatejourney.com/`. Gate DNS this phase so it can be opened. Owner words: "we will do it now so we can open it we will get it gates."

### Language and currency
- **D-05:** Language and currency switch on the live Framer header now, same URLs.

### Confirm email
- **D-06:** Branded confirm email is Resend, from `inquiries@almarprivatejourney.com`. Owner gates that domain when we build it.

### After confirm
- **D-07:** No guest password. Every sign-in is a magic link. Supersedes the skippable set-password screen. Owner words: "Let's do this without a password. Every time anyone needs to sign in, he needs to access with a magic link"

### Language on Framer pages
- **D-08:** Superseded. Do not leave body copy in English. Every component, line, text, section, page, and alt text is English, Arabic, and Spanish. Owner words: "From the start each image, each component, each and every thing needs to be configured in those three languages: Arabic, English, and Spanish... don't ask me anything... Each component, each line, each text, each section, each page, everything needs to have these three languages"

### Supabase
- **D-09:** Auth data is cloud Supabase. One numbered owner step, then wait. Not local Docker.

### Owner on both surfaces
- **D-10:** The owner uses the same email for dashboard access and to log in on the front site like a user. Owner words: "the owner can have with teh same email a ashbaord access and ogin to the frontsite like a user"

### Currency on Framer pages
- **D-11:** The currency switch converts the prices written on Framer pages now.

### Logout-all
- **D-12:** Logout-all is on the dashboard, next to Sign out. Not on the public site.

### Owner on the public site
- **D-13:** Signed in with the owner email on the public site, she sees the guest menu plus a way to open the dashboard.

### Price base
- **D-14:** `$` amounts are USD. AED amounts stay AED. Convert each from what is written.

### Rate failure
- **D-15:** If the rate cannot be fetched, find the problem, make it convert, and let it work. Owner words: "fiund the problem amke it convert and let it work". Not a guest-facing fail state.

### Dashboard link
- **D-16:** The way to the dashboard is only in her signed-in menu. Other guests do not see it. Not in the public nav.

### Spanish header
- **D-17:** Superseded by D-08. Body does not stay English. Arabic is RTL.

### Sign-in path
- **D-18:** Public sign-in is `/login`. Bookings and Account are `/account`.

### Empty pages
- **D-19:** Bookings and Account are one line each. No Save until those edits exist. Bookings links home.

### Skip password
- **D-20:** Superseded by D-07. There is no password to skip. The confirm link still signs her in. See D-35.

### Language on another device
- **D-21:** Language follows her once she is signed in. This browser only when she is not.

### Currency on another device
- **D-22:** Currency follows her once she is signed in. This browser only when she is not.

### Magic link and password rules
- **D-23:** Magic link lifetime is whatever Supabase allows. Owner words: "Whatever supabase is allowed". Do not invent a custom expiry.
- **D-24:** Superseded. No password fields this phase. Do not invent a minimum.

### Dashboard handoff
- **D-25:** Logout-all signs her out of the dashboard and the public site.
- **D-26:** Sign out on the public site ends that site only. Logout-all is what ends every session.

### Header labels
- **D-27:** Standard Arabic and Spanish header translations. Owner can correct them at UAT.

### Dashboard handoff
- **D-28:** Opening the dashboard from her menu does not ask for a password again. She is already signed in.

### Confirm email name
- **D-29:** Confirm email sender name is `ALMAR Private Journey`. Owner words. Not "Journeys". Not "ALMAR" alone.

### Signed-in header
- **D-30:** When she is signed in, Framer header Login is replaced by her menu: Bookings, Account, Sign out, and Dashboard. Other guests do not see Dashboard (D-16).

### /login modes
- **D-31:** `/login` has two modes. Create an account: first name, last name, email, phone optional (store it; needed later; not required now). Sign in: email only, then a magic link.

### Confirm email language
- **D-32:** Confirm email is in the language selected when she signed up.

### Owner sign-in
- **D-33:** Owner dashboard is magic link only, same as everyone. Supersedes email-and-password for the owner.

### /login tabs
- **D-34:** The two modes are tabs on top of the form. Click Sign in, the form changes. Click Create account, the form changes. Owner words: "its a tab on top of the form i click on sign in button and the firm chnages and create account the form chnages as well"

### Confirm link
- **D-35:** The confirm link activates the account and signs her in.

### Dashboard sign-in
- **D-36:** Logged-out dashboard is Sign in only. No Create account tab. Create account stays on the public site.

### /login default
- **D-37:** Sign in is the open tab on public `/login`.

### Sign-in email language
- **D-38:** The sign-in magic link email is in the language selected on that page.

### Dashboard guest email
- **D-39:** Superseded in wording by D-146 and D-141. A guest email is rejected. The line does not say dashboard.

### Magic link return
- **D-40:** A magic link sends her back to the host she requested it on.

### Owner seed
- **D-41:** The owner account is seeded when Supabase is created. She does not use Create account. Email only. Name stays empty until a later phase.

### Owner on public Sign in
- **D-42:** Public Sign in with the owner email uses a magic link and signs her in. It does not create an account. That email will not be used to create an account. Owner words: "When I try to sign in to the public site with the owner email, it will use a magic link, saying I will be able to sign in and it will not create an account. It will not be used to create an account"

### First owner link
- **D-43:** She requests the first magic link on the dashboard. Nothing is sent from chat.

### Create account and owner email
- **D-44:** Create account does not create an account for the owner email. A line says this email cannot be used here.

### Owner sign-in screen
- **D-45:** Public Sign in with the owner email shows the same check-your-email page as any guest. Refines D-42. Not a special line.

### Owner sign-in email
- **D-46:** The public owner sign-in email is the same as a guest sign-in email.

### Live header this phase
- **D-47:** Add language, currency, and Login to the live header. Keep the current links.
- **D-48:** Language and currency sit in the mobile menu as well as the desktop header.
- **D-49:** Language and currency controls are compact dropdowns, same as `/design`.
- **D-50:** New controls sit after the current links: currency, then language, then Login.
- **D-51:** On a phone, the signed-in menu sits in the mobile menu, with language and currency.
- **D-52:** Keep the current header logo this phase.
- **D-53:** Every word in the live header bar gets Arabic and Spanish this phase, including buttons.
- **D-54:** Login is text, same as the current links.
- **D-55:** Language, currency, and Login go on every page: public, Create account, new pages, and old pages. Owner words: "Every page, public, the create, the new ones, the old ones, everything even in the dashboard if I go to the settings and change the dashboard to Spanish, all of the dashboard will translate to Spanish"

### Dashboard settings
- **D-56:** Dashboard settings this phase is the full settings page, not language-only.
- **D-57:** Dashboard settings switches language and currency. Changing language translates the whole dashboard.

### Dashboard nav
- **D-58:** The dashboard shows the full ops nav this phase, including sections that are not built yet.

### Header behavior
- **D-59:** Picking a language in the public header updates the page in place. The URL stays the same.
- **D-60:** On desktop, currency, language, and Login stay on one row. They do not wrap under the logo.

### Framer navbar
- **D-61:** When the row does not fit, it becomes the Framer tablet bar: logo on one side, the existing menu icon on the other. Not a sideways scroll. Owner words: "It becomes a menu: the logo on the side and the menu, similar to the tablet from the Framer component"
- **D-62:** Phone and tablet use that same Framer navbar. Logo plus the existing three-bar menu icon. Not the /design overlay. Owner words: "Check the navbar component and explore everything from there... You need to figure out"
- **D-63:** Do not restyle the live header to the /design ivory header. Keep the current colors and type.
- **D-64:** The live desktop links are DESTINATIONS, EXPERIENCES, SERVICES, ABOUT, CONTACT, SIGN IN. The same bar is on inner pages. Currency and language go before SIGN IN. SIGN IN is the login control. Do not add a second Login.
- **D-65:** The word stays SIGN IN.
- **D-66:** Closed currency and language use light type, same as the links. The open list is the /design dropdown.
- **D-67:** The closed language control says English, العربية, or Español. Same as /design.
- **D-68:** Signed-in labels on that bar are uppercase: BOOKINGS, ACCOUNT, SIGN OUT, TOUCHWORD. The word DASHBOARD is superseded by D-147. Arabic uses the Arabic words, except touchword, which is not translated. See D-149.
- **D-69:** On tablet and phone, currency, language, and SIGN IN are inside the opened menu. The bar stays logo and the menu icon.
- **D-70:** The closed currency control says AED, USD, or EUR. Same as /design.
- **D-71:** Superseded by D-181. The public header does not switch at 1440px.

### Opened menu
- **D-72:** The opened tablet and phone menu covers the page. The logo stays. The icon closes it.
- **D-73:** DASHBOARD opens in a new tab.
- **D-74:** If she picks a language inside that menu, it stays open. The page updates in place. Owner words: "It stays open and the page updates in place and everything updates in place"

### /login paths
- **D-75:** On Sign in, if the email is not in the database, the email stays in the field and the form transfers to Create account. Not a line below that says she does not have an account. Owner words: "The email will stay in the field. It will transfer to create an account and not below, where it says, \"You don't have an account. Please create one.\" It will guide him."
- **D-76:** Create account asks for name, last name, email, and an optional phone. The button verifies the email. After that she gets access directly. Owner words: "He will add: his name, last name, that email, which is already there, a phone number, which is optional, the button to verify the email. She will get access directly."
- **D-77:** A later sign-in is email only. The button is "Access with magic link". Owner words: "When she's trying to sign in again she will only put her email and it will be \"Access with magic link\" or something like that"
- **D-78:** If Create account already has that email, the email stays filled and the form transfers to Login. She clicks "Send me the magic link". Below that, the note "You already have an account."
- **D-79:** The check-your-email page is fully branded, with the related information and a verification button. Do not invent a sparse page.
- **D-80:** Also verify the email in the browser itself, in addition to the email button. Owner words: "in the app itself there is a new feature to verify the email on the browser itself. Let's use that also"

### In-browser verify
- **D-81:** That feature is the Email Verification API in https://resend.com/blog/email-verification-api. The browser adds a token when it can prove the mailbox. She does not type a code. If the browser cannot, the branded email with the verification button is the fallback.

### Labels I decided
- **D-82:** One button label: "Access with magic link". The note "You already have an account." already explains the transfer. Two labels would look like two features.
- **D-83:** The tab says Sign in, not Login. D-78's "Login" means that tab. Why: the header control is SIGN IN, and the other tab is Create account.

### Access
- **D-84:** If the browser can prove her email on Sign in, she gets access directly. The magic link is only the fallback.
- **D-85:** After she gets access, she lands on the page she came from. Home if she opened /login directly.
- **D-86:** If the link has died, she is taken to the login page to try again. A note below: "Your link expired. Try again." Owner words: "it will take her to the login page to try to log in again. A note below: \"Your link expired. Try again.\""
- **D-87:** An already-used link shows the same note: "Your link expired. Try again."
- **D-88:** Dashboard sign-in uses the same browser-proof rule. Access directly when the browser can prove it. The link is the fallback.
- **D-89:** The Create account button says Create account.
- **D-90:** The check-your-email page has a send-again control.
- **D-91:** On Create account, name and last name are required. Only the phone number is optional. Owner words: "if they re creating an account is a must a add them only number is optional"
- **D-92:** The button in the email says "Access with magic link."
- **D-93:** If name or last name is empty, the line sits under that field. I decided this. Why: she must add them, and the line has to show which one is missing.
- **D-94:** The send-again control says Send again.
- **D-95:** The check-your-email page shows the address it was sent to.
- **D-96:** On /login, language and currency stay. SIGN IN is not shown.

### Dashboard shell
- **D-97:** A dashboard section that is not built yet shows one line that it is not ready. The nav item stays.
- **D-98:** On the logged-out dashboard, language and currency are on the sign-in page.
- **D-99:** The logged-out dashboard uses the same split layout as /login.
- **D-100:** Sign out and Logout-all sit in the nav, on every dashboard page. I decided this. Why: she needs them from Settings, not only from Home.
- **D-101:** After she gets into the dashboard, she lands on Home.
- **D-102:** Settings this phase saves brand, VAT, deposit, live FX, maintenance, logos, language, and currency. Email templates, reminders, and confirmation wait. See D-109 and D-112.
- **D-103:** Home shows one line that it is not ready. The nav is how she moves.
- **D-104:** The ops nav is the full tree: Home, Bookings, Customers, Calendar, Catalog (Destinations, Stays, Experiences & Services, Packages), Content (Pages, Blog, Team, Legal), Settings, Profile. Each unbuilt page is one line.
- **D-105:** If maintenance mode is on, the public site shows a branded page. The dashboard still opens.
- **D-106:** When maintenance mode is on, /login shows that page too.
- **D-107:** VAT and deposit start empty until she sets them.
- **D-108:** If she saves a logo in settings, the live header uses it. Until she does, the header keeps the current logo.
- **D-109:** She does not edit email templates this phase. They are set in the build. A later phase is for her to set all possible emails. Owner words: "she will not edit any email tempelates they will be set from here we will make a full pahse for them to set all possiblities as email to be sended"
- **D-110:** A brand color change is used on the live site, the dashboard, and the email templates. Owner words: "the live site uses that, teh dashboard as well, and the email templates as well"
- **D-111:** The maintenance page shows the existing phone and email.
- **D-112:** Reminders and confirmation wait for the email phase. They are not on settings this phase.
- **D-113:** A saved logo is used on the live header, the dashboard, and the emails.
- **D-114:** Brand settings this phase can change color and type. Radius is not a branding control. See D-119.
- **D-115:** The fonts she can pick are the faces already in the design system.
- **D-116:** Type applies to the live site, the dashboard, and the emails. Same as color. Radius does not. See D-119.
- **D-117:** Dashboard Sign out ends the dashboard only. Logout-all ends both.
- **D-118:** Live FX shows the rate. She cannot type one.
- **D-119:** Do not add radius as something she can edit in branding. Corners stay square. Owner words: "dont add radios as something she cna edit in branding"
- **D-120:** The not-ready line says "Not ready."
- **D-121:** She picks the title face and the body face separately. The faces are the ones already in the design system.
- **D-122:** She can change all brand colors, each on its own. Owner words: "all brand colorseach on its own". Do not narrow this to ivory, charcoal, and gold.
- **D-123:** If she changes the Latin face, Arabic keeps its own face.
- **D-124:** Logout-all asks her to confirm.
- **D-125:** Dashboard Sign out asks her to confirm.
- **D-126:** The maintenance page uses a standard line. She can correct it at UAT.
- **D-127:** Public Sign out does not ask her to confirm.
- **D-128:** If a brand color fails contrast, the save is blocked. A line says the contrast is too low.
- **D-129:** Settings save with a Save button.
- **D-130:** If she leaves Settings with unsaved changes, it asks her to confirm.
- **D-131:** The Save button is enabled when something has changed.
- **D-132:** After she confirms Logout-all, that tab lands on the dashboard sign-in page.
- **D-133:** After she confirms dashboard Sign out, that tab lands on the dashboard sign-in page. I decided this. Why: she is already in that tab, and Logout-all lands there too.
- **D-134:** After a successful Save, a line says it saved.
- **D-135:** On a phone, the dashboard nav is a menu: logo and a menu icon.
- **D-136:** VAT and deposit can be empty, or a number, including 0.
- **D-137:** If she saves a language in Settings and the public site is open in another tab, that tab updates immediately.
- **D-138:** The dashboard phone menu covers the page. The logo stays. The icon closes it.
- **D-139:** A guest email on dashboard sign-in stays in the field. The line sits under it. The line does not say dashboard. See D-141.
- **D-140:** The dashboard nav becomes a menu below 1440px.
- **D-141:** Do not mention the dashboard to anyone, anywhere. No one has to know about it. The word must not be shown. Owner words: "no dont mention the dashbaird to anyone anyone anyone no one has to know about anywhere so it dashbaord must not be mentioned anywhere"
- **D-142:** A guest stays a guest until they sign up. Owner words: "a guest stay a guest till he signup"
- **D-143:** A saved currency or brand color updates the other open tab immediately. Same as language.
- **D-144:** Only her signed-in account sees a menu item for that host. The word she named is "touchword", not Dashboard. Owner words: "No, only if it's her account, she can see the word \"touchword\" rather than \"no\""
- **D-145:** After she is in on that host, the word dashboard can appear in the nav.
- **D-146:** A guest email on that sign-in shows "This email cannot be used here."
- **D-147:** The menu label is the literal word touchword.
- **D-148:** On the bar it is TOUCHWORD. I decided this. Why: the bar is uppercase.
- **D-149:** In Arabic and Spanish it stays touchword. It is not translated. I decided this. Why: translating it would name the thing no one should know about.
- **D-150:** The URL stays `dashboard.almarprivatejourney.com`. The page does not say dashboard until she is in.
- **D-151:** Before she is in, the browser title can say dashboard.
- **D-152:** The sign-in email for that host can say dashboard.
- **D-153:** A public email does not say dashboard.
- **D-154:** After she is in, the word can appear in the nav and the browser title.
- **D-155:** TOUCHWORD is in the phone menu, only for her account, inside the menu. I decided this. Why: that menu is where her signed-in items sit, and without it she cannot open the host from a phone.
- **D-156:** The check-your-email page on that host does not say dashboard. The email can. I decided this from D-150 and D-152.
- **D-157:** A guest who is signed in on the public site and opens that URL does not get in. They see sign-in. Their email is rejected.
- **D-158:** After she is in, the word sits in the browser title and the name next to the logo. Section names stay Home, Bookings, and the rest.
- **D-159:** The sign-in split image on that host is the same image as /login.
- **D-160:** VAT and deposit are percents.
- **D-161:** The sign-in email for that host has the subject Sign in. The button stays Access with magic link.
- **D-162:** Maintenance starts off until she turns it on and saves.
- **D-163:** The logged-out browser title stays Sign in. I decided this. Why: the page does not say dashboard until she is in, and the tab would tell anyone who opens the URL.
- **D-164:** After she is in, the name next to the logo is DASHBOARD.
- **D-165:** VAT and deposit allow a decimal.
- **D-166:** If she saved a new logo, clear removes the logo and she must add something. Owner words: "if she saved a new logo the clear with remove the logo and she must add something"
- **D-167:** The sign-in email body for that host may say dashboard. It does not have to.
- **D-168:** VAT and deposit decimals are two places.
- **D-169:** The optional phone field is digits only.
- **D-170:** After she asks for the email, check-your-email is the same /login. The form is replaced.
- **D-171:** If Send again is too soon, she sees a countdown until she can. Owner words: "a countdown till she can"
- **D-172:** When check-your-email replaces the form, the tabs stay. She can switch back.
- **D-173:** Name and last name are letters only.
- **D-174:** A plus is allowed in the phone field.
- **D-175:** Arabic letters and accents count as letters in name and last name.
- **D-176:** Spaces and hyphens are allowed in a name.
- **D-177:** If she switches tabs during check-your-email, the email stays filled.
- **D-178:** When she is signed in on desktop, Bookings, Account, Sign out, and touchword sit in the row, in place of SIGN IN.
- **D-179:** Currency and language stay in front of those items. SIGN IN is the only thing replaced.
- **D-180:** A link in the opened phone menu closes the menu. A language pick stays open. See D-74.
- **D-181:** The public header becomes the menu at 1200px, not 1440px. Owner words: "keep teh header will become menu when it reached 1200px not 1440 thats better"
- **D-182:** Header Sign out leaves her on that page.
- **D-183:** Changing currency in the header updates prices in place. The URL stays the same.

### Roadmap criteria this discussion supersedes
- Success criterion 1's optional password and eye are not this phase. See D-07 and D-24.
- Success criterion 2's email-and-password owner sign-in, and logged-out `/ops`, are not this phase. Owner sign-in is a magic link. Ops is `https://dashboard.almarprivatejourney.com`. See D-04 and D-33.
- A guest who hits that host is rejected at sign-in. Do not serve the marketing homepage. See D-157.

### Claude's Discretion
- Uppercase bar labels. Why: the live bar is uppercase.
- One button label, "Access with magic link." Why: two labels would look like two features.
- The tab says Sign in, not Login. Why: the header control is SIGN IN.
- A missing name line sits under that field. Why: she must see which field is missing.
- Sign out and Logout-all sit in the dashboard nav on every page. Why: she needs them from Settings, not only Home.
- Dashboard Sign out lands on that host's sign-in page. Why: Logout-all lands there, and she is already in that tab.
- The public menu word is TOUCHWORD, not translated. Why: the bar is uppercase, and a translation would name the host.
- TOUCHWORD is in her phone menu. Why: that is where her signed-in items sit.
- The check-your-email page on that host does not say dashboard. The email may. Why: the page must not say it until she is in.
- The logged-out browser title stays Sign in. Why: a tab that says dashboard tells anyone who opens the URL.
- The public header menu cutoff is 1200px. The dashboard nav cutoff stays 1440px, from D-140. These are not the same bar.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Product
- `.planning/ROADMAP.md` — Phase 2 goal and success criteria
- `.planning/REQUIREMENTS.md` — AUTH-02, AUTH-05, AUTH-06, AUTH-07, I18N-01, I18N-02, I18N-03, OPS-01, PLAT-01, PLAT-02, PLAT-04
- `.planning/PROJECT.md` — constraints, gated creates
- `.planning/phases/01-design-system/01-CONTEXT.md` — sign-in split, header switchers, check-your-email

### Code
- `.planning/codebase/STACK.md`
- `.planning/codebase/ARCHITECTURE.md`
- `.planning/codebase/INTEGRATIONS.md`
- `.planning/codebase/CONCERNS.md`

### External
- `https://resend.com/blog/email-verification-api` — browser email verification. Token, not a code she types.
- `https://supabase.com/docs/guides/auth/auth-email-passwordless` — magic link. Lifetime is whatever Supabase allows.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `components/ui/nav.tsx` and the `/design` header: compact language and currency dropdowns. The live header keeps its current colors. The open list is that dropdown.
- Phase 1 sign-in split layout: public `/login` and the logged-out dashboard host use it.
- `app/route.ts`: live Framer header and the six prices to convert.

### Established Patterns
- Same URLs for English, Arabic, and Spanish. Arabic is RTL. No `/en` prefix.
- Dates DD/MM/YYYY. Week starts Monday. Western numerals.
- Corners stay square. Radius is not a settings control.
- Password fields are not in this phase. If a later phase adds one, it needs a right-side show/hide eye.

### Integration Points
- Public host: `https://almarprivatejourney.com`. Ops host: `https://dashboard.almarprivatejourney.com`. DNS for that host is owner-gated.
- Auth data is cloud Supabase. One numbered owner step, then wait. No storage.
- Confirm email is Resend, from `inquiries@almarprivatejourney.com`. Owner gates that domain when built.
- Do not deploy to Vercel. Do not create the Worker or DNS until he gates it.

</code_context>

<specifics>
## Specific Ideas

- Live desktop links stay DESTINATIONS, EXPERIENCES, SERVICES, ABOUT, CONTACT, SIGN IN.
- The narrow bar is the Framer tablet bar: logo on the side, menu icon on the other. It switches at 1200px.
- `/login` modes are tabs on top of the form. Clicking a tab changes the form.
- Unknown sign-in email stays in the field and transfers to Create account. It does not show "You don't have an account."
- The public menu item for the ops host is the literal word touchword. Only her signed-in account sees it.

</specifics>

<deferred>
## Deferred Ideas

- Email templates, reminders, and confirmation settings. A later phase sets every email she can send. See D-109 and D-112.
- Guest profile edits and a password. Not this phase.
- Ops CMS, catalog, bookings management, and checkout. Not this phase.
- Owner name stays empty until a later phase. The seed is email only.
- Custom domain purchase is already done for the marketing host. The dashboard host DNS is gated, not deferred.

</deferred>

---

*Phase: 2-platform-spine*
*Context gathered: 2026-09-25*
