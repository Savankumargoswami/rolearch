import asyncio
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

from rolearch_worker.geo import parse_location
from rolearch_worker.models import Company, RawJob, Salary
from rolearch_worker.normalize import normalize
from rolearch_worker import shards
from rolearch_worker.run import pull_one
from rolearch_worker.sources import ashby, greenhouse, lever, workable
from rolearch_worker.store import JsonStore
from rolearch_worker.text import (
    clean_title,
    extract_skills,
    html_to_text,
    in_launch_field,
    level_of,
    summarize,
    visa_offered,
    years_required,
)


class FakeHttp:
    """Stands in for Fetcher: returns canned JSON per URL prefix."""

    def __init__(self, routes):
        self.routes = routes

    async def json(self, url, **kw):
        for prefix, payload in self.routes.items():
            if url.startswith(prefix):
                if isinstance(payload, Exception):
                    raise payload
                return payload
        raise AssertionError(f"unexpected url {url}")


class Geo(unittest.TestCase):
    def test_city_state(self):
        p = parse_location("San Francisco, CA")
        self.assertEqual((p.country, p.city), ("US", "San Francisco"))

    def test_city_country(self):
        p = parse_location("Bengaluru, Karnataka, India")
        self.assertEqual(p.country, "IN")
        self.assertIsNotNone(p.lat)

    def test_remote_scope(self):
        p = parse_location("Remote - United Kingdom")
        self.assertTrue(p.remote)
        self.assertEqual(p.country, "GB")

    def test_bare_city(self):
        self.assertEqual(parse_location("Dublin").country, "IE")

    def test_default_country(self):
        self.assertEqual(parse_location("Head Office", default_country="DE").country, "DE")

    def test_remote_without_country_has_none(self):
        self.assertIsNone(parse_location("Remote", default_country="US").country)

    def test_street_address_town(self):
        # Store chains give the street address first; the town is the part after it.
        p = parse_location("220 SOUTH FM 1626, Buda, Texas,United States")
        self.assertEqual((p.city, p.country), ("Buda", "US"))
        self.assertEqual(parse_location("Suite 200, 55 Main St, Frisco, TX").city, "Frisco")


class Text(unittest.TestCase):
    def test_greenhouse_escaped_html(self):
        self.assertEqual(html_to_text("&lt;p&gt;Hello &amp;amp; welcome&lt;/p&gt;"), "Hello & welcome")

    def test_skills_ranked(self):
        s = extract_skills("We use Python and SQL. Python daily, Spark weekly, some dbt.")
        self.assertEqual(s[0], "Python")
        self.assertIn("dbt", s)
        self.assertNotIn("Java", extract_skills("JavaScript only"))

    def test_level(self):
        self.assertEqual(level_of("Senior Data Engineer"), "senior")
        self.assertEqual(level_of("Staff ML Engineer"), "lead")
        self.assertEqual(level_of("Data Analyst Intern"), "entry")
        self.assertEqual(level_of("Data Engineer"), "mid")

    def test_years(self):
        self.assertEqual(years_required("You have 5+ years of professional experience."), 5)
        self.assertEqual(years_required("No experience needed."), 0)

    def test_visa(self):
        self.assertTrue(visa_offered("We offer visa sponsorship and relocation."))
        self.assertFalse(visa_offered("We are unable to provide visa sponsorship for this role."))
        self.assertFalse(visa_offered("Great team."))

    def test_field(self):
        for yes in ["Senior Data Engineer", "Machine Learning Engineer, Ranking", "Senior Fraud Data Analyst - Luxembourg",
                    "Data Analytics & Strategy Intern", "Research Scientist, RL", "Analytics Engineer", "Applied AI Engineer"]:
            self.assertTrue(in_launch_field(yes), yes)
        for no in ["Data Center Technician", "Account Executive", "Finance Analyst (Reemplazo)", "Senior Talent Planning Analyst",
                   "Product Manager, Privacy & Data Governance", "Senior Compliance Analyst", "AI Sales Engineer"]:
            self.assertFalse(in_launch_field(no), no)

    def test_title_and_summary(self):
        self.assertEqual(clean_title("Grupo QuintoAndar | Staff Data Engineer", "QuintoAndar"), "Staff Data Engineer")
        self.assertEqual(clean_title("Data Engineer | Payments", "Acme"), "Data Engineer | Payments")
        self.assertEqual(summarize("Come do the best work of your life with the brightest minds in the industry."), "")
        self.assertTrue(summarize("Acme makes widgets for everyone around the world. In this role you'll own our Spark pipelines end to end.").startswith("In this role"))

    def test_excel_only_as_product(self):
        self.assertNotIn("Excel", extract_skills("You excel at distributed systems."))
        self.assertIn("Excel", extract_skills("Advanced Excel and SQL."))

    def test_hybrid_is_not_a_city(self):
        p = parse_location("Hybrid", default_country="US")
        self.assertEqual((p.city, p.country), (None, "US"))


