from datetime import datetime, timezone

from sqlalchemy import (
    Column,
    DateTime,
    Float,
    ForeignKey,
    JSON,
    String,
    Text,
)

from app.core.database import Base


class Evaluation(Base):
    __tablename__ = "evaluations"

    id = Column(String(36), primary_key=True, index=True)

    benchmark_id = Column(
        String(36),
        ForeignKey("benchmark_runs.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    prompt = Column(Text, nullable=False)
    response = Column(Text, nullable=False)
    reference_answer = Column(Text, nullable=True)

    judge_model = Column(String(100), nullable=False)
    judge_provider = Column(String(100), nullable=True)
    judge_latency_ms = Column(Float, nullable=True)

    overall_score = Column(Float, nullable=False)
    scores = Column(JSON, nullable=False)
    reasoning = Column(JSON, nullable=False)

    strengths = Column(JSON, nullable=False)
    weaknesses = Column(JSON, nullable=False)
    overall_feedback = Column(Text, nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        index=True,
    )
    