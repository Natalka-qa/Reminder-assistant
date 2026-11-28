// sprint-24-tasks.md S24-02 — what OCR (tesseract.js, eng+spa+rus+ukr) read
// from six real screenshots on 2026-10-17, noise and all. Names, card,
// ticket and booking numbers are replaced or left out; the layout, the
// mistakes and the extra dates are kept — they're what the rules are for.

/** A cinema ticket PDF: two copies of the same purchase. */
export const CINEMA = `. =>
11:40 N и! т ET
OCINE COMPROBANTE DE COMPRA - COPIA PARA EL RECINTO
SPIDER-MAN: BRAND NEW DAY (ATMOS) (VOSE)
Fecha: Domingo, 02 de agosto 2026 ENTRADAS
Hora: 18:45 NORMAL INTERNET 2 12.70 € 25.40 €
Sala: SALA 5
Fila: С
Butacas: 4, 5
ОСІМЕ PREMIUM AQUA
OCINE VALENCIA, S.L.
C/MENORCA, 19
46023 VALENCIA
B00000000
Tipo de compra: INTERNET
Tipo de dia: FESTIU
Código de compra: 000000000000
Factura: 0000000
Series: 000000, 000000
Código de comercio: PPS000000000
Autorización: 000000
№ Тед: 00000000000 Importe total Iva incido 25.40€
Operación: 0000
OCINE COMPROBANTE DE COMPRA - COPIA PARA EL CLIENTE
SPIDER-MAN: BRAND NEW DAY (ATMOS) (VOSE)
Fecha: Domingo, 02 de agosto 2026 ENTRADAS
Hora: 18:45 NORMAL INTERNET 2 12.70 © 25.40 ©
Sala: SALA 5`;

/** A train ticket (iryo): departure and arrival in columns. */
export const TRAIN = `11:42 N ии от ET
x Omio_Print_Tickets_ABC123.pdf
TE
o га
iryo em ¢
2030
ZA Madrid-Chamartin Valencia-Joaquin
FE Sorolla
A Hels Departure Train Arrival
Fa 30.08.2026 06102 30.08.2026
RY 10:45 12:44
LOCATOR: ABC123 TICKET: 0000000000000
CARRIAGE SEAT
4 13A
Inicial Superior EUR 29.24
TOTAL PRICE: EUR 29.24
More information on iryo.eu
arry-on baggage allowance .
E FEE iryo-conecta
hs a x. ск We give you €10
De e e for yourtaxi rides
У OF CHOOSING YOUR OWN DESTINATION.
люуп at Scan the QR code and book your rental car \\
2 _ Madrid-Chamartin Valencia-Joaquin
Drive Share`;

/** A bus ticket (ALSA): two columns run together, a purchase date first. */
export const BUS = `. =>
пот
11:42 N ul DE
Tubillete
TRANSPORTES BACOMA SA
Fecha de compra 03/08/2026 a S а
Factura simplificada: 000-0-000-0000000-0
Importe total 2.806 IVA Incluido]
Observaciones 3 octubre 2026 3octubre 2026
IMPORTANTE: Por su seguridad el uso del cinturón de seguridad es . °
cin 10:00 14:15
CONSULTE ANDEN DE SALIDA ANTES DE EMBARCAR
INFORMACION PROTECCION DE DATOS VALENCIA BARCELONA
RESPONSABLE: Empresa operadora de transporte ALSA
FINALIDAD: gestión proceso de compra ESTACIÓN DE (NORD)
NORMATIVA EQUIPAJE: AUTOBÚS
Mochiafbotso en bandeja portaobjetos у maleta de máx 20 en
maletero. ESTACION DE AUTOBUSES, ESTACION DEL NORTE,
AVENIDA MENENDEZPIDAL 13 САНА еб Во,
VALENCIA "BARCELONA
Condiciones tarifa
Cambios: Gratis hasta 7 ias antes de La salida 90% de reembolso entre 7 Autobús Asiento
las у 46h 80% de reembolso entre 48h y 24h y 70% de reembolso entre
24 2h antes deta salida del servicio 1 11
Anulaciones: Reembolso del 901 hasta 7 das antes dea sada del
entre 24y 2h reembolso del 50% Linea: SEVLLA-VALENCIA-BARCELONA
Setección de asiento desde 25€ o
20kg en total (máx. 2 bultos)
Importante para viajar
Drive Share`;