class Sources(unittest.TestCase):
    co = Company("Acme", "US", "greenhouse", "acme")

    def run_async(self, coro):
        return asyncio.run(coro)

    def test_greenhouse(self):
        http = FakeHttp({"https://boards-api.greenhouse.io/v1/boards/acme/jobs": {"jobs": [{
            "id": 1, "title": "Data Engineer", "absolute_url": "https://acme.com/careers?gh_jid=1",
            "location": {"name": "London"}, "first_published": "2026-10-01T10:00:00-04:00",
            "content": "&lt;p&gt;You will build pipelines in Python.&lt;/p&gt;",
            "pay_input_ranges": [{"min_cents": 8000000, "max_cents": 10000000, "currency_type": "GBP"}],
        }]}})
        [j] = self.run_async(greenhouse.fetch(http, self.co))
        self.assertEqual(j.apply_url, "https://acme.com/careers?gh_jid=1")
        self.assertEqual((j.salary.min, j.salary.currency), (80000, "GBP"))
        self.assertIn("Python", j.description)

    def test_lever_apply_url_and_country(self):
        http = FakeHttp({"https://api.lever.co/v0/postings/acme": [{
            "id": "abc", "text": "ML Engineer", "hostedUrl": "https://jobs.lever.co/acme/abc",
            "applyUrl": "https://jobs.lever.co/acme/abc/apply", "categories": {"location": "Toronto"},
            "country": "ca", "workplaceType": "hybrid", "createdAt": 1790000000000, "descriptionPlain": "Join our team.",
        }]})
        [j] = self.run_async(lever.fetch(http, Company("Acme", "US", "lever", "acme")))
        self.assertEqual(j.apply_url, "https://jobs.lever.co/acme/abc/apply")
        self.assertEqual((j.country_hint, j.workplace_hint), ("CA", "hybrid"))

    def test_ashby_salary_and_unlisted(self):
        http = FakeHttp({"https://api.ashbyhq.com/posting-api/job-board/acme": {"jobs": [
            {"id": "1", "title": "Analytics Engineer", "jobUrl": "https://jobs.ashbyhq.com/acme/1", "isListed": True,
             "location": "New York", "workplaceType": "Remote", "address": {"postalAddress": {"addressCountry": "USA"}},
             "compensation": {"summaryComponents": [{"compensationType": "Salary", "minValue": 150000, "maxValue": 190000,
                                                     "currencyCode": "USD", "interval": "1 YEAR"}]}},
            {"id": "2", "title": "Hidden", "jobUrl": "https://jobs.ashbyhq.com/acme/2", "isListed": False},
        ]}})
        jobs = self.run_async(ashby.fetch(http, Company("Acme", "US", "ashby", "acme")))
        self.assertEqual(len(jobs), 1)
        self.assertEqual((jobs[0].country_hint, jobs[0].workplace_hint, jobs[0].salary.max), ("US", "remote", 190000))

    def test_workable(self):
        http = FakeHttp({"https://apply.workable.com/api/v1/widget/accounts/acme": {"jobs": [{
            "shortcode": "X1", "title": "Data Scientist", "url": "https://apply.workable.com/j/X1",
            "application_url": "https://apply.workable.com/j/X1/apply", "country": "France", "city": "Paris",
            "telecommuting": False, "published_on": "2026-10-01", "description": "<p>Hi</p>",
        }]}})
        [j] = self.run_async(workable.fetch(http, Company("Acme", "US", "workable", "acme")))
        self.assertEqual((j.country_hint, j.apply_url), ("FR", "https://apply.workable.com/j/X1/apply"))


