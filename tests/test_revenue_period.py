import sys
import unittest
from datetime import date, datetime, timezone
from pathlib import Path
from unittest.mock import patch

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))
from app.models import Base, Invoice, User
from app.routers.ai import _revenue_date_range, _sales_snapshot
from app.schemas.ai import RevenueAnalysisRequest


class RevenuePeriodTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine)
        self.db.add(User(id=1, username="test", full_name="Test", password_hash="test", role="admin"))
        self.db.commit()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def period(self, days="7"):
        # 00:30 in Vietnam: the UTC calendar still says October 29.
        with patch("app.routers.ai.datetime", wraps=datetime) as clock:
            clock.now.side_effect = lambda tz: datetime(2026, 10, 29, 17, 30, tzinfo=timezone.utc).astimezone(tz)
            return _revenue_date_range(self.db, RevenueAnalysisRequest(period=days))

    def test_no_invoices_still_has_current_calendar_range(self):
        self.assertEqual(self.period(), (date(2026, 10, 24), date(2026, 10, 30)))
        self.assertEqual(self.period("30"), (date(2026, 10, 1), date(2026, 10, 30)))

    def test_boundaries_exclude_old_and_future_invoices(self):
        for index, (created_at, amount) in enumerate([
            (datetime(2026, 10, 23, 23, 59, 59), 230000),
            (datetime(2026, 10, 24), 116000),
            (datetime(2026, 10, 30, 23, 59, 59), 647000),
            (datetime(2026, 10, 31), 999000),
        ]):
            self.db.add(Invoice(invoice_code=f"TEST{index}", user_id=1, total_amount=amount,
                                final_amount=amount, payment_method="cash", created_at=created_at))
        self.db.commit()
        snapshot = _sales_snapshot(self.db, *self.period())
        self.assertEqual(snapshot["total_revenue"], 763000)
        self.assertEqual(snapshot["total_invoices"], 2)

    def test_custom_and_all_ranges_are_preserved(self):
        custom = RevenueAnalysisRequest(period="custom", fromDate=date(2026, 10, 22), toDate=date(2026, 10, 28))
        self.assertEqual(_revenue_date_range(self.db, custom), (custom.fromDate, custom.toDate))
        self.assertEqual(_revenue_date_range(self.db, RevenueAnalysisRequest(period="all")), (None, None))


if __name__ == "__main__":
    unittest.main()
