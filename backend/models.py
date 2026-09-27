from sqlalchemy import Column, Integer, String, Text

from database import Base


class Deviation(Base):
    __tablename__ = "deviations"

    id = Column(Integer, primary_key=True, index=True)

    source = Column(String(100))
    department = Column(String(100))
    productName = Column(String(200))
    batchNumber = Column(String(100))
    parameter = Column(String(200))
    approvedRange = Column(String(100))
    observedValue = Column(String(100))
    duration = Column(String(100))
    affectedQuantity = Column(String(100))

    description = Column(Text)
    immediateAction = Column(Text)

    severity = Column(String(50))
    severityReason = Column(Text)