from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.models import PurchaseReceipt, Supplier


def import_historical_suppliers(db: Session) -> None:
    """Reuse historical names without changing any receipt or contact information."""
    # Initialize only an empty directory. Renaming a supplier must not recreate
    # its former historical name as a new, unlocked supplier on the next boot.
    if db.query(Supplier.id).first() is not None:
        return
    known = {item.name.strip().casefold() for item in db.query(Supplier).all()}
    for (value,) in db.query(PurchaseReceipt.supplier_name).distinct().all():
        name = (value or "").strip()
        if name and name.casefold() not in known:
            db.add(Supplier(name=name, is_active=True))
            known.add(name.casefold())
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        # Another startup may have finished the same atomic initialization.
        if db.query(Supplier.id).first() is None:
            raise
