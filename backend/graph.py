import os
import json
from typing import TypedDict

from dotenv import load_dotenv
from groq import Groq
from langgraph.graph import StateGraph, END

load_dotenv()

client = Groq(
    api_key=os.getenv("GROQ_API_KEY")
)


class DeviationState(TypedDict):
    text: str
    current_data: dict
    data: dict
    validation: str
    severity: str
    severityReason: str


def extract_deviation(state: DeviationState):
    text = state["text"]

    prompt = f"""
You are an AI assistant for pharmaceutical deviation management.

Extract deviation information from the following text.

Return ONLY valid JSON.
Do not use markdown.
Do not add explanations.

Required JSON fields:

source
department
productName
batchNumber
parameter
approvedRange
observedValue
duration
affectedQuantity
description
immediateAction

If a field is not available, use an empty string.

Deviation text:
{text}
"""

    response = client.chat.completions.create(
        model="openai/gpt-oss-120b",
        messages=[
            {
                "role": "user",
                "content": prompt
            }
        ],
        temperature=0
    )

    content = response.choices[0].message.content.strip()

    # Remove markdown code fences if AI returns them
    if content.startswith("```"):
        content = content.replace("```json", "")
        content = content.replace("```", "")
        content = content.strip()

    data = json.loads(content)

    return {
        "data": data
    }


def validate_deviation(state: DeviationState):
    data = state["data"]

    required_fields = [
        "department",
        "productName",
        "batchNumber",
        "parameter",
        "approvedRange",
        "observedValue"
    ]

    missing_fields = []

    for field in required_fields:
        if not data.get(field):
            missing_fields.append(field)

    if missing_fields:
        validation = (
            "Missing information: "
            + ", ".join(missing_fields)
        )
    else:
        validation = "Deviation information is complete."

    return {
        "validation": validation
    }


def assess_severity(state: DeviationState):
    data = state["data"]

    prompt = f"""
You are an AI assistant helping assess pharmaceutical manufacturing deviations.

Analyze the deviation information below.

Consider:
- Difference between approved range and observed value
- Duration of the deviation
- Affected quantity
- Potential product quality impact
- Immediate action taken

Classify severity as ONLY one of:

Low
Medium
High

Return ONLY valid JSON in this format:

{{
    "severity": "Low/Medium/High",
    "severityReason": "short explanation"
}}

Deviation information:

{json.dumps(data, indent=2)}
"""

    response = client.chat.completions.create(
        model="openai/gpt-oss-120b",
        messages=[
            {
                "role": "user",
                "content": prompt
            }
        ],
        temperature=0
    )

    content = response.choices[0].message.content.strip()

    if content.startswith("```"):
        content = content.replace("```json", "")
        content = content.replace("```", "")
        content = content.strip()

    result = json.loads(content)

    return {
        "severity": result.get("severity", ""),
        "severityReason": result.get(
            "severityReason",
            ""
        )
    }


# Create LangGraph
graph_builder = StateGraph(DeviationState)

graph_builder.add_node(
    "extract_deviation",
    extract_deviation
)

graph_builder.add_node(
    "validate_deviation",
    validate_deviation
)

graph_builder.add_node(
    "assess_severity",
    assess_severity
)

graph_builder.set_entry_point(
    "extract_deviation"
)

graph_builder.add_edge(
    "extract_deviation",
    "validate_deviation"
)

graph_builder.add_edge(
    "validate_deviation",
    "assess_severity"
)

graph_builder.add_edge(
    "assess_severity",
    END
)

deviation_graph = graph_builder.compile()