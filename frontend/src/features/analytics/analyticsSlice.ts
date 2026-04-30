import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface RegionState {
  selectedStateCode: string | null;
  selectedStateName: string | null;
  selectedDistrictCode: string | null;
  selectedDistrictName: string | null;
  selectedItem: string;
  selectedPeriod: "monthly" | "quarterly" | "yearly";
  deviationThreshold: number;
}

const initialState: RegionState = {
  selectedStateCode: null,
  selectedStateName: null,
  selectedDistrictCode: null,
  selectedDistrictName: null,
  selectedItem: "cement",
  selectedPeriod: "monthly",
  deviationThreshold: 15
};

const analyticsSlice = createSlice({
  name: "analytics",
  initialState,
  reducers: {
    setRegion(state, action: PayloadAction<{ stateCode: string | null; stateName: string | null }>) {
      state.selectedStateCode = action.payload.stateCode;
      state.selectedStateName = action.payload.stateName;
      state.selectedDistrictCode = null;
      state.selectedDistrictName = null;
    },
    setDistrict(state, action: PayloadAction<{ districtCode: string | null; districtName: string | null }>) {
      state.selectedDistrictCode = action.payload.districtCode;
      state.selectedDistrictName = action.payload.districtName;
    },
    setItem(state, action: PayloadAction<string>) {
      state.selectedItem = action.payload;
    },
    setPeriod(state, action: PayloadAction<"monthly" | "quarterly" | "yearly">) {
      state.selectedPeriod = action.payload;
    },
    setDeviationThreshold(state, action: PayloadAction<number>) {
      state.deviationThreshold = action.payload;
    },
    resetRegion(state) {
      state.selectedStateCode = null;
      state.selectedStateName = null;
      state.selectedDistrictCode = null;
      state.selectedDistrictName = null;
    }
  }
});

export const { setRegion, setDistrict, setItem, setPeriod, setDeviationThreshold, resetRegion } = analyticsSlice.actions;
export default analyticsSlice.reducer;
