export const ISO_COUNTRY_CODES = Object.freeze(
  "AD,AE,AF,AG,AI,AL,AM,AO,AQ,AR,AS,AT,AU,AW,AX,AZ,BA,BB,BD,BE,BF,BG,BH,BI,BJ,BL,BM,BN,BO,BQ,BR,BS,BT,BV,BW,BY,BZ,CA,CC,CD,CF,CG,CH,CI,CK,CL,CM,CN,CO,CR,CU,CV,CW,CX,CY,CZ,DE,DJ,DK,DM,DO,DZ,EC,EE,EG,EH,ER,ES,ET,FI,FJ,FK,FM,FO,FR,GA,GB,GD,GE,GF,GG,GH,GI,GL,GM,GN,GP,GQ,GR,GS,GT,GU,GW,GY,HK,HM,HN,HR,HT,HU,ID,IE,IL,IM,IN,IO,IQ,IR,IS,IT,JE,JM,JO,JP,KE,KG,KH,KI,KM,KN,KP,KR,KW,KY,KZ,LA,LB,LC,LI,LK,LR,LS,LT,LU,LV,LY,MA,MC,MD,ME,MF,MG,MH,MK,ML,MM,MN,MO,MP,MQ,MR,MS,MT,MU,MV,MW,MX,MY,MZ,NA,NC,NE,NF,NG,NI,NL,NO,NP,NR,NU,NZ,OM,PA,PE,PF,PG,PH,PK,PL,PM,PN,PR,PS,PT,PW,PY,QA,RE,RO,RS,RU,RW,SA,SB,SC,SD,SE,SG,SH,SI,SJ,SK,SL,SM,SN,SO,SR,SS,ST,SV,SX,SY,SZ,TC,TD,TF,TG,TH,TJ,TK,TL,TM,TN,TO,TR,TT,TV,TW,TZ,UA,UG,UM,US,UY,UZ,VA,VC,VE,VG,VI,VN,VU,WF,WS,YE,YT,ZA,ZM,ZW".split(",")
);

const COUNTRY_LABEL_OVERRIDES = new Map([
  ["BN", "Brunei Darussalam"],
  ["BO", "Bolivia"],
  ["CD", "Congo, Democratic Republic of the"],
  ["CG", "Congo"],
  ["CI", "Côte d’Ivoire"],
  ["CZ", "Czechia"],
  ["GB", "United Kingdom"],
  ["IR", "Iran"],
  ["KR", "Korea, Republic of"],
  ["KP", "Korea, Democratic People’s Republic of"],
  ["LA", "Lao People’s Democratic Republic"],
  ["MD", "Moldova"],
  ["PS", "Palestine"],
  ["RU", "Russian Federation"],
  ["SY", "Syrian Arab Republic"],
  ["TW", "Taiwan"],
  ["TZ", "Tanzania"],
  ["US", "United States"],
  ["VA", "Holy See"],
  ["VE", "Venezuela"],
  ["VN", "Viet Nam"]
]);

const ENGLISH_REGION_NAMES =
  typeof Intl?.DisplayNames === "function"
    ? new Intl.DisplayNames(["en"], { type: "region" })
    : null;

export function countryLabelForCode(value) {
  const code = String(value ?? "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return code;
  return COUNTRY_LABEL_OVERRIDES.get(code) ?? ENGLISH_REGION_NAMES?.of(code) ?? code;
}

export function buildCountryOptions(codes = ISO_COUNTRY_CODES) {
  return [...codes]
    .map((code) => ({
      code,
      label: countryLabelForCode(code)
    }))
    .sort((left, right) => left.label.localeCompare(right.label, "en"));
}
