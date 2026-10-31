from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, Integer, JSON, String, Text

from app.core.database import Base


class Comparison(Base):
    __tablename__ = "comparisons"

    id = Column(String(36), primary_key=True, index=True)
    prompt = Column(Text, nullable=False)
    repeat = Column(Integer, nullable=False)
    model_count = Column(Integer, nullable=False)
    models = Column(JSON, nullable=False)

    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )