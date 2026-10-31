
import json
import re
from typing import Optional

from app.services.registry import registry


EVALUATION_RUBRIC = {
    "correctness": {
        "weight": 0.25,
        "description": "Factual accuracy and correctness.",
    },
    "relevance": {
        "weight": 0.20,
        "description": "How directly the response answers the prompt.",
    },
    "instruction_following": {
        "weight": 0.20,
        "description": "Adherence to explicit user instructions.",
    },
    "completeness": {
        "weight": 0.20,
        "description": "Coverage of the important information.",
    },
    "clarity": {
        "weight": 0.15,
        "description": "Readability, structure and understandability.",
    },
}


def build_evaluation_prompt(
    prompt: str,
    response: str,
    reference_answer: Optional[str] = None,
) -> str:
    reference_section = (
        f"\nREFERENCE ANSWER:\n{reference_answer}\n"
        if reference_answer
        else "\nNo reference answer was provided. Evaluate using factual knowledge and the prompt.\n"
    )

    return f"""
You are an impartial evaluator of large language model responses.

Evaluate the response using the following five criteria.

1. correctness: factual accuracy
2. relevance: relevance to the original prompt
3. instruction_following: adherence to instructions
4. completeness: coverage of necessary information
5. clarity: readability and structure

Score each criterion from 1 to 5.

Scoring guide:
1 = Very poor
2 = Poor
3 = Acceptable
4 = Good
5 = Excellent

Be strict, consistent and evidence-based.
Do not reward verbosity by itself.
Do not assume that confident statements are correct.

USER PROMPT:
{prompt}

MODEL RESPONSE:
{response}
{reference_section}

Return ONLY valid JSON using exactly this structure:

{{
    "scores": {{
        "correctness": 1,
        "relevance": 1,
        "instruction_following": 1,
        "completeness": 1,
        "clarity": 1
    }},
    "reasoning": {{
        "correctness": "Explanation",
        "relevance": "Explanation",
        "instruction_following": "Explanation",
        "completeness": "Explanation",
        "clarity": "Explanation"
    }},
    "strengths": ["Strength 1"],
    "weaknesses": ["Weakness 1"],
    "overall_feedback": "Overall assessment"
}}

Do not include Markdown fences or additional text.
""".strip()


def extract_json(text: str) -> dict:
    cleaned = text.strip()

    cleaned = re.sub(
        r"^```(?:json)?\s*",
        "",
        cleaned,
        flags=re.IGNORECASE,
    )

    cleaned = re.sub(r"\s*```$", "", cleaned)

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", cleaned, re.DOTALL)

        if not match:
            raise ValueError("Judge did not return valid JSON.")

        return json.loads(match.group())


def validate_evaluation(data: dict) -> dict:
    required_scores = list(EVALUATION_RUBRIC.keys())

    scores = data.get("scores")
    reasoning = data.get("reasoning")

    if not isinstance(scores, dict):
        raise ValueError("Evaluation scores are missing.")

    if not isinstance(reasoning, dict):
        raise ValueError("Evaluation reasoning is missing.")

    validated_scores = {}

    for criterion in required_scores:
        value = scores.get(criterion)

        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise ValueError(
                f"Invalid score for criterion: {criterion}"
            )

        if not 1 <= value <= 5:
            raise ValueError(
                f"Score for {criterion} must be between 1 and 5."
            )

        validated_scores[criterion] = float(value)

    weighted_score = sum(
        validated_scores[criterion]
        * EVALUATION_RUBRIC[criterion]["weight"]
        for criterion in required_scores
    )

    overall_score = round(weighted_score * 20, 2)

    validated_reasoning = {}

    for criterion in required_scores:
        explanation = reasoning.get(criterion)

        if not isinstance(explanation, str) or not explanation.strip():
            raise ValueError(
                f"Missing reasoning for criterion: {criterion}"
            )

        validated_reasoning[criterion] = explanation.strip()

    strengths = data.get("strengths", [])
    weaknesses = data.get("weaknesses", [])
    feedback = data.get("overall_feedback", "")

    if not isinstance(strengths, list):
        raise ValueError("Strengths must be a list.")

    if not isinstance(weaknesses, list):
        raise ValueError("Weaknesses must be a list.")

    if not isinstance(feedback, str):
        raise ValueError("Overall feedback must be text.")

    return {
        "overall_score": overall_score,
        "scores": validated_scores,
        "reasoning": validated_reasoning,
        "strengths": strengths,
        "weaknesses": weaknesses,
        "overall_feedback": feedback,
    }


class LLMJudge:

    async def evaluate(
        self,
        prompt: str,
        response: str,
        judge_model: str,
        reference_answer: Optional[str] = None,
    ) -> dict:

        if not prompt.strip():
            raise ValueError("Evaluation prompt cannot be empty.")

        if not response.strip():
            raise ValueError("Model response cannot be empty.")

        provider_name, provider = await registry.resolve_model(
            judge_model
        )

        evaluation_prompt = build_evaluation_prompt(
            prompt=prompt,
            response=response,
            reference_answer=reference_answer,
        )

        generation = await provider.generate(
            model=judge_model,
            prompt=evaluation_prompt,
        )

        evaluation = validate_evaluation(
            extract_json(generation.text)
        )

        return {
            "judge_model": judge_model,
            "judge_provider": provider_name,
            "judge_latency_ms": generation.latency_ms,
            **evaluation,
        }


judge = LLMJudge()