/** A chat with a beauty studio: the booking is the last line. */
export const CHAT_EPILATION = `11:41 ® a! 7 80
+m  Savita.estetica
< "Business chat v O
Inquire View profile
Щоб процедура пройшла
максимально ефективно та
комфортно, просимо
дотримуватися наступних
рекомендацій:
1.  Поголіть зону епіляції мінімум
за 4-6 годин до процедури.
Шкіра має бути гладко
поголеною.
2. У день процедури не
використовуйте дезодоранти або
антиперспіранти на ділянці, яка
буде оброблятися лазером.
3. He засмагайте протягом 2-3
днів до процедури.
4. Не використовуйте агресивні
косметичні засоби (пілінги,
скраби) на зоні епіляції за 10-14
днів до сеансу.
Якщо у вас виникли будь-які
запитання чи сумніви,
обов'язково зверніться до
адміністратора або спеціаліста
перед процедурою.
«соя Записуемо завтра на 18:00 +`;

/** A chat message: Latin letters read in place of Cyrillic ones. */
export const CHAT_MASSAGE = `Доброго дня, підкажіть, субота,
24ro Ha 13.00, чи e бажання Ta
змога прийти Ha масаж? Дякую
8 заздалегідь Ta гарного дня 3
о м`;

/** An event ticket: the event's start, and the ticket's own slot. */
export const EVENT = `11:40 N HR EL
XX M ее
я 10:00AM
€ eventbrite 11 Sep 2026
EVENT
Gran Venta de Plantas - Valencia
TICKET
Valencia | 12/09 14:00 - 15:00
WHERE
Spirit Valencia Swing Project - 6 Carrer d'Honorat
Juan - 46007 Valencia - Espagne
-"ш
оо
"и
[=] 1-8;
[|
<
o`;

// 2026-11-27 — Cine Yelmo's PDF (Telegram, pdf-lines.ts): each label on
// its own line, ending in a colon, the value below it.
export const YELMO_PDF = `cine yelmo
Tu entrada
Estimado cliente:
Gracias por usar el servicio de Cine Yelmo. Los datos de tu
compra están indicados a continuación. ¡Que disfrutes tu
sesión!
Datos del pedido:
Número de confirmación:
333964
Cine:
Mercado de Campanar
Película:
SCROOGE Y LOS FANTASMAS DE LA NAVIDAD 2D
INGLÉS SUBTITULADO EN ESPAÑOL (VOSE)
Sala: Fecha: Sesión:
6 Sábado, 28 de noviembre de 2026 20:00
Butacas:
710, 711
Transacción de entradas:
2499321
ID del cine:
811
# Entradas Precio
(2) ADULTO 17,80 €
Total (IVA incluido): 17,80€
Gastos de gestión, IVA/IGIC y recargos incluidos, ver detalles
Código de tu entrada`;

// 2026-11-27 — a hairdresser's Instagram chat (OCR): the date is "5.12"
// next to "14:45", and the length is said in words.
export const CHAT_HAIRCUT = `13:20
olgaa.kalinina
Business chat
Enquire View profile
Доброе утро!
На короткие волосы 120€+
стрижка 20€
Около 2,5 час
На когда можно записаться?
В какое время приблизительно,
вечернее?
На выходных с 11 до 18
В субботу 5.12 в 14:45
Окей
Я Андрей
Телефон 627917948
Message...`;
