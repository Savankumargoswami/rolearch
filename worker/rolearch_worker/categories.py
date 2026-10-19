"""Occupation categories for every job, white- and blue-collar.

Checked in order against the job title; the first match wins. Specific roles come before broad
ones ("data engineer" is Data & AI, not Engineering). When the title doesn't decide, the source's
own category label (Adzuna, USAJOBS) is mapped instead.
"""

from __future__ import annotations

import re

CATEGORY_RULES: list[tuple[str, str]] = [
    ("data", r"\bdata (engineer|scientist|science|analyst|analytics|architect|platform)|\bmachine learning|\b(ml|ai|llm|nlp) (engineer|scientist|researcher)|\banalytics engineer|\bbusiness intelligence|\bbi (analyst|developer|engineer)|\bstatistician\b"),
    ("driving", r"\bdriver\b|\bchauffeur\b|\bdelivery (associate|partner|person|driver)|\bcourier\b|\bshopper\b"),
    ("logistics", r"\bwarehouse\b|\bpicker\b|\bpacker\b|\bmaterial handler|\bforklift\b|\bloader\b|\bstock(er| associate| clerk)|\bfulfil?ment\b|\bshipping\b|\breceiving\b|\blogistics\b|\bsupply chain\b|\binventory\b|\bdispatcher\b"),
    ("healthcare", r"\bnurse\b|\bnursing\b|\b(rn|lpn|lvn|cna)\b|\bphysician\b|\bdoctor\b|\bsurgeon\b|\bdentist|\bdental\b|\bpharmac|\btherapist\b|\bclinical\b|\bmedical\b|\bcaregiver\b|\bcare (assistant|worker|aide)|\bhome health\b|\bpatient\b|\bparamedic\b|\bemt\b|\bradiolog|\bsonograph|\bphlebotom|\bveterinar|\bpsychiatr|\bpsycholog|\bhealthcare\b|\bhospital\b"),
    ("trades", r"\belectrician\b|\bplumber\b|\bcarpenter\b|\bwelder\b|\bhvac\b|\bmechanic\b|\bconstruction\b|\bbuilder\b|\blabou?rer\b|\broofer\b|\bpainter\b|\bmason\b|\bpipefitter\b|\bmillwright\b|\binstaller\b|\bapprentice\b|\blineman\b|\bjourneyman\b|\bheavy equipment"),
    ("manufacturing", r"\bmachine operator\b|\bproduction (worker|operator|associate|supervisor|technician)|\bassembl(er|y)\b|\bmanufacturing\b|\bfactory\b|\bcnc\b|\bmachinist\b|\bfabricat|\bquality (inspector|control)|\bplant (operator|manager)\b|\bpackag"),
    ("facilities", r"\bjanitor|\bcustodian|\bcleaner\b|\bcleaning\b|\bhousekeep|\bgroundskeeper|\blandscap|\bmaintenance (worker|technician|associate)|\bfacilities\b|\bporter\b|\bpest control"),
    ("hospitality", r"\bcook\b|\bchef\b|\bkitchen\b|\bdishwasher\b|\bwaiter|\bwaitress|\bbartender\b|\bbarista\b|\bhost(ess)?\b|\brestaurant\b|\bfood (service|prep)|\bcatering\b|\bhotel\b|\bfront desk\b|\bconcierge\b|\bcrew member\b|\bhospitality\b|^server\b"),
    ("retail", r"\bcashier\b|\bretail\b|\bstore (associate|manager|clerk)|\bsales associate\b|\bmerchandis|\bshop assistant|\bteam member\b"),
    ("security", r"\bsecurity (officer|guard)|\bguard\b|\bpolice\b|\bfirefight|\bcorrections\b|\bdetective\b|\bsheriff\b|\bloss prevention|\bpatrol\b"),
    ("software", r"\bsoftware\b|\bdeveloper\b|\bprogrammer\b|\b(frontend|front-end|backend|back-end|full[- ]?stack|mobile|ios|android|web|devops|site reliability|sre|platform|cloud|security|network|systems|qa|test|infrastructure) (engineer|developer|architect|administrator)|\bit (support|specialist|manager|technician|administrator)|\bhelp ?desk\b|\bsysadmin\b|\bcyber|\binformation technology"),
    ("design", r"\bdesigner\b|\bux\b|\bui\b|\bgraphic\b|\billustrat|\bvideo (editor|producer)|\bphotograph|\banimator\b|\bcopywriter\b|\bart director"),
    ("marketing", r"\bmarketing\b|\bseo\b|\bsocial media\b|\bcontent (writer|manager|strategist)|\bcommunications\b|\bpublic relations\b|\bbrand\b"),
    ("sales", r"\bsales\b|\baccount (executive|manager)|\bbusiness development\b|\bbdr\b|\bsdr\b|\breal estate agent\b|\binsurance agent\b"),
    ("customer", r"\bcustomer (service|support|success|care|experience)|\bcall cent(er|re)\b|\bcontact cent(er|re)\b|\bclient (services|support)\b|\bsupport (agent|specialist|representative)"),
    ("finance", r"\baccountant\b|\baccounting\b|\bbookkeep|\bfinanc|\bauditor\b|\baudit\b|\btax\b|\bpayroll\b|\bcontroller\b|\btreasur|\bactuar|\bunderwrit|\bbank(ing|er)\b|\binvestment\b|\bcredit\b|\bloan officer"),
    ("hr", r"\bhuman resources\b|\bhr\b|\brecruit(er|ing|ment)\b|\btalent (acquisition|partner)|\bpeople (partner|operations)|\bcompensation\b|\bbenefits\b"),
    ("legal", r"\battorney\b|\blawyer\b|\blegal\b|\bparalegal\b|\bcounsel\b|\bsolicitor\b|\bcompliance\b|\bjudge\b"),
    ("education", r"\bteacher\b|\bteaching\b|\btutor\b|\bprofessor\b|\blecturer\b|\binstructor\b|\beducat|\bschool\b|\bchildcare\b|\bnanny\b|\bdaycare\b"),
    ("science", r"\bscientist\b|\bresearch(er)?\b|\blab(oratory)? (technician|assistant)|\bchemist\b|\bbiolog|\bphysicist\b|\bepidemiolog|\bgeolog"),
    ("engineering", r"\bengineer\b|\bengineering\b|\bdrafts(man|person)\b|\barchitect\b|\btechnician\b"),
    ("social", r"\bsocial worker\b|\bcase manager\b|\bcounsel?or\b|\bsupport worker\b|\byouth worker\b"),
    ("admin", r"\badministrative\b|\badmin\b|\bassistant\b|\breceptionist\b|\boffice (manager|coordinator|assistant)|\bclerk\b|\bdata entry\b|\bsecretary\b|\bcoordinator\b|\boperations\b|\bproject manager\b|\bprogram (manager|analyst|specialist)|\bmanagement analyst\b|\banalyst\b|\bspecialist\b|\bmanager\b"),
]
_rules = [(c, re.compile(p, re.I)) for c, p in CATEGORY_RULES]

