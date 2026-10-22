// Which backdrop the profile header draws, from what the person does (headline + current job title).
// A compact take on the job categories (lib/categories.ts, worker/rolearch_worker/categories.py), grouped into scenes.

export const SCENES = ["pipeline", "code", "pulse", "route", "blueprint", "curves", "chart", "orbits", "radar", "warmth", "contours"] as const;
export type Scene = (typeof SCENES)[number];

const RULES: [Scene, RegExp][] = [
  ["pipeline", /\bdata (engineer|scien|analy|architect|platform)|\bmachine learning|\b(ml|ai|llm|nlp) (engineer|scientist|researcher)|\banalytics\b|\bbusiness intelligence|\betl\b|\bstatistic/],
  ["pulse", /\bnurs|\b(rn|lpn|cna)\b|\bphysician|\bdoctor|\bsurgeon|\bdent(ist|al)|\bpharmac|\btherap|\bclinical|\bmedical|\bcaregiv|\bparamedic|\bpatient|\bhospital|\bhealth ?care|\bveterinar|\bradiolog|\bphlebotom/],
  ["radar", /\bsecurity (officer|guard)|\bguard\b|\bpolice|\bfirefight|\bsheriff|\bpatrol|\bloss prevention|\bcorrections officer/],
  ["route", /\bdriver\b|\bdelivery|\bcourier|\bchauffeur|\bwarehouse|\blogistics|\bsupply chain|\bforklift|\bdispatch|\bfreight|\bshipping|\bfulfil/],
  ["code", /\bsoftware|\bdeveloper|\bprogrammer|\bfront-?end|\bback-?end|\bfull[- ]?stack|\bdevops|\bsre\b|\bcloud|\bcyber|\bit (support|specialist|manager|administrator)|\bhelp ?desk|\bproduct (manager|owner)|\bweb\b|\bmobile|\bios\b|\bandroid/],
  ["curves", /\bdesign|\bux\b|\bui\b|\bgraphic|\billustrat|\banimat|\bphotograph|\bvideo|\bart director|\bmarketing|\bbrand|\bcontent|\bcopywrit|\bsocial media|\bcommunications/],
  ["chart", /\baccount(ant|ing)|\bfinanc|\baudit|\btax\b|\bbank|\binvest|\btrader|\bactuar|\bunderwrit|\bsales\b|\baccount (executive|manager)|\bbusiness development|\bwealth|\bloan/],
  ["orbits", /\bscientist|\bresearch|\bchemist|\bbiolog|\bphysicist|\blab(oratory)?\b|\bteach|\btutor|\bprofessor|\blecturer|\binstructor|\beducat|\bschool|\bprincipal\b/],
  ["warmth", /\bchef|\bcook\b|\bkitchen|\bbarista|\bbartender|\bwait(er|ress)|\bhotel|\bhospitality|\brestaurant|\bcashier|\bretail|\bstore|\bcustomer (service|support|success|experience)|\bcall cent|\bconcierge/],
  ["blueprint", /\bengineer|\barchitect|\belectrician|\bplumb|\bcarpenter|\bweld|\bhvac|\bmechanic|\bconstruction|\bmachinist|\bmanufactur|\bproduction|\bassembl|\btechnician|\bmaintenance|\bfacilit|\binstall/],
];

export function occupationScene(...texts: (string | null | undefined)[]): Scene {
  const s = texts.filter(Boolean).join(" ").toLowerCase();
  return RULES.find(([, rx]) => rx.test(s))?.[0] ?? "contours";
}