class Normalize(unittest.TestCase):
    def test_record(self):
        now = datetime(2026, 10, 14, tzinfo=timezone.utc)
        raw = RawJob("9", "Senior Data Engineer", "https://acme.com/jobs/9", "https://acme.com/jobs/9/apply",
                     location_text="Berlin, Germany", posted_at=now - timedelta(days=3),
                     description="You'll build Spark and Kafka pipelines. 5+ years of experience. We offer visa sponsorship.",
                     salary=Salary(70000, 90000, "eur", "year"))
        j = normalize(Company("Acme Corp", "US", "greenhouse", "acme"), raw, now)
        self.assertEqual((j["city"], j["country"], j["region"]), ("Berlin", "Germany", "europe"))
        self.assertEqual((j["level"], j["years"], j["visa"], j["postedDaysAgo"]), ("senior", 5, True, 3))
        self.assertEqual(j["applyUrl"], "https://acme.com/jobs/9/apply")
        self.assertEqual(j["salary"]["currency"], "EUR")
        self.assertTrue(j["id"].startswith("acme-corp-senior-data-engineer-"))
        self.assertTrue(j["launchField"])
        # Same posting -> same id every run
        self.assertEqual(j["id"], normalize(Company("Acme Corp", "US", "greenhouse", "acme"), raw, now)["id"])

    def test_stores_in_unknown_towns_stay_separate(self):
        # Two stores' "Shift Supervisor" openings are two jobs, even when the towns aren't in the gazetteer.
        co = Company("Pharmacy Co", "US", "phenom", "x")
        a = normalize(co, RawJob("1", "Shift Supervisor", "https://x/1", "https://x/1", location_text="12 Elm St, Smalltown, Texas, United States"))
        b = normalize(co, RawJob("2", "Shift Supervisor", "https://x/2", "https://x/2", location_text="9 Oak Rd, Othertown, Texas, United States"))
        self.assertNotEqual(a["dedupeKey"], b["dedupeKey"])

    def test_remote_worldwide(self):
        raw = RawJob("1", "Data Analyst", "https://x/1", "https://x/1", location_text="Remote")
        j = normalize(Company("X", "US", "lever", "x"), raw)
        self.assertEqual((j["city"], j["country"], j["region"], j["workplace"]), ("Remote", "Worldwide", "global", "remote"))


class DeadBoard(unittest.TestCase):
    def test_board_with_dead_apply_links_is_not_imported(self):
        class Resp:
            status_code = 404

        class DeadLinks(FakeHttp):
            async def get(self, url, **kw):
                return Resp()

        http = DeadLinks({"https://boards-api.greenhouse.io": {"jobs": [
            {"id": 1, "title": "Data Engineer", "absolute_url": "https://gone.example/1", "location": {"name": "Berlin"}}
        ]}})
        with tempfile.TemporaryDirectory() as d:
            store = JsonStore(Path(d) / "s.json")
            r = asyncio.run(pull_one(http, store, Company("Gone", "DE", "greenhouse", "gone")))
            self.assertIn("dead", r.error)
            self.assertEqual(store.previous_count(Company("Gone", "DE", "greenhouse", "gone")), 0)


class StoreAndGuard(unittest.TestCase):
    def test_close_missing_and_drop_guard(self):
        co = Company("Acme", "US", "greenhouse", "acme")
        jobs = [{"jobs": [{"id": i, "title": f"Data Engineer {i}", "absolute_url": f"https://a/{i}", "location": {"name": "Austin, TX"}}
                          for i in range(25)]}]
        with tempfile.TemporaryDirectory() as d:
            store = JsonStore(Path(d) / "s.json")
            http = FakeHttp({"https://boards-api.greenhouse.io": jobs[0]})
            r = asyncio.run(pull_one(http, store, co))
            self.assertEqual((r.total, r.added, r.closed), (25, 25, 0))
            # One job removed from the board -> closed
            http.routes = {"https://boards-api.greenhouse.io": {"jobs": jobs[0]["jobs"][1:]}}
            r = asyncio.run(pull_one(http, store, co))
            self.assertEqual((r.total, r.added, r.closed), (24, 0, 1))
            # Board suddenly empty -> treated as a feed failure, nothing closed
            http.routes = {"https://boards-api.greenhouse.io": {"jobs": []}}
            r = asyncio.run(pull_one(http, store, co))
            self.assertIn("returned 0 jobs", r.error)
            self.assertEqual(store.previous_count(co), 24)
            # Network error -> recorded, nothing closed
            http.routes = {"https://boards-api.greenhouse.io": RuntimeError("timeout")}
            r = asyncio.run(pull_one(http, store, co))
            self.assertTrue(r.error)
            self.assertEqual(store.previous_count(co), 24)


if __name__ == "__main__":
    unittest.main()


class Shards(unittest.TestCase):
    def test_every_company_in_exactly_one_shard(self):
        cos = [Company(f"C{i}", "US", "greenhouse", f"c{i}") for i in range(300)]
        weights = {cos[0].key: 90000, cos[1].key: 50000, cos[2].key: 40000}
        picked = [c.key for i in range(24) for c in cos if shards.assign(cos, 24, weights)[c.key] == i]
        self.assertEqual(sorted(picked), sorted(c.key for c in cos))
        # The giants land in different shards.
        a = shards.assign(cos, 24, weights)
        self.assertEqual(len({a[cos[0].key], a[cos[1].key], a[cos[2].key]}), 3)
