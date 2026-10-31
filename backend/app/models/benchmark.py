from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)

from app.core.database import Base


class BenchmarkRun(Base):
    __tablename__ = "benchmark_runs"

    id = Column(String(36), primary_key=True, index=True)

    comparison_id = Column(
        String(36),
        ForeignKey("comparisons.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    run_number = Column(Integer, nullable=False)
    model = Column(String(100), nullable=False, index=True)
    provider = Column(String(100), nullable=False)

    prompt = Column(Text, nullable=False)
    response = Column(Text, nullable=True)

    latency_ms = Column(Float, nullable=True)
    input_tokens = Column(Integer, nullable=True)
    output_tokens = Column(Integer, nullable=True)
    output_words = Column(Integer, nullable=True)

    total_duration_ms = Column(Float, nullable=True)
    load_duration_ms = Column(Float, nullable=True)
    prompt_eval_duration_ms = Column(Float, nullable=True)
    generation_duration_ms = Column(Float, nullable=True)

    tokens_per_second = Column(Float, nullable=True)
    time_to_first_token_ms = Column(Float, nullable=True)

    success = Column(Boolean, nullable=False)
    error = Column(Text, nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        index=True,
    )