# Translate check: 3 ALMAR texts x 3 models x Arabic and Spanish

Run 2026-10-11T16:24:49.620Z against the local check Worker (scripts/translate-check). Shape = every key back, every
list the English length, nothing empty. Neurons = estimate from the reported token usage (10,000 free a day).

## stay-getsemani-colonial-house-description

Source: `lib/data/fixtures/stay-translations.json` (description).

### English

**description**

1. Getsemaní Colonial House is a vetted ALMAR private stay in Casa Centro Getsemaní, curated for international guests who want hotel-level discretion with the space and privacy of a residence.

2. Layout: 5 bedrooms, 5 bathrooms, 5 double beds, hosting up to 10 guests.

3. Property highlights include Private pool, rooftop terrace, living room, dining room.

### Arabic

#### gemma-4-26b

Shape: pass. Text outside the JSON: no. Neurons: 7.3. Time: 7660 ms. Raw: `stay-getsemani-colonial-house-description-gemma-4-26b-ar.json`.

**description**

1. تُعد Getsemaní Colonial House إقامة خاصة مختارة بعناية من قِبل ALMAR في Casa Centro Getsemaní، صُممت خصيصاً للضيوف الدوليين الباحثين عن الخصوصية التامة التي تليق بالفنادق الفاخرة مع الاستمتاع بمساحة وراحة المنازل الخاصة.

2. التصميم: 5 غرف نوم، 5 حمامات، 5 أسرّة مزدوجة، وتتسع لما يصل إلى 10 ضيوف.

3. تتميز العقار بوجود مسبح خاص، وتراس على السطح، وغرفة معيشة، وغرفة طعام.

#### llama-3.3-70b

Shape: pass. Text outside the JSON: no. Neurons: 40. Time: 4370 ms. Raw: `stay-getsemani-colonial-house-description-llama-3.3-70b-ar.json`.

**description**

1. منزل جيتسماني الكولونيالي هو منزل خاص متوفر من قبل ALMAR في كاسا سنترو جيتسماني، وقد تمت صقله لاستقبال الضيوف الدوليين الذين يرغبون في الحفاظ على الخصوصية على مستوى الفنادق مع مساحة وخصوصية المنزل.

2. التصميم: 5 غرف نوم، 5 حمامات، 5 أسرة مزدوجة، يستوعب lên إلى 10 ضيوف.

3. تتضمن ميزات الملكية حمام سباحة خاص، شرفة على السطح، غرفة معيشة، غرفة طعام.

#### m2m100-1.2b

Shape: pass. Text outside the JSON: no. Neurons: not reported. Time: 2146 ms. Raw: `stay-getsemani-colonial-house-description-m2m100-1.2b-ar.json`.

**description**

1. Getsemaní Colonial House هو إقامة خاصة من ALMAR في Casa Centro Getsemaní ، مخصصة للضيوف الدوليين الذين يرغبون في التفكير على مستوى الفندق مع مساحة وحرية سكنية.

2. إعداد: 5 غرف نوم، 5 غرف حمام، 5 سرير مزدوج، يستضيف ما يصل إلى 10 الضيوف.

3. وتشمل الخصائص المميزة البحيرات الخاصة، ورشة السقف، غرفة المعيشة، غرفة المعيشة.

### Spanish

#### gemma-4-26b

Shape: pass. Text outside the JSON: no. Neurons: 5.6. Time: 4031 ms. Raw: `stay-getsemani-colonial-house-description-gemma-4-26b-es.json`.

**description**

1. Getsemaní Colonial House es una propiedad privada de ALMAR en Casa Centro Getsemaní, seleccionada cuidadosamente para huéspedes internacionales que buscan la discreción de un hotel con la amplitud y privacidad de una residencia.

2. Distribución: 5 dormitorios, 5 baños, 5 camas dobles, con capacidad para hasta 10 huéspedes.

3. Los aspectos destacados de la propiedad incluyen piscina privada, terraza en la azotea, sala de estar y comedor.

#### llama-3.3-70b

Shape: pass. Text outside the JSON: no. Neurons: 34.3. Time: 3472 ms. Raw: `stay-getsemani-colonial-house-description-llama-3.3-70b-es.json`.

**description**

1. Getsemaní Colonial House es una estancia privada de ALMAR seleccionada en Casa Centro Getsemaní, diseñada para huéspedes internacionales que buscan discreción a nivel de hotel con el espacio y la privacidad de una residencia.

2. Diseño: 5 habitaciones, 5 baños, 5 camas dobles, con capacidad para recibir hasta 10 huéspedes.

3. Los destacados de la propiedad incluyen piscina privada, terraza en la azotea, sala de estar, comedor.

#### m2m100-1.2b

Shape: pass. Text outside the JSON: no. Neurons: not reported. Time: 2085 ms. Raw: `stay-getsemani-colonial-house-description-m2m100-1.2b-es.json`.

**description**

1. Getsemaní Colonial House es un alojamiento privado ALMAR revisado en Casa Centro Getsemaní, curado para huéspedes internacionales que desean discreción a nivel hotelero con el espacio y la privacidad de una residencia.

2. Layout: 5 habitaciones, 5 baños, 5 camas dobles, alojando hasta 10 huéspedes.

3. Los puntos destacados de la propiedad incluyen piscina privada, terraza en el techo, sala de estar, comedor.

## journey-explorer-body

Source: `lib/data/fixtures/home-translations.json` (body).

### English

**body**

A private journey framework shaped around your dates, group, and confirmed availability. Stays, transfers, guides, dining, and experiences are proposed after inquiry and confirmed before booking.

### Arabic

