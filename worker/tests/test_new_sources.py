import unittest

from rolearch_worker.sources import avature, lidl, teleperformance
from rolearch_worker.sources.successfactors import _from_job_page


class AvatureMarkup(unittest.TestCase):
    def test_result_card_with_extra_classes_and_query_link(self):
        page = (
            '<article class="article article--w--full article--result">'
            '<a class="link" href="https://careers.example.com/en_GB/apply/JobDetail/Cleaner/129687?source=E">Cleaner</a>'
            '<span class="list-item-location">Sydney</span></article>'
        )
        art = avature._ARTICLE.findall(page)
        self.assertEqual(len(art), 1)
        m = avature._LINK.search(art[0])
        self.assertEqual(m.group(1), "https://careers.example.com/en_GB/apply/JobDetail/Cleaner/129687")
        self.assertEqual(m.group(2), "129687")


class SuccessFactorsJobLocation(unittest.TestCase):
    def test_job_location_label(self):
        page = (
            '<span itemprop="title">QA Engineer</span>'
            '<span class="joblayouttoken-label">Job Location: </span> <span>GBR Cheltenham - Project Office, GBR Ipswich ATE</span>'
            '<span class="joblayouttoken-label">Other locations: </span> <span>Primary Location Only</span>'
        )
        job = _from_job_page(page, "https://jobs.example.com/job/QA-Engineer/1377345957/")
        self.assertEqual(job.city_hint, "Cheltenham")
        self.assertTrue(job.location_text.startswith("Cheltenham - Project Office"))


class LidlJobs(unittest.TestCase):
    item = {
        "title": "Retail Shift Manager", "requisitionId": "768430", "client": "UK",
        "jobDetailUrl": "https://careers.lidl.co.uk/jobs/retail-shift-manager-plymouth-768430",
        "recruitingUrl": "https://apply.example/768430", "descResponsibilities": "<p>Lead the shift.</p>", "descHeader": "None",
        "location": {"city": "Plymouth", "state": "", "zipCode": "PL5 3TW", "country": "UK"},
        "onlineFrom": "2026-11-10T17:50:14+00:00", "employmentArea": "Store",
    }

    def test_maps_fields(self):
        raw = lidl._raw("careers.lidl.co.uk", self.item)
        self.assertEqual((raw.external_id, raw.country_hint, raw.city_hint), ("768430", "GB", "Plymouth"))
        self.assertEqual(raw.location_text, "Plymouth, PL5 3TW")
        self.assertEqual(raw.apply_url, "https://apply.example/768430")
        self.assertIn("Lead the shift", raw.description)

    def test_sibling_host_kept_foreign_host_dropped(self):
        ch = dict(self.item, jobDetailUrl="https://jobs.lidl.ch/jobs/x-1", location={"country": "CH"})
        self.assertIsNotNone(lidl._raw("karriere.lidl.ch", ch))
        other = dict(self.item, jobDetailUrl="https://evil.example/jobs/x-1")
        self.assertIsNone(lidl._raw("careers.lidl.co.uk", other))


class TeleperformanceJobs(unittest.TestCase):
    def test_us_state_prefix_and_country(self):
        raw = teleperformance._raw({
            "title": "Professional Recruiter", "url": "https://careersus-teleperformance.icims.com/jobs/94760/x/job",
            "country": "United States", "location": "MI-Warren", "externalId": 94760, "source": "iCIMS",
            "date": "2026-11-13T22:33:00", "workFromHome": "Yes", "description": "<p>Hi</p>",
        })
        self.assertEqual(raw.location_text, "Warren, MI, United States")
        self.assertEqual(raw.country_hint, "US")
        self.assertEqual(raw.workplace_hint, "remote")
        self.assertEqual(raw.external_id, "iCIMS:94760")


class LaterFixes(unittest.TestCase):
    def test_activate_fields(self):
        from rolearch_worker.sources import activate
        self.assertEqual(activate._txt("<span>Kansas City</span>"), "Kansas City")
        self.assertEqual(activate._txt("None"), "")
        self.assertEqual(activate._slug("Store Manager / Co-Op"), "store-manager-co-op")

    def test_successfactors_place_from_url(self):
        page = '<span itemprop="title">Team Member</span>'
        job = _from_job_page(page, "https://jobs.kmart.com.au/KMARTAUNZ/job/Kalgoorlie%2C-WA-Kmart-Kalgoorlie-Team-Member/1369265766/")
        self.assertEqual((job.city_hint, job.location_text), ("Kalgoorlie", "Kalgoorlie, WA"))

    def test_jsonld_drops_null_parts(self):
        from rolearch_worker.sources.jsonld import _to_raw
        raw = _to_raw({"title": "Lead", "jobLocation": {"address": {"addressLocality": "Bedfordshire", "addressRegion": "NULL", "addressCountry": "UK"}}}, "https://x/job/1")
        self.assertEqual(raw.location_text, "Bedfordshire, UK")

    def test_sitemap_keep_pattern_and_uuid_ids(self):
        import re as _re
        from rolearch_worker.sources import sitemap
        keep = _re.compile(r"-(gdms|gac)-opportunity/$")
        self.assertTrue(keep.search("https://www.gd.com/careers/engineer-groton-ct-us-1-gdms-opportunity/"))
        self.assertFalse(keep.search("https://www.gd.com/careers/analyst-rq1-gdit-opportunity/"))
        self.assertTrue(sitemap._JOB_ID.search("/jobs/admin-assistant-new-york-1ecaa3d1-95b4-497d-bdee-be6205c1d989"))
        self.assertFalse(sitemap._JOB_ID.search("/jobs/clerical-and-administrative-support/"))


if __name__ == "__main__":
    unittest.main()
