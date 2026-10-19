import unittest

from rolearch_worker.categories import category_of


class CategoryTests(unittest.TestCase):
    def test_titles(self):
        cases = {
            "Senior Data Engineer": "data",
            "CDL-A Truck Driver": "driving",
            "Delivery Driver": "driving",
            "Warehouse Associate": "logistics",
            "Forklift Operator": "logistics",
            "Registered Nurse - ICU": "healthcare",
            "Line Cook": "hospitality",
            "Cashier": "retail",
            "Electrician Apprentice": "trades",
            "Software Engineer II": "software",
            "Backend Engineer": "software",
            "Accountant": "finance",
            "Chief Financial Officer": "finance",
            "Honors Attorney": "legal",
            "Security Officer": "security",
            "Janitor": "facilities",
            "Machine Operator": "manufacturing",
            "Mechanical Engineer": "engineering",
            "Customer Service Representative": "customer",
            "Account Executive": "sales",
            "Kindergarten Teacher": "education",
            "Product Designer": "design",
            "Recruiter": "hr",
            "Administrative Assistant": "admin",
            "Research Scientist": "science",
        }
        wrong = {t: category_of(t) for t, want in cases.items() if category_of(t) != want}
        self.assertEqual(wrong, {})

    def test_hint_fallback(self):
        self.assertEqual(category_of("Shop, Deliver, Earn Cash", "Hospitality & Catering Jobs"), "hospitality")
        self.assertEqual(category_of("Something unusual"), "other")


if __name__ == "__main__":
    unittest.main()