_HINTS: list[tuple[str, str]] = [
    ("software", r"it jobs|information technology|computer|telecommunication"),
    ("data", r"\bdata\b|statistic|mathematic"),
    ("healthcare", r"health|nurs|medical|pharmac|dental|clinic"),
    ("logistics", r"logistics|warehouse|supply"),
    ("driving", r"transport|driv|motor vehicle"),
    ("trades", r"trade|construction|electric|plumb|maintenance|mechanic|wage grade"),
    ("manufacturing", r"manufactur|production"),
    ("facilities", r"cleaning|domestic|custodial|facilit"),
    ("hospitality", r"hospitality|catering|food|travel"),
    ("retail", r"retail"),
    ("security", r"security|police|fire|correction|law enforcement"),
    ("sales", r"sales"),
    ("marketing", r"marketing|advertising|public affairs"),
    ("customer", r"customer"),
    ("finance", r"account|financ|budget|auditing|banking"),
    ("hr", r"\bhr\b|human resource|recruit"),
    ("legal", r"legal|attorney|\blaw\b"),
    ("education", r"teach|education|training"),
    ("science", r"scien|research|biolog|chemi|physic"),
    ("engineering", r"engineer"),
    ("social", r"social|charity|voluntary"),
    ("design", r"creative|design"),
    ("admin", r"admin|clerical|office|management|consult|property|graduate"),
]
_hints = [(c, re.compile(p, re.I)) for c, p in _HINTS]

CATEGORIES = [c for c, _ in CATEGORY_RULES] + ["other"]


def category_of(title: str, hint: str | None = None) -> str:
    for cat, rx in _rules:
        if rx.search(title):
            return cat
    if hint:
        for cat, rx in _hints:
            if rx.search(hint):
                return cat
    return "other"