#### gemma-4-26b

Shape: pass. Text outside the JSON: no. Neurons: 4.6. Time: 1882 ms. Raw: `journey-explorer-body-gemma-4-26b-ar.json`.

**body**

إطار عمل لرحلة خاصة يتم تصميمه وفقاً لمواعيدكم، وعدد أفراد مجموعتكم، وتوفر الخدمات المؤكدة. يتم اقتراح خيارات الإقامة، والتنقلات، والمرشدين، وتجارب الطعام، والأنشطة بعد الاستفسار، ويتم تأكيدها قبل إتمام الحجز.

#### llama-3.3-70b

Shape: pass. Text outside the JSON: no. Neurons: 22. Time: 2822 ms. Raw: `journey-explorer-body-llama-3.3-70b-ar.json`.

**body**

إطار رحلة خاص يتم تشكيله حول تواريخك، ومجموعتك، والتوافر المؤكد. يتم اقتراح الإقامة، والنقل، والمرشدين، والتناول، والأنشطة بعد الاستفسار، وتأكيد كل شيء قبل الحجز.

#### m2m100-1.2b

Shape: pass. Text outside the JSON: no. Neurons: not reported. Time: 2836 ms. Raw: `journey-explorer-body-m2m100-1.2b-ar.json`.

**body**

تم تصميم إطار رحلة خاصة حول موعدك وملفاتك وملفاتك وملفاتك وملفاتك وملفاتك وملفاتك وملفاتك وملفاتك بعد الاستفسار وتأكيدها قبل الحجز.

### Spanish

#### gemma-4-26b

Shape: pass. Text outside the JSON: no. Neurons: 4. Time: 1869 ms. Raw: `journey-explorer-body-gemma-4-26b-es.json`.

**body**

Un itinerario privado diseñado a la medida de sus fechas, grupo y disponibilidad confirmada. El alojamiento, los traslados, los guías, la gastronomía y las experiencias se proponen tras su consulta y se confirman antes de la reserva.

#### llama-3.3-70b

Shape: pass. Text outside the JSON: no. Neurons: 21.1. Time: 1837 ms. Raw: `journey-explorer-body-llama-3.3-70b-es.json`.

**body**

Un marco de viaje privado diseñado alrededor de sus fechas, grupo y disponibilidad confirmada. Las estancias, traslados, guías, comidas y experiencias se proponen después de la consulta y se confirman antes de la reserva.

#### m2m100-1.2b

Shape: pass. Text outside the JSON: no. Neurons: not reported. Time: 1841 ms. Raw: `journey-explorer-body-m2m100-1.2b-es.json`.

**body**

Un marco de viaje privado diseñado alrededor de sus fechas, grupo y disponibilidad confirmada. Las estancias, traslados, guías, comidas y experiencias se proponen después de la consulta y se confirman antes de la reserva.

## catalog-welcome-cocktail-summary

Source: `lib/data/fixtures/catalog-translations.json` (summary).

### English

**summary**

Your first evening in Colombia at a private Cartagena villa. A personal chef crafts a seasonal menu from Caribbean harvests, served as the sun dissolves into the sea.

### Arabic

#### gemma-4-26b

Shape: pass. Text outside the JSON: no. Neurons: 4.1. Time: 1598 ms. Raw: `catalog-welcome-cocktail-summary-gemma-4-26b-ar.json`.

**summary**

أمسيتكم الأولى في Colombia في فيلا خاصة في Cartagena. حيث يتولى طاهٍ شخصي إعداد قائمة طعام موسمية من خيرات البحر الكاريبي، تُقدم لكم بينما تغيب الشمس في أعماق البحر.

#### llama-3.3-70b

Shape: pass. Text outside the JSON: no. Neurons: 20.4. Time: 2084 ms. Raw: `catalog-welcome-cocktail-summary-llama-3.3-70b-ar.json`.

**summary**

مساءك الأول في كولومبيا في فيلا خاصة في كارتاجينا. يُقدم طاهٍ شخصي قائمة موسمية من محاصيل البحر الكاريبي، مع شروق الشمس الذي يغمر البحر بالضوء.

#### m2m100-1.2b

Shape: pass. Text outside the JSON: no. Neurons: not reported. Time: 2033 ms. Raw: `catalog-welcome-cocktail-summary-m2m100-1.2b-ar.json`.

**summary**

أول ليلة في كولومبيا في فندق خاص في كاراثاينا.

### Spanish

#### gemma-4-26b

Shape: pass. Text outside the JSON: no. Neurons: 3.6. Time: 1602 ms. Raw: `catalog-welcome-cocktail-summary-gemma-4-26b-es.json`.

**summary**

Su primera noche en Colombia en una villa privada en Cartagena. Un chef personal elabora un menú de temporada con frutos del Caribe, servido mientras el sol se funde en el mar.

#### llama-3.3-70b

Shape: pass. Text outside the JSON: no. Neurons: 19.5. Time: 1871 ms. Raw: `catalog-welcome-cocktail-summary-llama-3.3-70b-es.json`.

**summary**

Su primera velada en Colombia en una villa privada de Cartagena. Un chef personal crea un menú de temporada a partir de las cosechas del Caribe, que se sirve mientras el sol se desvanece en el mar.

#### m2m100-1.2b

Shape: pass. Text outside the JSON: no. Neurons: not reported. Time: 823 ms. Raw: `catalog-welcome-cocktail-summary-m2m100-1.2b-es.json`.

**summary**

Su primera noche en Colombia en una villa privada de Cartagena.Un chef personal prepara un menú estacional de las cosechas del Caribe, servido a medida que el sol se disuelve en el mar.
