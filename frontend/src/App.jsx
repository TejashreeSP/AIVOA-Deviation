import { useState } from "react";
import "./App.css";
import axios from "axios";
import { useDispatch, useSelector } from "react-redux";
import { setDeviation, updateField } from "./store/deviationSlice";

function App() {
  const dispatch = useDispatch();

  const deviation = useSelector((state) => state.deviation);

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const [chatMessages, setChatMessages] = useState([
    {
      type: "ai",
      text: "Ready to process a new deviation. Paste deviation text or upload a PDF and I will extract the relevant information, assess severity, and populate the form.",
    },
  ]);

  // ----------------------------------------
  // UPDATE REDUX FIELD
  // ----------------------------------------

  const handleChange = (field, value) => {
    dispatch(
      updateField({
        field,
        value,
      })
    );
  };

  // ----------------------------------------
  // ADD AI MESSAGE
  // ----------------------------------------

  const addAIMessage = (text) => {
    setChatMessages((previous) => [
      ...previous,
      {
        type: "ai",
        text,
      },
    ]);
  };

  // ----------------------------------------
  // SEND MESSAGE
  // ----------------------------------------

  const sendMessage = async () => {
    const currentMessage = message.trim();

    if (!currentMessage || loading) {
      return;
    }

    setLoading(true);
    setSuccessMessage("");

    setChatMessages((previous) => [
      ...previous,
      {
        type: "user",
        text: currentMessage,
      },
    ]);

    setMessage("");

    try {
      const response = await axios.post(
        "http://127.0.0.1:8000/api/deviations/chat",
        {
          message: currentMessage,
          current_data: deviation,
        }
      );

      const result = response.data;

      // Complete AI extraction
      if (
        result.operation === "populate_form" &&
        result.data
      ) {
        dispatch(setDeviation(result.data));

        const text =
          "Deviation parsed successfully. I extracted the details and populated the form.";

        addAIMessage(text);
        setSuccessMessage(text);
      }

      // AI field update
      else if (
        result.operation === "update_field"
      ) {
        const field = result.field;
        const value = result.value;

        if (field) {
          dispatch(
            updateField({
              field,
              value,
            })
          );
        }

        const text =
          result.message ||
          `Updated ${field} successfully.`;

        addAIMessage(text);
        setSuccessMessage(text);
      }

      // Normal response
      else {
        const text =
          result.message ||
          "The AI processed your request.";

        addAIMessage(text);
      }
    } catch (error) {
      console.error("AI Error:", error);

      const errorMessage =
        error.response?.data?.detail ||
        "Unable to process the request.";

      addAIMessage(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // ----------------------------------------
  // PDF UPLOAD
  // ----------------------------------------

  const handlePdfUpload = async (event) => {
    const file = event.target.files[0];

    if (!file || loading) {
      return;
    }

    setLoading(true);
    setSuccessMessage("");

    setChatMessages((previous) => [
      ...previous,
      {
        type: "user",
        text: `Uploaded PDF: ${file.name}`,
      },
    ]);

    try {
      const formData = new FormData();

      formData.append("file", file);

      const response = await axios.post(
        "http://127.0.0.1:8000/api/deviations/upload-pdf",
        formData
      );

      const result = response.data;

      if (
        result.success &&
        result.data
      ) {
        dispatch(setDeviation(result.data));

        const text =
          "PDF processed successfully. I extracted the deviation details and populated the form.";

        addAIMessage(text);
        setSuccessMessage(text);
      }
    } catch (error) {
      console.error("PDF Error:", error);

      const errorMessage =
        error.response?.data?.detail ||
        "Unable to process the PDF.";

      addAIMessage(errorMessage);
    } finally {
      setLoading(false);

      event.target.value = "";
    }
  };

  // ----------------------------------------
  // SAVE DEVIATION
  // ----------------------------------------

  const saveDeviation = async () => {
    if (loading) {
      return;
    }

    setLoading(true);
    setSuccessMessage("");

    try {
      const response = await axios.post(
        "http://127.0.0.1:8000/api/deviations/save",
        deviation
      );

      const text =
        response.data.message ||
        "Deviation saved successfully.";

      setSuccessMessage(text);

      addAIMessage(text);
    } catch (error) {
      console.error("Save Error:", error);

      const errorMessage =
        error.response?.data?.detail ||
        "Failed to save deviation.";

      setSuccessMessage(errorMessage);

      addAIMessage(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // ----------------------------------------
  // SEVERITY CLASS
  // ----------------------------------------

  const getSeverityClass = () => {
    const severity =
      deviation.severity?.toLowerCase();

    if (severity === "high") {
      return "severity-high";
    }

    if (severity === "medium") {
      return "severity-medium";
    }

    if (severity === "low") {
      return "severity-low";
    }

    return "severity-empty";
  };

  return (
    <div className="app">

      {/* ======================================
          LEFT PANEL
      ====================================== */}

      <main className="form-panel">

        <div className="form-content">

          {/* HEADER */}

          <div className="form-header">

            <div className="brand-section">

              <div className="brand-icon">
                A
              </div>

              <div>
                <h1>Log Deviation</h1>

                <p>
                  API Quality Assurance Module
                </p>
              </div>

            </div>

            <div className="status">
              <span className="status-dot"></span>
              Pending Review
            </div>

          </div>

          {/* SUCCESS MESSAGE */}

          {successMessage && (
            <div className="success-message">
              <span>✓</span>
              {successMessage}
            </div>
          )}

          {/* ======================================
              SECTION 1
          ====================================== */}

          <section className="section">

            <div className="section-title">

              <span>01</span>

              <div>
                <h3>Event Information</h3>
                <p>Basic deviation source information</p>
              </div>

            </div>

            <div className="form-grid">

              <div className="field">

                <label>Deviation Source</label>

                <input
                  value={deviation.source}
                  placeholder="Awaiting AI extraction..."
                  onChange={(e) =>
                    handleChange(
                      "source",
                      e.target.value
                    )
                  }
                />

              </div>

              <div className="field">

                <label>Department</label>

                <input
                  value={deviation.department}
                  placeholder="Awaiting AI extraction..."
                  onChange={(e) =>
                    handleChange(
                      "department",
                      e.target.value
                    )
                  }
                />

              </div>

            </div>

          </section>

          {/* ======================================
              SECTION 2
          ====================================== */}

          <section className="section">

            <div className="section-title">

              <span>02</span>

              <div>
                <h3>
                  Product & Batch Identification
                </h3>

                <p>
                  Product and batch information
                </p>
              </div>

            </div>

            <div className="form-grid">

              <div className="field">

                <label>Product Name</label>

                <input
                  value={deviation.productName}
                  placeholder="Awaiting AI extraction..."
                  onChange={(e) =>
                    handleChange(
                      "productName",
                      e.target.value
                    )
                  }
                />

              </div>

              <div className="field">

                <label>Batch / Lot Number</label>

                <input
                  value={deviation.batchNumber}
                  placeholder="Awaiting AI extraction..."
                  onChange={(e) =>
                    handleChange(
                      "batchNumber",
                      e.target.value
                    )
                  }
                />

              </div>

            </div>

          </section>

          {/* ======================================
              SECTION 3
          ====================================== */}

          <section className="section">

            <div className="section-title">

              <span>03</span>

              <div>
                <h3>Deviation Details</h3>

                <p>
                  Process and impact information
                </p>
              </div>

            </div>

            <div className="form-grid">

              <div className="field">

                <label>Process Parameter</label>

                <input
                  value={deviation.parameter}
                  placeholder="Awaiting AI extraction..."
                  onChange={(e) =>
                    handleChange(
                      "parameter",
                      e.target.value
                    )
                  }
                />

              </div>

              <div className="field">

                <label>Approved Range</label>

                <input
                  value={deviation.approvedRange}
                  placeholder="Awaiting AI extraction..."
                  onChange={(e) =>
                    handleChange(
                      "approvedRange",
                      e.target.value
                    )
                  }
                />

              </div>

              <div className="field">

                <label>Observed Value</label>

                <input
                  value={deviation.observedValue}
                  placeholder="Awaiting AI extraction..."
                  onChange={(e) =>
                    handleChange(
                      "observedValue",
                      e.target.value
                    )
                  }
                />

              </div>

              <div className="field">

                <label>Duration</label>

                <input
                  value={deviation.duration}
                  placeholder="Awaiting AI extraction..."
                  onChange={(e) =>
                    handleChange(
                      "duration",
                      e.target.value
                    )
                  }
                />

              </div>

              <div className="field">

                <label>Affected Quantity</label>

                <input
                  value={deviation.affectedQuantity}
                  placeholder="Awaiting AI extraction..."
                  onChange={(e) =>
                    handleChange(
                      "affectedQuantity",
                      e.target.value
                    )
                  }
                />

              </div>

            </div>

            <div className="field full-field">

              <label>Description</label>

              <textarea
                value={deviation.description}
                placeholder="Awaiting AI extraction..."
                onChange={(e) =>
                  handleChange(
                    "description",
                    e.target.value
                  )
                }
              />

            </div>

            <div className="field full-field">

              <label>Immediate Action</label>

              <textarea
                value={deviation.immediateAction}
                placeholder="Awaiting AI extraction..."
                onChange={(e) =>
                  handleChange(
                    "immediateAction",
                    e.target.value
                  )
                }
              />

            </div>

          </section>

          {/* ======================================
              SECTION 4
          ====================================== */}

          <section className="section">

            <div className="section-title">

              <span>04</span>

              <div>
                <h3>
                  AI Impact & Severity Assessment
                </h3>

                <p>
                  AI-generated recommendation for review
                </p>
              </div>

            </div>

            <div className="severity-container">

              <div className="field">

                <label>Severity</label>

                <div
                  className={`severity-display ${getSeverityClass()}`}
                >
                  {deviation.severity ||
                    "Awaiting AI assessment..."}
                </div>

              </div>

              <div className="field full-field">

                <label>Assessment Reason</label>

                <textarea
                  value={deviation.severityReason}
                  placeholder="Awaiting AI assessment..."
                  onChange={(e) =>
                    handleChange(
                      "severityReason",
                      e.target.value
                    )
                  }
                />

              </div>

            </div>

          </section>

          {/* SAVE */}

          <button
            className="save-button"
            onClick={saveDeviation}
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="button-spinner"></span>
                Processing...
              </>
            ) : (
              <>
                Save Deviation
                <span>→</span>
              </>
            )}
          </button>

          <p className="review-note">
            Review all AI-generated information before saving.
          </p>

        </div>

      </main>

      {/* ======================================
          RIGHT COPILOT
      ====================================== */}

      <aside className="copilot-panel">

        {/* HEADER */}

        <div className="copilot-header">

          <div className="copilot-brand">

            <div className="copilot-icon">
              ◈
            </div>

            <div>
              <h2>AIVOA Copilot</h2>

              <p>
                AI Deviation Assistant
              </p>
            </div>

          </div>

          <div className="online-status">
            <span></span>
            Online
          </div>

        </div>

        {/* INFO */}

        <div className="copilot-info">

          <div className="info-icon">
            ✦
          </div>

          <div>

            <strong>
              AI-assisted deviation intake
            </strong>

            <p>
              Extract deviation details, assess
              severity, and update form fields
              using natural language.
            </p>

          </div>

        </div>

        {/* CHAT */}

        <div className="chat-area">

          {chatMessages.map(
            (chat, index) => (

              <div
                key={index}
                className={
                  chat.type === "user"
                    ? "user-message"
                    : "ai-message"
                }
              >

                <div className="message-header">

                  <span>
                    {chat.type === "user"
                      ? "You"
                      : "AIVOA AI"}
                  </span>

                  <small>
                    {chat.type === "user"
                      ? "User"
                      : "Assistant"}
                  </small>

                </div>

                <p>{chat.text}</p>

              </div>
            )
          )}

          {loading && (

            <div className="ai-message">

              <div className="message-header">

                <span>AIVOA AI</span>

                <small>
                  Assistant
                </small>

              </div>

              <div className="typing">

                <span></span>
                <span></span>
                <span></span>

                <em>
                  Processing...
                </em>

              </div>

            </div>
          )}

        </div>

        {/* INPUT */}

        <div className="input-area">

          <textarea
            placeholder="Paste a deviation, describe an event, or ask me to change a field..."
            value={message}
            onChange={(e) =>
              setMessage(e.target.value)
            }
            onKeyDown={(e) => {

              if (
                e.key === "Enter" &&
                !e.shiftKey
              ) {
                e.preventDefault();
                sendMessage();
              }

            }}
          />

          <div className="input-actions">

            <label className="upload-button">

              <span>📎</span>
              Upload PDF

              <input
                type="file"
                accept=".pdf"
                hidden
                onChange={handlePdfUpload}
              />

            </label>

            <button
              className="send-button"
              onClick={sendMessage}
              disabled={
                loading ||
                !message.trim()
              }
              title="Send"
            >
              →
            </button>

          </div>

        </div>

        <div className="copilot-footer">
          Powered by LangGraph + Groq AI
        </div>

      </aside>

    </div>
  );
}

export default App;