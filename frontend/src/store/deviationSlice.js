import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  source: "",
  department: "",
  productName: "",
  batchNumber: "",
  parameter: "",
  approvedRange: "",
  observedValue: "",
  duration: "",
  affectedQuantity: "",
  description: "",
  immediateAction: "",
  severity: "",
  severityReason: ""
};

const deviationSlice = createSlice({
  name: "deviation",
  initialState,
  reducers: {
    setDeviation: (state, action) => {
      return { ...state, ...action.payload };
    },

    updateField: (state, action) => {
      const { field, value } = action.payload;
      state[field] = value;
    },

    clearDeviation: () => initialState
  }
});

export const {
  setDeviation,
  updateField,
  clearDeviation
} = deviationSlice.actions;

export default deviationSlice.reducer;