import os
import json

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from groq import Groq
from pypdf import PdfReader

from database import engine, SessionLocal, Base
from models import Deviation
from graph import deviation_graph


load_dotenv()


app = FastAPI(
    title="AIVOA Deviation Management API"
)


# Create PostgreSQL tables
Base.metadata.create_all(bind=engine)


# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Groq client
client = Groq(
    api_key=os.getenv("GROQ_API_KEY")
)


# --------------------------------------------------
# REQUEST MODELS
# --------------------------------------------------

class ChatRequest(BaseModel):
    message: str
    current_data: dict = {}


class DeviationData(BaseModel):
    source: str = ""
    department: str = ""
    productName: str = ""
    batchNumber: str = ""
    parameter: str = ""
    approvedRange: str = ""
    observedValue: str = ""
    duration: str = ""
    affectedQuantity: str = ""
    description: str = ""
    immediateAction: str = ""
    severity: str = ""
    severityReason: str = ""


# --------------------------------------------------
# HOME
# --------------------------------------------------

@app.get("/")
def home():
    return {
        "message": "AIVOA Deviation API is running"
    }


# --------------------------------------------------
# LANGGRAPH PROCESSING
# --------------------------------------------------

def process_with_langgraph(text):
    try:
        result = deviation_graph.invoke({
            "text": text,
            "current_data": {},
            "data": {},
            "validation": "",
            "severity": "",
            "severityReason": ""
        })

        data = result.get("data", {})

        data["severity"] = result.get(
            "severity",
            ""
        )

        data["severityReason"] = result.get(
            "severityReason",
            ""
        )

        return {
            "operation": "populate_form",
            "data": data,
            "validation": result.get(
                "validation",
                ""
            )
        }

    except Exception as e:
        print("LANGGRAPH ERROR:", e)

        raise HTTPException(
            status_code=500,
            detail="LangGraph processing failed."
        )


# --------------------------------------------------
# FIELD UPDATE USING GROQ
# --------------------------------------------------

def process_field_update(text, current_data):

    prompt = f"""
You are an AI assistant for pharmaceutical deviation management.

The user wants to modify an existing deviation form.

Current deviation data:

{json.dumps(current_data, indent=2)}

User request:

{text}

Determine whether the user wants to change a specific field.

Valid fields are:

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
severity
severityReason

Return ONLY valid JSON.

Example:

{{
    "operation": "update_field",
    "field": "affectedQuantity",
    "value": "60 kg",
    "message": "Affected quantity updated successfully."
}}

Rules:

- Change ONLY the requested field.
- Do not modify other fields.
- Use the exact field name from the valid fields list.
- Return only JSON.
"""

    try:
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
            content = content.replace(
                "```json",
                ""
            )
            content = content.replace(
                "```",
                ""
            )
            content = content.strip()

        return json.loads(content)

    except json.JSONDecodeError:
        raise HTTPException(
            status_code=500,
            detail="AI returned invalid JSON."
        )

    except Exception as e:
        print("FIELD UPDATE ERROR:", e)

        raise HTTPException(
            status_code=500,
            detail="Unable to update the field."
        )


# --------------------------------------------------
# CHAT ENDPOINT
# --------------------------------------------------

@app.post("/api/deviations/chat")
def chat(request: ChatRequest):

    message = request.message.strip()

    if not message:
        raise HTTPException(
            status_code=400,
            detail="Message cannot be empty."
        )

    # If there is already deviation data,
    # allow the user to modify individual fields.
    has_existing_data = any(
        value
        for value in request.current_data.values()
    )

    # Detect common field-edit requests
    edit_words = [
        "change",
        "update",
        "modify",
        "edit",
        "set",
        "replace"
    ]

    is_field_update = any(
        word in message.lower()
        for word in edit_words
    )

    if has_existing_data and is_field_update:

        return process_field_update(
            message,
            request.current_data
        )

    # Otherwise use LangGraph for
    # complete deviation extraction
    return process_with_langgraph(
        message
    )


# --------------------------------------------------
# PDF UPLOAD
# --------------------------------------------------

@app.post("/api/deviations/upload-pdf")
async def upload_pdf(
    file: UploadFile = File(...)
):

    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=400,
            detail="Only PDF files are allowed."
        )

    try:

        contents = await file.read()

        # Save temporarily
        temp_path = "temp_deviation.pdf"

        with open(
            temp_path,
            "wb"
        ) as temp_file:

            temp_file.write(contents)

        # Extract PDF text
        reader = PdfReader(temp_path)

        extracted_text = ""

        for page in reader.pages:

            page_text = page.extract_text()

            if page_text:
                extracted_text += (
                    page_text + "\n"
                )

        # Delete temporary PDF
        if os.path.exists(temp_path):
            os.remove(temp_path)

        if not extracted_text.strip():
            raise HTTPException(
                status_code=400,
                detail="Could not extract text from the PDF."
            )

        # Send extracted text to LangGraph
        result = process_with_langgraph(
            extracted_text
        )

        return {
            "success": True,
            "data": result["data"],
            "validation": result.get(
                "validation",
                ""
            )
        }

    except HTTPException:
        raise

    except Exception as e:

        print("PDF ERROR:", e)

        if os.path.exists("temp_deviation.pdf"):
            os.remove("temp_deviation.pdf")

        raise HTTPException(
            status_code=500,
            detail="Failed to process the PDF."
        )


# --------------------------------------------------
# SAVE DEVIATION TO POSTGRESQL
# --------------------------------------------------

@app.post("/api/deviations/save")
def save_deviation(
    deviation: DeviationData
):

    db = SessionLocal()

    try:

        new_deviation = Deviation(
            source=deviation.source,
            department=deviation.department,
            productName=deviation.productName,
            batchNumber=deviation.batchNumber,
            parameter=deviation.parameter,
            approvedRange=deviation.approvedRange,
            observedValue=deviation.observedValue,
            duration=deviation.duration,
            affectedQuantity=deviation.affectedQuantity,
            description=deviation.description,
            immediateAction=deviation.immediateAction,
            severity=deviation.severity,
            severityReason=deviation.severityReason
        )

        db.add(new_deviation)

        db.commit()

        db.refresh(new_deviation)

        return {
            "success": True,
            "message": "Deviation saved successfully.",
            "id": new_deviation.id
        }

    except Exception as e:

        db.rollback()

        print(
            "DATABASE ERROR:",
            e
        )

        raise HTTPException(
            status_code=500,
            detail="Failed to save deviation."
        )

    finally:

        db.close()